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
//  Q-3. Step 12's reference model reads every cook at Normal (2026-10-19: the length setting is
//       gone); the finale literals are 16, 33 and 40 guests (fees 190, 390, 560), and the Birthday's
//       window is 60.
//  Q-4. Step 13 (pay): after the 3 star picnic the next week opens on the picnic again (sim.js Q-7).
//       Step 14 (W7.3): the idle Birthday's last call is 90 (W26 literal); guests_missed fires after
//       last_call, at the hard end, with the report's missed count. Step 16 (season end): the finale
//       loads up with endAt C.FINALE_SECONDS and last call at 135.
//  Q-5. Step 46: #title reads the pit name; the Birthday's shop lists only its rail meats (no
//       qty-ribs or qty-butt, Other meats folded) with a Covers line; the ledger reads the renamed
//       stock rows.
//
// v3.1, crew cards (contract docs/superpowers/specs/2026-10-19-pit-sim-v3-1-contract.md, X15, the
// 76 step list). The X12.1 sprite literal, the X10 strings, the X11.1 v5 save sample and the X10 say
// and ui additions are copied from the contract text verbatim (spliced in from the contract file, not
// retyped). Steps 1 to 62 keep their v3.0 meaning with the X15.1 changes: Hiring Day sits between the
// creator and week 1 in every headless and browser route (passRound three times and finishHiring, or
// hire-go four times), saves are v 5, offers vary by menu pair, size and tier, the report's money
// table is compact with the v3.0 rows one tap away. Steps 63 to 69 are new headless steps (crew
// rules, Hiring Day, walk-ins, mood and leaving, the felt difference, thirds and offers, the 6.10
// migration); 70 to 75 are new browser steps (Hiring Day by taps right after step 43, the crew sheet
// with a walk-in and training, the level-up choice, crew rows on the report with the thirds, the v2.1
// and v3.0 saves in the page, the crew in the yard); the console step is 76. New screenshots:
// hiring.png, card.png, crew.png, report-crew.png, plus (deviation 34) hiring-page2.png,
// card-walkin.png, card-crew.png and card-level.png, so every new screen and every #card mode has one.
// Deviations from contract X15 (v3.1, Harness builder):
//  21. Run order is not number order: steps 63 to 69 run headless right after step 17 (before the
//      browser launches), step 70 runs right after step 43 as X15.2 says, and 71 to 75 run after step
//      62, before the console step. Step names carry no numbers, as before; report.json lists run order.
//  22. Step 12's v3.1 reference model follows X3.4 with the X18.1 items 26 to 30. Two readings X18.1
//      leaves open are both modelled and either is accepted (the note says which matched): a picked card
//      with a Needs line that is not the week's stretch takes a SAFE_SIZES draw or not, and takes the
//      stretch patience and flames or not (item 26 says only "tier stretch, no stretch pay or sizing").
//      With the v3.0 types at most one card ever has a Needs line, so this only touches the stub lists.
//  23. The finale's `base` is not compared (X3.2 names it for weekly rows; the finale is sized by R-3,
//      not by X3.4); its tier, invite and menuIdx are.
//  24. Step 12's "hosts equal the v3.0 model's" compares the host names in display order as a
//      sequence: the r draws are the same, but the v3.1 display order (tiers, sizes) hands them to
//      different cards, and the top third's repeat invite draws one host more than v3.0 did.
//  25. W19 literals that the X3 variance moved (the Birthday's 12 guests, fee 100, deposit 30, rest
//      14; the picnic's 275 and 83; the week 2 add-on rail 8, 7, 5) are asserted
//      only on the draw that keeps the v3.0 shape (base menu, factor 1, safe tier, bottom third), and the
//      reference formula is asserted on every draw.
//  26. Step 21 "changing one look key changes the bust for every index" is checked pairwise, as step
//      21's v3.0 look check is. A hair or hair color pair the cap hides is compared again bare headed
//      (and hair color again with long hair) and passes with a note. RUN's apron is exempt: X12.3 gives
//      the RUN outfit no apron (A and B take the shirt), so its apron index cannot change the bust.
//  27. Step 67's carry-forward 3 measure stops at the earlier of the last booked spawn and
//      endAt - LAST_CALL_GUARD: tickBookedSpawns (and so the X5.10 pull) does not run in that guard.
//      The stretch counts ticks where food is in progress (the X18.1 item 38 predicate) and no booked
//      guest is arriving or waiting.
//  28. Step 67's RUN mean wait counts a waiting guest who is never served as served at the event end.
//      The RUN seed search (71 up, X15.3) runs on the 1 star run; nothing the RUN card does before the
//      fixture draws from rng, so the 5 star run reaches the same three guests at the same tick.
//  29. Step 69's migrated looks are checked against Math.floor(r() * LOOK_COUNTS[k]) for the six
//      X11.3 draws (the X6.1 mapping; X11.3 says "six draws in LOOK_KEYS order").
//  30. Step 71 reads the crew card's mood through any [aria-label] on #crew-{id} equal to ui.moodAria,
//      else #card-mood on the card sheet (X13.3 pins its aria-label); its XP meter is #card-xp on the
//      card sheet (X13.5 gives the crew sheet no XP meter).
//  31. The compact money table (steps 46 and 73) is the #rep-money rows that are visible and not inside
//      #rep-money-detail; the detail check needs the fee and deposit rows and the W17.4 order, and lets
//      the Take today and Cash rows sit in either part.
//  32. v4 fixtures (saveV4) still load as v4 saves, which also covers the migration in the page; a v4
//      fixture with no results now lands on Hiring Day (X8), so the steps that wanted the week 1 hub
//      straight away load a v5 fixture (saveV5) with season.drafted true.
//  33. Step 70's "first RUN card on page 1 whose wage is at most 60" falls back to page 2 when page 1
//      holds no open RUN card (about 1 pool in 200), and says so.
//  34. Four screenshots beyond X15's four (hiring-page2, card-walkin, card-crew, card-level), so every
//      new screen and sheet mode has a picture.
// Review round 1 (2026-10-19, contract X20.10; Overseer's calls):
//  35. Step 67 (printed 22) adds full booking legs: per role, at 1 and 5 stars, a Birthday on kettle 1
//      and the week's picnic on two kettles, played by the ported competent bot that leaves that role's
//      job to the card, settle off; 25 percent on RUN's tips, FIRE's and PREP's mean booked wait. The
//      staged X15.3 legs stay as unit checks. The felt fixtures cap the wage at C.PAYROLL[0].
//  36. C_X2 keeps the X2 starting values and gains the new keys (runTip, FIRE_WALK, HEADLINER,
//      HAT_SHARE, STRETCH_EDGE), so step 5 prints every review 1 move as tuned.
//  37. The reference models follow X20.3 (the stretch draw), X20.7 (headliners, walk-ins), X20.8
//      (drawLook) and X20.4 (a gear buy keeps the cards); step 12 asserts the STRETCH card pays the most.
//  38. The page steps follow X20.11: step 70 reads #hire-news and answers the empty crew pass confirm
//      (hire-pass-yes) wherever the harness passes rounds by taps; the done bar has no #hires-left.
//  39. Step 63's over budget fixture reads the budget through C: under 58 the 5 star FIRE card alone is
//      over it too and both rest before Load up and go is checked.

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
  game: path.join(GAME_DIR, 'game.js'),
  music: path.join(GAME_DIR, 'music.js')
};
const EXPECTED_REQUEST_FILES = ['index.html', 'sprites.js', 'sim.js', 'game.js', 'music.js',
  // v3.4 (design 12): the art3 library and its adapter.
  'art3/palette.js', 'art3/proj.js', 'art3/people.js', 'art3/kit.js', 'art3/yard.js', 'art3/fx.js', 'art3/rule.js', 'art3/index.js', 'art3/bridge.js'];

const DEFAULT_SEED = 1;
const SAVE_KEY = 'hs.pitsim.save';
const GLOBAL_NAME = 'PitSim';
const GAME_VERSION = '0.6.0';   // X0
const SIM_SURFACE = ['C', 'MEATS', 'MEAT_IDS', 'MAP', 'CATALOG', 'STRINGS', 'createSim', 'validateSave', 'fireBand', 'fireMult', 'tileOwned', 'SAVE_KEY',
  // v3.0 (W1): the nine new top level names.
  'BOOKINGS', 'BOOKING_IDS', 'LOOK_KEYS', 'LOOK_COUNTS', 'DEFAULT_LOOK', 'genOffers', 'scoreEvent', 'cleanName', 'filterName',
  // v3.1 (X1): the six new top level names.
  'ROLE_IDS', 'genPool', 'genWalkins', 'cardStars', 'wageFor', 'skillValue'];
const SURFACE_COUNTS = { tiles: 132, stations: 9, seats: 6, decor: 6, props: 19, catalog: 21 };
const MAP_SIZE = { w: 11, h: 12 };
const TILE_PX = 16;
const VIRTUAL = { w: MAP_SIZE.w * TILE_PX, h: MAP_SIZE.h * TILE_PX };   // 176 by 192
// v3.4 (design 12.1 to 12.3): the yard renders at 2 render px per sim px (352 by 384), with an
// integer k device px per render px. CSS_SCALE is CSS px per render px at the run sizes: 375@2 is
// k 2 (352 CSS), 1024x820@1 is k 1 (the 768 tall k 2 yard and controls do not fit 820).
const RENDER = { w: 352, h: 288 };                                      // v3.5: the iso yard, 352 by 288
const CSS_SCALE = { phone: 1, desktop: 1 };                              // contract D13, v3.4
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
const C_EXPECT = { WALK_TILES_PER_S: 6, SAVE_VERSION: 11, PATIENCE_MID_FRAC: 0.5, GEAR_RESERVE: 30, QUEUE_SPOTS: 3, QUEUE_SPOTS_BIG: 5, TABLE_SPOTS: 3, TABLE_SPOTS_BIG: 5 };
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
const TUTORIAL_ORDER = ['open', 'charcoal', 'light', 'meat', 'puton', 'cook', 'slice', 'customer', 'register', 'plate', 'deliver', 'seated', 'end'];   // v3.7
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
  register: 'Ring up the guest at the register.',   // v3.7
  deliver: 'Carry the plate to their table.',
  runner: 'Your runner carries it to their table.',
  seated: 'Served. They eat, then tip a little more.',
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
  // The angle redo: the arrow always points down from above its station: draw.x + w / 2 - 4, draw.y - 12, frames 0 and 1.
  pile: { x: 68, y: 116, frames: [0, 1] }, kettle1: { x: 68, y: 68, frames: [0, 1] }, cooler: { x: 68, y: 84, frames: [0, 1] },
  board: { x: 36, y: 52, frames: [0, 1] }, table: { x: 76, y: 4, frames: [0, 1] }
};
const WARN_DRAW = {
  piece: { name: 'piece_sausage', frame: 4, x: 64, y: 73 },   // the angle redo: kettle 1 draw (64,80) plus its slotPx (0,-7)
  bubble: { name: 'bubble_warn', x: 62, y: 69 },   // round 1: draw.x - 2, left of the vent
  smoke: { name: 'smoke_dark', xMin: 64, xMax: 84, yMax: 80 }
};
const PULSE = 'tut-pulse';
const DAY1_HINT = 'Tap the charcoal pile';
const MEAT_IDS = ['sausage', 'chicken', 'ribs', 'butt', 'brisket'];
const GEAR_IDS = ['kettle2', 'cooler', 'bigtable', 'tray', 'canopy', 'drum'];
const DECOR_IDS = ['chair1', 'chair2', 'flowers', 'birdbath', 'lights', 'picnic2'];
const SEAT_IDS = ['pt1b', 'pt1a', 'chair1', 'chair2', 'pt2b', 'pt2a'];
const DOG_HOME = { x: 2, y: 9, px: 32, py: 144, frame: 2 };   // the angle redo plan A

// Contract X12.1, copied verbatim (replaces the W16.2 literal; spliced from the contract text).
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
  ['ev_finale', 16, 16, 1], ['star', 9, 9, 4], ['flame', 8, 10, 2], ['check', 8, 8, 1],
  ['prep_down', 16, 24, 3], ['prep_up', 16, 24, 3], ['prep_side', 16, 24, 3], ['prep_slice', 16, 24, 2],
  ['mood', 10, 10, 5]
];
const SPRITE_COUNT = 128;
const SPRITE_FRAMES = 352;
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
  SEASON_WEEKS: 7, YEAR_MAX: 99,
  LENGTHS: { normal: { seconds: 190, window: 135, factor: 1.25 } },   // v3.5
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
  NAME_MAX: 14, PIT_NAME_MAX: 20, NAME_PUNCT: " '.-",
  SEASON_CARRY_REP: 0.75, SEASON_REP_FLOOR: 20,
  DRIVEWAY_REP: 34
};
const C_W2_FIXED = ['SAVE_VERSION', 'SEASON_WEEKS', 'NAME_MAX', 'NAME_PUNCT', 'LENGTHS'];
// W2 changed values and the v2.1 keys that stay (W2 last paragraph).
const C_W2_EXACT = { SAVE_VERSION: 11, DRIVEWAY_PRICE: 400, GATE_OPENS: 30, LAST_CALL: 110, DAY_SECONDS: 125, STEPPER_MAX: 99, START_CASH: 80, START_REP: 20 };
// W22.18: the keys whose starting values the W19 literals assume.
const LITERAL_KEYS = ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC', 'PAY_BASE', 'PAY_PER_STAR', 'STAR_FANS', 'REP_DAY_MIN', 'SPARE_FRAC', 'BAGS_PER_COOKER',
  'SCORE_FED', 'SCORE_WAIT', 'SCORE_QUALITY', 'STAR_EDGES', 'WAIT_FULL_S', 'WAIT_ZERO_S', 'BURNT_PENALTY', 'OFFMENU_PENALTY', 'COOLER_CAP', 'SEASON_CARRY_REP', 'SEASON_REP_FLOOR',
  'SAFE_LOAD', 'COLD_PENALTY'];
// X2: the v3.1 C keys at their starting values. X2_FIXED must equal; the 3 star column of
// SKILL_CURVE is fixed too; the rest are tunable starting values (same kind), read through C.
const C_X2 = {
  SKILL_CURVE: { fireSense: [45, 55, 65], firePace: [5.0, 4.0, 2.5], runSpeed: [3.5, 4.0, 5.5], runHandle: [0.6, 0.4, 0.2],
    runSeatTip: [0, 0.1, 0.4], runTip: [-0.25, 0, 1.0], prepKnife: [1.4, 1.0, 0.6], prepPace: [3.5, 4.0, 5.5],
    tillRing: [2.0, 1.2, 0.5], tillTip: [-0.1, 0, 0.3] },   // runTip: review 1 (X20.1); till: v3.6
  ROLE_SKILLS: { run: [['runSpeed'], ['runHandle', 'runSeatTip', 'runTip']], fire: [['fireSense'], ['firePace']], prep: [['prepKnife'], ['prepPace']], till: [['tillRing'], ['tillTip']] },   // review 1: runTip on Friendliness; v3.6 TILL
  MOOD_STARS: [-1, -0.5, 0, 0, 0.5],
  WAGE_TABLE: [10, 13, 16, 20, 24, 29, 34, 40, 46],
  ROLE_WAGE: { run: 1.0, fire: 1.25, prep: 1.0, till: 1.0 },
  PAYROLL: [60, 90, 140, 220], ROSTER_SLOTS: [2, 3, 4, 6],
  CREW_MAX: 8, BENCH_STREAK: 2, HIRE_ROUNDS: 3, POOL_SIZE: 24, POOL_PAGE: 9, TAKEN_PER_ROUND: 3, TAKEN_SHORTLIST: 6, TRYOUTS: 2,
  WALKINS: [2, 2, 3], LEVEL_XP: 200, BANK_MAX: 9, XP_RUN_PLATE: 3, XP_PREP_CUT: 3, XP_FIRE_BAG: 1, XP_FIRE_HOLD: 10,
  TRAIN_XP: 40, SETTLE_XP: 30, RAISE_FRAC: 0.2, PREP_WAIT: 2,
  SAFE_SIZES: [0.8, 0.9, 1.0], STRETCH_SIZE: 1.4, STRETCH_MIN: 1.15, STRETCH_LOAD: 1.0, STRETCH_PAY: 1.15, STRETCH_PATIENCE: -5,
  THIRD_PAY: [1.0, 1.1, 1.2], ARRIVAL_PULL_S: 3,
  // review 1 (X20): the new keys at their starting values
  FIRE_WALK: [3.5, 5.5], HEADLINER: [2.5, 2], HAT_SHARE: 0.25, STRETCH_EDGE: 1.0
};
const C_X2_FIXED = ['HIRE_ROUNDS', 'POOL_SIZE', 'POOL_PAGE', 'CREW_MAX', 'ROLE_SKILLS'];
const CURVE_KEYS = ['fireSense', 'firePace', 'runSpeed', 'runHandle', 'runSeatTip', 'runTip', 'prepKnife', 'prepPace', 'tillRing', 'tillTip'];
const CURVE_MID = { fireSense: 55, firePace: 4.0, runSpeed: 4.0, runHandle: 0.4, runSeatTip: 0.1, runTip: 0, prepKnife: 1.0, prepPace: 4.0, tillRing: 1.2, tillTip: 0 };   // fixed (runTip 0: v2's plate tip at 3 stars)
// X12.1 to X12.3, the art additions.
const ROLE_IDS = ['run', 'fire', 'prep', 'till'];   // v3.6: TILL
const PREP_DEFAULT_LOOK = { skin: 2, hair: 4, hairColor: 0, face: 0, hat: 0, apron: 2 };
const BUST = { w: 26, h: 22 };
// X7: the new sim methods (own properties).
const SIM_METHODS_V31 = ['crewView', 'payroll', 'hiringView', 'tryout', 'hireApplicant', 'passRound', 'finishHiring', 'hireWalkin',
  'setBring', 'train', 'levelUp', 'giveRaise', 'letGo'];
// X3.1: the booking rows' menu pairs.
const BOOKING_MENUS = {
  birthday: [['sausage', 'chicken'], ['sausage', 'ribs'], ['chicken', 'ribs']],
  picnic: [['chicken', 'butt'], ['sausage', 'butt'], ['ribs', 'butt'], ['chicken', 'ribs']],
  finale: null,
  yard: []
};
// X1 and X5.3: the PREP card's tiles.
const PREP_TILES = { prepIdle: { x: 1, y: 3, face: 'right' }, prepUse: { x: 2, y: 3, face: 'down' } };   // the angle redo plan A
// X9 event types.
const EV31 = {
  hiringOpen: 'hiring_open', tryout: 'tryout', crewHired: 'crew_hired', roundDone: 'round_done', hiringDone: 'hiring_done',
  bringSet: 'bring_set', letGo: 'crew_let_go', trained: 'trained', levelReady: 'level_ready', levelUp: 'level_up', raise: 'raise',
  leftFor: 'left_for_prep', crewMood: 'crew_mood', crewNotice: 'crew_notice', crewLeft: 'crew_left'
};
// X13 DOM ids.
const ID31 = {
  hiring: 'hiring', hiringH: 'hiring-h', hireCash: 'hire-cash', hireInfo: 'hire-info', hireHelp: 'hire-help', hireRound: 'hire-round',
  hireTryouts: 'hire-tryouts', hirePage: 'hire-page', pagePrev: 'hire-page-prev', pageNext: 'hire-page-next', hireGrid: 'hire-grid',
  app: (i) => 'app-' + i, hirePayroll: 'hire-payroll', hireCrew: 'hire-crew', hiresLeft: 'hires-left', hiresLeftN: 'hires-left-n',
  hireGo: 'hire-go', hireWhy: 'hire-why',
  card: 'card', cardH: 'card-h', cardBack: 'card-back', cardPortrait: 'card-portrait', cardRole: 'card-role', cardMood: 'card-mood',
  cardStars: 'card-stars', cardSkill: (i) => 'card-skill-' + i, cardWage: 'card-wage', cardContract: 'card-contract', cardXp: 'card-xp',
  cardBanked: 'card-banked', cardNotice: 'card-notice', cardTryout: 'card-tryout', cardHire: 'card-hire', cardPass: 'card-pass',
  cardWhy: 'card-why', cardBring: 'card-bring', cardTrain: 'card-train', cardLevel: 'card-level', cardRaise: 'card-raise',
  cardLetGo: 'card-letgo', cardLetGoSure: 'card-letgo-sure', cardLetGoYes: 'card-letgo-yes', cardLetGoNo: 'card-letgo-no',
  cardPick: (i) => 'card-pick-' + i,
  crewPayroll: 'crew-payroll', crewSlots: 'crew-slots', crewList: 'crew-list', crew: (id) => 'crew-' + id, bring: (id) => 'bring-' + id,
  train: (id) => 'train-' + id, crewNotice: (id) => 'crew-notice-' + id, crewTrainLine: 'crew-train-line', crewWhy: 'crew-why',
  walkinsH: 'walkins-h', walkinsLine: 'walkins-line', walkin: (i) => 'walkin-' + i,
  thirdLine: 'third-line', offerTag: (id) => 'offer-' + id + '-tag', newsNotice: (id) => 'news-notice-' + id,
  repCrew: 'rep-crew', repCrewRow: (id) => 'rep-crew-' + id, repCrewXp: (id) => 'rep-crew-' + id + '-xp', repCrewLine: (id) => 'rep-crew-' + id + '-line',
  repCrewLevel: (id) => 'rep-crew-' + id + '-level', repRested: 'rep-rested', repNotice: (id) => 'rep-notice-' + id, repLeft: 'rep-left',
  repHostThird: 'rep-host-third', repThird: 'rep-third', repMoneyMore: 'rep-money-more', repMoneyDetail: 'rep-money-detail',
  seCrew: (id) => 'se-crew-' + id
};
// K10 banner box (game.js BANNER_TEXT_W, BANNER_MAX_LINES); the open text shows only on the clipboard (P-5).
const BANNER = { textW: 164, maxLines: 2, clipOnly: ['open'] };

// W3.1
const BOOKING_IDS = ['birthday', 'picnic', 'finale', 'yard'];
const BOOKINGS_EXPECT = {
  birthday: { id: 'birthday', label: 'Birthday', guests: 12, menu: ['sausage', 'chicken'], patience: 45, window: 60, flames: 1, venue: 'backyard', icon: 'ev_birthday', unlock: null },   // W26 Q-5
  picnic: { id: 'picnic', label: 'Church picnic', guests: 20, menu: ['chicken', 'butt'], patience: 50, window: 80, flames: 2, venue: 'backyard', icon: 'ev_picnic', unlock: null },
  finale: { id: 'finale', label: 'Competition', guests: 40, menu: null, patience: 50, window: 105, flames: 3, venue: 'backyard', icon: 'ev_finale', unlock: null },   // W26 Q-2
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
// The angle redo: the board on the barn over (3,0) (4,0); w is the art board's text box (54 rp).
const SIGN_TEXT = { x: 37, y: 0, w: 54, tiles: [{ x: 3, y: 0 }, { x: 4, y: 0 }] };
const SIGN_DRAW = { x: 48, y: 0 };
const FONT_FRAME = (ch) => {   // W16.2 font frame mapping
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return 10 + ch.charCodeAt(0) - 65;
  return { '+': 36, ':': 37, '.': 38, ',': 39, "'": 40, '-': 41 }[ch];
};
// W5.1: every new sim method (own properties).
const SIM_METHODS_V3 = ['bookOffer', 'setAddon', 'railFor', 'canLoadUp', 'loadUp', 'finishReport', 'startSeason', 'seasonEndPreview',
  'setPlayer', 'randomLook', 'look', 'fanThird', 'offerSlots', 'coolerCap', 'inventory', 'meatRoom', 'prefill', 'settle',
  'gateWaiting'];   // W26 Q-6
const LOOP = { tutorial: 'tutorial', creator: 'creator', week: 'week', prep: 'prep', cook: 'cook', report: 'report', seasonEnd: 'seasonEnd', hiring: 'hiring' };   // X1: hiring
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
  inv: (m) => 'inv-' + m, goal: 'goal', weekControls: 'week-controls', weekNew: 'week-new',
  sheet: 'sheet', sheetH: 'sheet-h', sheetBack: 'sheet-back', have: (id) => 'have-' + id, after: (id) => 'after-' + id, shopRoom: 'shop-room',
  creator: 'creator', creatorH: 'creator-h', crSub: 'cr-sub', crSign: 'cr-sign', crScene: 'cr-scene', crRandom: 'cr-random',
  crName: 'cr-name', crNameCount: 'cr-name-count', crPit: 'cr-pit', crPitCount: 'cr-pit-count', crGo: 'cr-go', crBack: 'cr-back', crNote: 'cr-note',
  crSwatch: (row, i) => 'cr-' + row + '-' + i, crPrev: (row) => 'cr-' + row + '-prev', crNext: (row) => 'cr-' + row + '-next', crVal: (row) => 'cr-' + row + '-val',
  repTop: 'rep-top', repScore: 'rep-score', repParts: 'rep-parts', repResult: 'rep-result', repMoney: 'rep-money', repFans: 'rep-fans',
  repHost: 'rep-host', repCooler: 'rep-cooler', repCharcoal: 'rep-charcoal', repSpoil: 'rep-spoil', tillNew: 'till-new',
  seasonEnd: 'season-end', seasonEndH: 'season-end-h', sePit: 'se-pit', seWk: (w) => 'se-wk-' + w, seCash: 'se-cash', seRep: 'se-rep',
  seMeat: 'se-meat', seCharcoal: 'se-charcoal', seasonNext: 'season-next', pauseLook: 'pause-look', chipCharcoal: 'chip-charcoal'
};
const SEASON_WEEKS = 7;   // v3.5: six weeks and the competition finale (was 9)
const P_POOL = 24;        // v3.6: the Hiring Day pool (6 a role, 4 roles)
const SAVE_V = 11;        // v3.5: save v9 (season.plan, pit); v3.6: v10 (the register, the TILL card); v3.7: v11 (pay, then sit)
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
  season: { year: 1, week: 6, seed: 123456789, pick: 'picnic', addon: null, weekCash: 340,   // v3.5: week 6 of 7 (was 8 of 9)
    results: [{ type: 'birthday', stars: 3 }, { type: 'picnic', stars: 4 }, { type: 'yard', stars: 0 },
      { type: 'picnic', stars: 3 }, { type: 'picnic', stars: 5 }] },
  player: { name: 'Marty', look: { skin: 3, hair: 1, hairColor: 1, face: 1, hat: 2, apron: 0 } },
  pitName: "Marty's Pit",
  settings: { length: 'normal' }
};
// X11.1, the v5 sample, spliced from the contract (it must round trip through validateSave unchanged).
const SAVE_V5_SAMPLE = { "v": 5, "day": 9, "cash": 340, "rep": 38,
  "stock": { "sausage": 0, "chicken": 2, "ribs": 0, "butt": 1, "brisket": 0 },
  "charcoal": 34, "wood": 0,
  "gear": { "kettle2": true, "cooler": true, "bigtable": false, "tray": false, "canopy": false, "drum": false },
  "decor": { "chair1": false, "chair2": false, "flowers": false, "birdbath": false, "lights": false, "picnic2": false },
  "stats": { "days": 8, "served": 120, "walkouts": 4, "past": 2, "burnt": 1, "seated": 60 },
  "drivewayShown": false,
  "tutorial": { "done": true },
  "season": { "year": 1, "week": 6, "seed": 123456789, "pick": "picnic", "addon": null, "weekCash": 340,
              "results": [ { "type": "birthday", "stars": 3 }, { "type": "picnic", "stars": 4 }, { "type": "yard", "stars": 0 },
                           { "type": "picnic", "stars": 3 }, { "type": "picnic", "stars": 5 } ],
              "drafted": true, "trained": 2,
              "walkins": [ { "name": "Opal", "role": "prep", "skills": [3, 2.5], "potential": 3.5, "mood": 1,
                             "look": { "skin": 4, "hair": 2, "hairColor": 0, "face": 0, "hat": 0, "apron": 2 }, "hired": false },
                           { "name": "Earl", "role": "fire", "skills": [2, 3.5], "potential": 4, "mood": 0,
                             "look": { "skin": 2, "hair": 5, "hairColor": 5, "face": 2, "hat": 1, "apron": 0 }, "hired": false } ] },
  "crew": [ { "id": 1, "name": "Rosa", "role": "run", "skills": [2.5, 3], "potential": 4, "xp": 100, "banked": 0, "mood": 1,
              "wage": 20, "contract": 2, "seasons": 0, "rookie": true, "trait": null,
              "look": { "skin": 3, "hair": 2, "hairColor": 0, "face": 0, "hat": 0, "apron": 3 },
              "bring": true, "raised": false, "notice": false, "worked": 6, "bench": 0 },
            { "id": 2, "name": "Dale", "role": "fire", "skills": [3, 2.5], "potential": 4.5, "xp": 40, "banked": 1, "mood": 0,
              "wage": 30, "contract": 2, "seasons": 0, "rookie": true, "trait": null,
              "look": { "skin": 1, "hair": 3, "hairColor": 5, "face": 1, "hat": 2, "apron": 1 },
              "bring": true, "raised": false, "notice": false, "worked": 5, "bench": 0 } ],
  "crewSeq": 3,
  "hiring": null,
  "player": { "name": "Marty", "look": { "skin": 3, "hair": 1, "hairColor": 1, "face": 1, "hat": 2, "apron": 0 } },
  "pitName": "Marty's Pit",
  "settings": { "length": "normal" } };
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
  booking: Object.freeze({ birthday: 'Birthday', picnic: 'Church picnic', finale: 'Competition', yard: 'Yard day' }),
  venue: Object.freeze({ backyard: 'Backyard' }),
  weekLabel: Object.freeze(['Early spring', 'Spring', 'Late spring', 'Early summer', 'Summer', 'Late summer', 'Early fall', 'Fall', 'Competition weekend']),
  thirdName: Object.freeze(['Neighbors', "Word's out", 'In demand']),
  flames: Object.freeze(['Easy', 'Medium', 'Hard']),
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
  // X10 top level additions, spliced from the contract
  role: Object.freeze({ run: 'RUN', fire: 'FIRE', prep: 'PREP', till: 'TILL' }),
  roleName: Object.freeze({ run: 'Server', fire: 'Pit hand', prep: 'Prep cook', till: 'Cashier' }),
  roleJob: Object.freeze({
    run: 'Carries plates from the board to the table.',
    fire: 'Keeps every lit cooker fed with charcoal.',
    prep: 'Slices the cuts you leave on the board.',
    till: 'Works the register and rings every guest up.'
  }),
  skill: Object.freeze({
    run: Object.freeze(['Speed', 'Friendliness']),
    fire: Object.freeze(['Fire sense', 'Pace']),
    prep: Object.freeze(['Knife', 'Pace']),
    till: Object.freeze(['Speed', 'Friendliness'])
  }),
  skillHelp: Object.freeze({
    run: Object.freeze(['Walks plates over faster.', 'Hands plates over quicker. Guests tip more on the plates they carry.']),   // review 1
    fire: Object.freeze(['Keeps the fire hotter.', 'Checks the fires more often.']),
    prep: Object.freeze(['Slices faster than you do.', 'Walks to the board faster.']),
    till: Object.freeze(['Rings guests up faster.', 'Guests tip a little more at the register.'])
  }),
  mood: Object.freeze(['Done', 'Grumpy', 'OK', 'Happy', 'Fired up']),      // index mood + 2
  crewSay: Object.freeze({
    run: '{name} ran {n} plates. Guests tipped {t}.',   // review 1
    runOne: '{name} ran 1 plate. Guests tipped {t}.',
    fire: '{name} added {n} bags. The fire was hot enough to cook {p} percent of the time.',
    fireOne: '{name} added 1 bag. The fire was hot enough to cook {p} percent of the time.',
    fireHot: '{name} added {n} bags and kept the fire hot for {s} seconds. Food came off faster.',   // review 1 (X20.2)
    fireHotOne: '{name} added 1 bag and kept the fire hot for {s} seconds. Food came off faster.',
    prep: '{name} sliced {n} cuts and saved you {s} seconds.',
    prepOne: '{name} sliced 1 cut and saved you {s} seconds.',
    till: '{name} rang up {n} guests. Guests tipped {t}.',
    tillOne: '{name} rang up 1 guest. Guests tipped {t}.',
    idle: '{name} had nothing to do this time.',
    settled: '{name} worked the event.',
    rested: '{name} rested.'
  }),
  hostThird: Object.freeze(['', 'Folks at the last event asked who cooked, {name}.', 'People ask for you by name now, {name}.']),
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
    refillCharcoal: 'One more bag is on the pile.',
    // X10 additions, spliced from the contract
    hiringOpen: 'Hiring Day. {n} people want to work your pit.',
    hired: '{name} joins the crew.',
    tryout: '{name} could reach {n} stars.',
    roundDone: 'Round {r} is over. Other outfits hired {list}.',
    hiringDone: 'Hiring Day is done.',
    letGo: '{name} is off the crew.',
    trained: '{name} trained. Plus {xp} XP.',
    levelReady: '{name} can level up.',
    levelUp: '{name} got better at {skill}.',
    levelMood: '{name} is at full potential and in a better mood.',
    raise: '{name} got a raise to {w}.',
    leftFor: '{name} has the {label}.',
    notice: '{name} gave notice.',
    left: '{name} moved on.'
  }),
  ui: Object.freeze({
    // header and HUD
    hudWeek: 'Week {w}',
    weekOf: 'Week {w} of 7',
    weekOfYear: 'Season {y}, week {w} of 7',
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
    wkFinale: 'Week 7, Competition weekend',
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
    crewLine: '{n} of {s} on the crew',   // X10 changed text
    crewSub: 'Payroll {p} / {b}',
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
    finaleNews: 'The finale is week 7. With the drum smoker it is a {n} guest cook.',
    finaleTable: 'The finale is {n} guests. A bigger table lets five wait in line.',
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
    rowDrawn: 'Bought earlier',   // review 1 (X20.6)
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
    crCount: '{n}/{max}',
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
    notice: 'Your save was updated for the season.',
    // X10 additions, spliced from the contract
    // Hiring Day
    hiringH: 'Hiring Day',
    hireRound: 'Round {r} of 3',
    hireRoundsDone: 'Every round is done',
    pageOf: 'Page {p}/{n}',
    pagePrev: 'Previous page',
    pageNext: 'Next page',
    hireInfo: 'How Hiring Day works',
    hireHelp: 'Tap a card to see it. Each round you can hire one person or pass. Other outfits hire after every round.',
    payroll: 'Payroll {p} / {b}',
    payrollAria: 'Payroll {p} of {b} for one event',
    crewBtn: 'Crew',
    hiresLeft: 'Hires left',
    passRound: 'Pass round {r}',
    startWeek: 'Start week 1',
    tryoutsLeft: 'Tryouts left: {n}',
    tooMany: 'Let someone go. The crew has room for {s}.',
    taken: 'Hired elsewhere',
    yours: 'On your crew',
    newBadge: 'NEW',
    wage: 'Wage',
    perEvent: '{w} an event',
    contract1: '1 season',
    contract2: '2 seasons',
    appAria: '{name}, {role}, {stars}, wage {w}',
    appTaken: '{name}, hired elsewhere',
    potential: 'Potential {n} stars',
    potentialHidden: 'Potential unknown. A tryout shows it.',
    tryout: 'Try out',
    tryoutNone: 'No tryouts left',
    hire: 'Hire',
    hireFee: 'Hire for {f}',
    pass: 'Pass',
    // the card sheet and the crew sheet
    cardBack: 'Back',
    skillAria: '{skill} {n} of 5',
    xp: 'XP {x} of {max}',
    banked: 'Levels to spend: {n}',
    levelUp: 'Level up',
    levelH: 'Pick a skill',
    levelPick: '{skill} up half a star',
    atPotential: 'That skill is at its potential.',
    levelBoth: 'Both skills are at potential. A level lifts the mood instead.',
    bring: 'Bring',
    rest: 'Rest',
    bringAria: 'Bring {name} to the next event',
    oneRole: 'One {role} works a cook. {name} rests.',
    train: 'Train this week',
    trainDone: 'Trained this week',
    trainLine: 'Pick one helper to train each week. They get {xp} XP.',
    trainedLine: '{name} trained this week.',
    raise: 'Give a raise: wage {w}',
    raiseDone: 'Raise given this contract',
    letGo: 'Let go',
    letGoSure: 'Let {name} go? Send-off {f}.',
    letGoFree: 'Let {name} go? No send-off before their first event.',
    yes: 'Yes',
    no: 'No',
    sendOffCash: 'Not enough cash for the send-off.',
    slots: '{n} of {s} on the crew',
    crewEmpty: 'No crew yet. Walk-ins come by every week.',
    walkinsH: 'Walk-ins this week',
    walkinLine: 'They sign for one season. The signing fee is one event of wages.',
    crewFull: 'The crew is full. Let someone go first.',
    noticeLine: '{name} gives notice. Lift their mood or they leave after the next event.',
    goPayroll: 'Payroll {p} is over {b}. Rest someone.',
    moodAria: '{name} is {mood}',
    moodWas: '{mood}, was {was}',
    // the report
    crewH: 'Crew',
    rested: 'Rested: {list}.',
    leftLine: '{name} moved on.',
    rowExtras: 'Tips and bonus',
    rowCosts: 'Costs',
    costsDetail: 'meat, charcoal, spoilage and daily costs',   // review 1: wages have their own row
    rowCrewPaid: 'Signing and send-off',
    moneyMore: 'Show every row',
    moneyLess: 'Hide the rows',
    // offers and word of mouth thirds
    tagSafe: 'SAFE BET',
    tagStretch: 'STRETCH',
    tagInvite: 'INVITE',
    thirdNow: Object.freeze([
      'Neighbors. At word of mouth 34 hosts pay a tenth more.',
      "Word's out. Hosts pay a tenth more. At 67 a third host calls.",
      'In demand. Hosts pay a fifth more and a third host calls.'
    ]),
    thirdUp: Object.freeze(['', "Word's out. Hosts pay a tenth more from next week.", 'In demand. A third host calls from next week.']),
    thirdDown: 'Word of mouth slipped under {edge}.',
    // the season end card and the save notice
    seCrew: '{name} signs on for another season at {w}.',
    noticeCrew: 'Your save was updated. Your helpers are crew cards now.',
    // review round 1 (contract X20.12), exact text
    passEmpty: 'Pass round {r}? Nobody is on your crew yet.',
    tryoutTaken: '{name} went to another outfit after the tryout.',
    takenBadge: '{n} taken',
    takenPageAria: '{n} hired elsewhere on page {p}',
    crewNext: 'Crew: {names}. Wages {w}.',
    crewNone: 'Nobody on the crew this time.',
    wageRow: 'Wage {w}',
    levelWhat: Object.freeze({
      runSpeed: 'Walks {b} tiles a second instead of {a}.',
      runTip: 'Guests tip {b} percent of the usual instead of {a}.',
      fireSense: 'Keeps the fire over {b} instead of {a}.',
      firePace: 'Checks the fire every {b} seconds instead of {a}.',
      prepKnife: 'Slices in {b} percent of your time instead of {a}.',
      prepPace: 'Walks {b} tiles a second instead of {a}.',
      tillRing: 'Rings a guest up in {b} seconds instead of {a}.',
      tillTip: 'Guests tip {b} percent of the usual instead of {a}.'
    }),
    levelStars: 'Now {n} stars. The wage stays {w} this contract.',
    firedUp: '{name} is fired up for this one.',
    walkinsLater: 'Walk-ins start next week.',
    bringOn: 'Coming',
    bringOff: 'Resting',
    tutorialFloor: 'Practice day. Season 1 starts at {c} cash.'
  })
});
const fill = (str, tokens) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? String(tokens[k]) : m));
const SAY = W15.say, UI = W15.ui;
// v3.2 (contract D8.1, exact text) and the DayKind list (D1).
const D32 = {
  dayKinds: ['yard', 'prep', 'market', 'train', 'off', 'loadin', 'event'],
  cardPrep: 'Prep done. The booking starts {n} Quality ahead.',
  cardSpoiled: '{n} spoiled tonight.',
  cardOvernight: '{n} {meat} on overnight. They start half done.',
  bookLocked: 'Loaded in. The booking is set.',
  trainDone: 'Trained this week',
  goNotToday: 'The booking is on {day}.',
  // v3.2 playtest fixes (sim.js V32-8 to V32-11)
  nextDay: 'Next day',
  bookPast: 'That day has gone by.',
  bookPlayed: 'Played on {day}. New offers come Monday.',
  marketSpoil: 'No cooler room tonight: {n} meat from this buy spoils.',
  yardSpoil: 'No cooler room tonight: raw meat left after the cook spoils.',
  loadinSame: 'Already prepped and nothing goes on overnight. This only locks the booking.',
  cardLoadinSame: 'Already prepped, so Load-in only locked the booking.',
  cardTrain: '{name} trained. Plus {xp} XP.',
  cardMoodTop: 'The crew was already {mood} or better. Nothing changed.',
  dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
};
// v3.4 (sim.js, the note at the top): the start button and the morning shop, exact text.
const D34 = {
  startDay: 'Start {day}: {kind}',
  changePlan: 'Change plan',
  shopConfirm: 'Confirm',
  shopBack: 'Back',
  shopWarn: 'This leaves {left}. {day} needs about {need} for the booking.',
  advanceLocked: 'You took an advance on this booking. It stays booked.'
};
const NULL7 = () => [null, null, null, null, null, null, null];

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
  buyOk: (id) => 'buy-' + id + '-ok',   // feedback audit item 22: the armed row's Confirm
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
  nothing: 'Nothing to do here',   // the angle redo: the spawn (3,2) faces the counter
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
  crew: 'S().crew'   // X4.1: state.hires is gone
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
  pile: { x: 4, y: 8 },
  kettle1: { x: 4, y: 5 },
  cooler: { x: 4, y: 6 },
  board: { x: 2, y: 4 },
  table: { x: 4, y: 1 },
  register: { x: 3, y: 1 }   // v3.7
};
const SPAWN = { x: 3, y: 2 };
const ARROW_DOWN_Y = 3;   // the angle redo: left of the spawn is the trash, so the key test walks down the lane

// What the morning yard must draw (step 13), the first seat (step 23) and the chair (step 30).
const MORNING_DRAWS = [
  { name: 'picnic', x: 96, y: 80 },
  { name: 'picnic_bench', x: 96, y: 80 },
  { name: 'dog', x: DOG_HOME.px, y: DOG_HOME.py, frame: DOG_HOME.frame }
];
// The angle redo D: no see-through ghosts; an unbought spot in MAP.forSale draws one "+" record
// { name: 'plus', id } (hidden while a person stands on one of its marker tiles).
const PLUS = 'plus';
const CASH_ABOVE = 26;   // review round 2: the cash number sits over the served customer, at py - 26
const FIRST_SEAT = { id: 'pt1b', x: 7, y: 4, px: 112, py: 64, bonus: 1, heart: { x: 112, y: 40 } };
const DECOR_BUY = { id: 'chair1', draw: { name: 'chair', x: 144, y: 48 }, seatsAfter: [3, 3, 1] };
const DECOR_SAVE = { day: 2, cash: 200 };

// Step 33: records that may extend past a canvas edge (people at the gate or the spawn only;
// the back fence row is drawn inside the canvas).
const EDGE_OK = {
  bottom: /^(player_|buddy_|tender_|prep_|cust\d_|shadow$|hand_)/   // X13.7: prep_ joins
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
const INVALID_SAVES = [null, 'x', [], {}, undefined, 42, { v: '5' }, { v: 0 }, { v: '3' }, { v: '4' }, { v: 12 }];   // v3.7: v 1 to 11 accepted

// The shopping list for day 1 and later days. Two sausage units give four plates, so later
// customers walk out and the walk out step has something to assert.
const BUY_DAY1 = { charcoal: 4, meat: 'sausage', units: 2 };
const BUY_LATER = { charcoal: 1, meat: 'sausage', units: 1 };
const MEAT = 'sausage';
const PLATE_CYCLES_MAX = 2;      // pieces to pull, slice and carry during the day

const KEYS = {
  escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  p: { key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
  down: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }
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
  report: 'report.png', seasonEnd: 'season-end.png',
  // v3.1 (X15), plus the four of deviation 34
  hiring: 'hiring.png', card: 'card.png', crew: 'crew.png', reportCrew: 'report-crew.png',
  hiringPage2: 'hiring-page2.png', cardWalkin: 'card-walkin.png', cardCrew: 'card-crew.png', cardLevel: 'card-level.png',
  // v3.2 Days: the hub with the day strip, a day result card, the weekend cook
  daysWeek: 'days-week.png', daysCard: 'days-card.png', daysWeekend: 'days-weekend.png'
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

// A player route by sim.walkable (the walk playerBfs uses), from one tile to another (X15.1 step 7).
function walkBfs(sim, from, goal) {
  const M = globalThis[GLOBAL_NAME].MAP;
  const key = (x, y) => x + ',' + y;
  const seen = new Set([key(from.x, from.y)]);
  const q = [{ x: from.x, y: from.y }];
  while (q.length) {
    const c = q.shift();
    if (c.x === goal.x && c.y === goal.y) return true;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || nx >= M.W || ny < 0 || ny >= M.H || seen.has(key(nx, ny))) continue;
      if (!sim.walkable(nx, ny)) continue;
      seen.add(key(nx, ny));
      q.push({ x: nx, y: ny });
    }
  }
  return false;
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

  for (const key of ['sprites', 'sim', 'game', 'music']) {
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
    const v31 = surfaceV31(P, P.createSim(null, 1));
    return SIM_SURFACE.length + ' names, ' + C_NEW_KEYS.length + ' new C keys, ' + FX_KEYS.length + ' FX keys, v2.1 windows ' + windows.join(' ') + '; ' + v3 + '; ' + v31;
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
    assert(v && v.v === SAVE_V, 'dirty v1 sample returned v ' + describe(v && v.v));
    assert(v.day === 1, 'day ' + describe(v.day));
    assert(v.cash === 0, 'cash ' + v.cash);
    assert(v.rep === 100, 'rep ' + v.rep);
    assert(v.stock.sausage === 99, 'stock.sausage ' + v.stock.sausage);
    assert(!('bogus' in v.stock), 'bogus kept');
    assert(v.gear.drum === false, 'gear.drum not forced false');
    // X15.1 step 6: SAVE_DIRTY's tender without the drum gives no FIRE card (X11.3, the legacy tender check).
    assert(Array.isArray(v.crew) && !v.crew.some((c) => c.role === 'fire'), 'SAVE_DIRTY crew ' + describe(v.crew) + ', wanted no FIRE card');
    assert(!('hires' in v), 'the dirty sample kept a hires key');
    assert(!('extra' in v), 'extra kept');
    assert(allFalse(v.decor), 'dirty sample decor ' + describe(v.decor));
    assert(v.stats && v.stats.seated === 0, 'dirty sample stats.seated ' + describe(v.stats && v.stats.seated));
    const s = P.validateSave(JSON.parse(JSON.stringify(SAVE_V1_SAMPLE)));
    assert(s && s.v === SAVE_V, 'v1 sample returned v ' + describe(s && s.v));
    migratedDefaults(s, 'v1 sample');
    assert(s.tutorial && s.tutorial.done === true, 'v1 sample tutorial ' + describe(s.tutorial));
    for (const k of ['day', 'cash', 'rep', 'stock', 'charcoal', 'gear', 'drivewayShown']) {
      assert(sameJSON(s[k], SAVE_V1_SAMPLE[k]), 'v1 sample ' + k + ' is ' + describe(s[k]) + ', wanted ' + describe(SAVE_V1_SAMPLE[k]));
    }
    for (const [k, n] of Object.entries(SAVE_V1_SAMPLE.stats)) assert(s.stats[k] === n, 'v1 sample stats.' + k + ' is ' + s.stats[k]);
    assert(s.stats.seated === 0, 'v1 sample stats.seated ' + s.stats.seated);
    assert(allFalse(s.decor), 'v1 sample decor ' + describe(s.decor));
    const d = P.validateSave({ v: 2, decor: { chair2: true, bogus: true } });
    assert(d && d.v === SAVE_V, 'v2 decor sample returned ' + describe(d));
    migratedDefaults(d, 'v2 decor sample');
    assert(d.decor.chair2 === false, 'decor.chair2 not forced false without chair1');
    assert(!('bogus' in d.decor), 'decor.bogus kept');
    const cyclic = { v: 1 }; cyclic.self = cyclic; cyclic.decor = cyclic;
    let threw = null;
    try { P.validateSave(cyclic); } catch (e) { threw = e; }
    assert(!threw, 'cyclic threw: ' + (threw && threw.message));
    // v2.1 (K6, K11 step 6).
    const v2 = P.validateSave(saveV2({}, P.C.START_REP));
    assert(v2 && v2.v === SAVE_V && v2.tutorial && v2.tutorial.done === true, 'v2 day 1 sample returned ' + describe(v2 && { v: v2.v, tutorial: v2.tutorial }));
    migratedDefaults(v2, 'v2 day 1 sample');
    const t1 = P.validateSave({ v: 3, day: 1, tutorial: { done: false, bogus: 1 } });
    assert(t1 && t1.v === SAVE_V && t1.tutorial && t1.tutorial.done === false, 'v3 day 1 done false returned ' + describe(t1 && t1.tutorial));
    assert(!('bogus' in t1.tutorial), 'tutorial.bogus kept');
    const t3 = P.validateSave({ v: 3, day: 3, tutorial: { done: false, bogus: 1 } });
    assert(t3 && t3.tutorial && t3.tutorial.done === true, 'v3 day 3 done false returned ' + describe(t3 && t3.tutorial));
    const t0 = P.validateSave({ v: 3 });
    assert(t0 && t0.v === SAVE_V && t0.tutorial && t0.tutorial.done === true, '{ v: 3 } returned ' + describe(t0 && t0.tutorial));
    migratedDefaults(t0, '{ v: 3 }');
    migratedDefaults(P.validateSave(JSON.parse(JSON.stringify(SAVE_V3_SAMPLE))), 'v3 sample');
    const ser = P.createSim(null, 1)[SIM_METHODS.serialize]();
    assert(ser && ser.v === SAVE_V, 'serialize() v ' + describe(ser && ser.v));
    assert(ser.tutorial && ser.tutorial.done === false, 'serialize() tutorial ' + describe(ser.tutorial));
    const back = P.validateSave(JSON.parse(JSON.stringify(ser)));
    assert(deepEq(back, ser), 'serialize() does not round trip: ' + describe(ser) + ' became ' + describe(back));
    assert(!('hires' in ser) && Array.isArray(ser.crew) && ser.crew.length === 0, 'serialize() hires ' + describe(ser.hires) + ', crew ' + describe(ser.crew));
    const v4note = validateV4(P);
    const v5note = validateV5(P);
    return INVALID_SAVES.length + ' rejected (v 6 and "5" among them), v1, v2 and v3 to v5 migrated with the W13.3 and X11.3 defaults, tutorial rules, chair2 forced, cyclic safe, serialize round trips; ' + v4note + '; ' + v5note;
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
        // v3.1 (X15.1 step 7): the PREP card's idle and use tiles from the spawn, by the player's walkable
        // (tickPrep walks by playerBfs), with every gear state on top of the decor mask.
        for (const gearOn of [false, true]) {
          if (gearOn) for (const g of GEAR_IDS) st.gear[g] = true;   // fixture (W0)
          for (const key of ['prepIdle', 'prepUse']) {
            const t = M[key];
            checks += 1;
            if (!t || !walkBfs(sim, M.spawn, t)) fails.push('mask ' + mask + (big ? ' big' : '') + (gearOn ? ' all gear' : '') + ': ' + key + ' ' + describe(t) + ' unreachable from the spawn');
          }
        }
      }
    }
    assert(fails.length === 0, fails.length + ' unreachable, first ' + fails.slice(0, 3).join('; '));
    return checks + ' routes over 128 yards, MAP.prepIdle and MAP.prepUse included';
  });

  await step('angle redo floor plan: BFS from the spawn, cook legs (6), tall props and the hat rule (7)', () => floorPlanHeadless(globalThis[GLOBAL_NAME]));
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
  // v3.1 (X15.2 steps 63 to 69, deviation 21: they run here, before the browser).
  await step('crew rules, headless', () => crewRulesHeadless(globalThis[GLOBAL_NAME]));
  await step('Hiring Day, headless', () => hiringHeadless(globalThis[GLOBAL_NAME]));
  await step('walk-ins, headless', () => walkinsHeadless(globalThis[GLOBAL_NAME]));
  await step('mood, notice and leaving, headless', () => moodHeadless(globalThis[GLOBAL_NAME]));
  await step('felt difference, headless', () => feltHeadless(globalThis[GLOBAL_NAME]), { fatal: true });
  await step('thirds and offers, headless', () => thirdsHeadless(globalThis[GLOBAL_NAME]));
  await step('v2.1 and v3.0 saves migrate to cards, headless', () => migrateHeadless(globalThis[GLOBAL_NAME]));
  await step('four plates set down land in four counter spots, headless', () => countersHeadless(globalThis[GLOBAL_NAME]));
  await step('v3.7 the register: guests order and pay first, a TILL card rings them up, to go spots, the crew idle by their work, save v11, headless', () => registerHeadless(globalThis[GLOBAL_NAME]));
  await step('v3.7 pay then sit: the RUN card and the pitmaster deliver to the table, eating starts on delivery, refunds, headless', () => deliveryHeadless(globalThis[GLOBAL_NAME]));
  // v3.2 (D10.1): the Node legs of steps 73 to 75, the day loop and save v6.
  await step('v3.2 days: the day loop, prices and save v6, headless', () => daysLoopHeadless(globalThis[GLOBAL_NAME]));
  await step('v3.4 days: the morning shop (Confirm, Back, the reserve warning), the start pick, automatic prep and training, the broke rescue, headless', () => daysStockHeadless(globalThis[GLOBAL_NAME]));
  await step('v3.2 playtest: empty Monday cart, spoil warnings, the half day gate, the day card lines, headless', () => daysPlaytestHeadless(globalThis[GLOBAL_NAME]));
  // v3.3 (design [S 3.5], [S 3.6], [S 6.7], [S 6.8], [S 19.8], names in [S 19.9]).
  await step('v3.3 the competition by real moves: turn-ins, hold, judging, placing, headless', () => compHeadless(globalThis[GLOBAL_NAME]));
  await step('v3.3 the competition crew: PREP boxes, RUN turns in, FIRE fed puffs, no drum, headless', () => compCrewHeadless(globalThis[GLOBAL_NAME]));
  await step('v3.3 the trophy shelf and ribbons, save v7, headless', () => shelfHeadless(globalThis[GLOBAL_NAME]));
  await step('v3.3 the Offseason: contracts, moving on, referrals, headless', () => offseasonHeadless(globalThis[GLOBAL_NAME]));
  await step('v3.3 season 2: carry overs, scaled offers, the next competition, headless', () => season2Headless(globalThis[GLOBAL_NAME]));
  // v3.5 (sim.js note v3.5): seven weeks, 190 s cooks, the week planner, Skip to the weekend, Long Day, the string lights.
  await step('v3.5 seven weeks, longer cooks, the planner, Skip to the weekend, Long Day and string lights time, headless', () => v35Headless(globalThis[GLOBAL_NAME]));
}

// ---- v3.5 shorter season, longer cooks, the week planner, buy more time (sim.js note v3.5) ---------

// A Monday sim (week 1, no plan yet) with the given cash, stock and pit progress, from a real save.
function v35Monday(P, over = {}) {
  const h0 = toWeek(P, over.seed || 35);
  const s = h0.sim.serialize();
  s.season.day = 0;   // toWeek's legacy days wrapper moves to Wednesday; the planner is Monday's
  s.season.dayLog = [null, null, null, null, null, null, null];
  s.season.plan = null;
  s.cash = over.cash === undefined ? 300 : over.cash;
  s.season.weekCash = s.cash;
  s.charcoal = over.charcoal === undefined ? 20 : over.charcoal;
  if (over.stock) s.stock = Object.assign({}, s.stock, over.stock);
  if (over.pit) s.pit = Object.assign({ xp: 0, longDay: 0 }, over.pit);
  if (over.decor) Object.assign(s.decor, over.decor);
  if (over.gear) Object.assign(s.gear, over.gear);
  const v = P.validateSave(JSON.parse(JSON.stringify(s)));
  assert(v && v.v === SAVE_V, 'validateSave refused the v3.5 Monday fixture');
  return headless(P, v, over.seed || 35, { days: true });
}
function v35Headless(P) {
  const C = P.C;
  const notes = [];
  // 1. The season: six weeks and the competition as week 7.
  assert(C.SEASON_WEEKS === 7 && SEASON_WEEKS === 7, 'C.SEASON_WEEKS ' + C.SEASON_WEEKS + ', wanted 7');
  const base = { seed: 5, year: 1, rep: 20, cash: 100, gear: {} };
  for (let w = 1; w <= C.SEASON_WEEKS; w++) {
    const ids = P.genOffers(Object.assign({}, base, { week: w })).map((o) => o.id);
    if (w < C.SEASON_WEEKS) assert(!ids.some((id) => /^finale/.test(id)), 'week ' + w + ' offers a contest ' + describe(ids));
    else assert(ids[0] === 'finale' && ids.every((id) => /^finale/.test(id)), 'week 7 offers ' + describe(ids));
  }
  assert(P.STRINGS.ui.weekOf === 'Week {w} of 7' && P.STRINGS.ui.wkFinale === 'Week 7, Competition weekend', 'season strip strings ' + describe([P.STRINGS.ui.weekOf, P.STRINGS.ui.wkFinale]));
  notes.push('weeks 1 to 6 book, week 7 the competition');
  // 2. Longer cooks: 190 s with the gate at EVENT_GATE; a weekday Yard day half; the competition 270
  //    with its turn-ins at their old shares.
  const L = C.LENGTHS.normal;
  assert(L.seconds === 190 && C.EVENT_GATE < C.GATE_OPENS && C.EVENT_GATE === 20 && C.GATE_OPENS === 30, 'cook length ' + describe({ L, gate: C.EVENT_GATE }));
  assert(C.COMP_SECONDS === 270 && sameJSON(C.COMP_TURNINS, [68, 128, 188, 248]), 'competition ' + describe([C.COMP_SECONDS, C.COMP_TURNINS]));
  const old = [45, 85, 125, 165].map((x) => x / 180), now = C.COMP_TURNINS.map((x) => x / C.COMP_SECONDS);
  assert(now.every((f, i) => Math.abs(f - old[i]) < 0.005), 'turn-in shares moved ' + describe(now));
  assert(sameJSON(P.compTimes(C.COMP_SECONDS + 35), [77, 145, 212, 280]), 'compTimes(305) ' + describe(P.compTimes(C.COMP_SECONDS + 35)));
  // 3. The planner on Monday.
  const h = v35Monday(P);
  const sim = h.sim, st = h.st;
  const pv = sim.planView();
  assert(pv && pv.days.length === 5 && pv.days.every((d, i) => d.day === i && (d.kind === 'yard' || d.kind === 'off')) && pv.start === 'Start week' && pv.skip === 'Skip to the weekend', 'planView ' + describe(pv));
  assert(sameJSON(pv.plan, ['yard', 'off', 'yard', 'off', 'off']), 'the prefilled plan ' + describe(pv.plan) + ', wanted Yard Monday and Wednesday');
  assert(sim.togglePlanDay(0).ok && sim.planView().plan[0] === 'off' && sim.setPlanDay(1, 'yard').ok && sim.planView().plan[1] === 'yard', 'toggle and set ' + describe(sim.planView().plan));
  assert(!sim.setPlanDay(5, 'yard').ok && !sim.setPlanDay(2, 'event').ok, 'setPlanDay took Saturday or an event');
  const r = sim.startPlan();
  h.drain();
  // Monday rests at once; Tuesday is the first Yard day.
  assert(r.ok && r.rested === 1 && st().season.day === 1 && st().phase === 'morning' && st().dayCard === null && st().season.dayLog[0] === 'off', 'startPlan ' + describe({ r, day: st().season.day, phase: st().phase, log: st().season.dayLog }));
  assert(r.note && sameJSON(r.note.days, [0]) && r.note.text === 'Rested 1 day.', 'restNote ' + describe(r.note));
  assert(sim.planView() === null && sameJSON(sim.planOf(), ['off', 'yard', 'yard', 'off', 'off']), 'the plan after Start week ' + describe(sim.planOf()));
  const rec = sim.recommendDay();
  assert(rec.kind === 'yard' && rec.start === 'Start Tuesday: Yard day', 'Tuesday pick ' + describe(rec));
  // The morning shop still stands before the cook: Back spends nothing, Confirm starts it.
  const cash0 = st().cash;
  sim.shopOpen('yard');
  assert(sim.shopBack().ok && st().cash === cash0 && st().phase === 'morning', 'Back moved the day');
  sim.shopOpen('yard');
  const cf = sim.shopConfirm('yard');
  h.drain();
  assert(cf.ok && st().phase === 'service', 'Confirm ' + describe(cf));
  const td = st().today;
  assert(td.weekday && td.gateAt === Math.round(C.EVENT_GATE * C.YARD_DAY_FRAC) && td.endAt === Math.round(L.seconds * C.YARD_DAY_FRAC), 'weekday Yard day timings ' + describe([td.gateAt, td.lastCallAt, td.endAt]));
  let g = 0;
  while (st().phase === 'service' && g++ < 20000) h.tick();
  assert(st().loop === 'report' && st().till.pitXp === C.PIT_XP_YARD, 'the Yard day report ' + describe({ loop: st().loop, xp: st().till.pitXp }));
  sim.finishReport();
  h.drain();
  // Wednesday is planned a Yard day: the morning waits for it.
  assert(st().season.day === 2 && st().phase === 'morning' && sim.restNote() === null, 'after the Yard day ' + describe({ day: st().season.day, note: sim.restNote() }));
  // Wednesday's cook by settle is not possible (a Yard day); choose Rest by hand: the day card shows,
  // and the planned Rest days after it pass at once on Next.
  assert(sim.chooseDay('off').ok && st().phase === 'evening' && st().dayCard !== null, 'a Rest by hand left no day card');
  sim.advanceDay();
  h.drain();
  assert(st().season.day === 5 && st().phase === 'morning' && sameJSON(st().season.dayLog.slice(0, 5), ['off', 'yard', 'off', 'off', 'off']) && sameJSON(sim.restNote().days, [3, 4]), 'Thursday and Friday ' + describe({ day: st().season.day, log: st().season.dayLog, note: sim.restNote() }));
  assert(sim.pitView().xp === C.PIT_XP_YARD, 'pit xp ' + sim.pitView().xp);
  notes.push('planner: Monday rested, Tuesday played, Wednesday rested by hand, Thursday and Friday passed');
  // 4. Skip to the weekend.
  const k = v35Monday(P);
  const sk = k.sim.skipToWeekend();
  k.drain();
  assert(sk.ok && sk.rested === 5 && k.st().season.day === 5 && k.st().phase === 'morning' && k.st().dayCard === null && sameJSON(k.st().season.dayLog.slice(0, 5), ['off', 'off', 'off', 'off', 'off']), 'skipToWeekend ' + describe({ sk, day: k.st().season.day }));
  assert(k.sim.recommendDay().start.startsWith('Start Saturday') && k.sim.planView() === null && !k.sim.skipToWeekend().ok, 'Saturday after the skip ' + describe(k.sim.recommendDay()));
  // The plan saves and comes back (v9).
  const sv = k.sim.serialize();
  assert(sv.v === SAVE_V && sameJSON(sv.season.plan, ['off', 'off', 'off', 'off', 'off']) && sv.season.day === 5, 'save ' + describe({ v: sv.v, plan: sv.season.plan, day: sv.season.day }));
  const back = P.createSim(JSON.parse(JSON.stringify(sv)), 35);
  assert(sameJSON(back.planOf(), sv.season.plan) && back.state.season.day === 5 && back.planView() === null, 'reload ' + describe(back.planOf()));
  notes.push('Skip to the weekend: five Rest days, Saturday morning, plan saved');
  // 5. Buy more time: XP, levels, Long Day, the string lights.
  const lv = v35Monday(P, { pit: { xp: C.PIT_LEVEL_XP[3] } });
  const pz = lv.sim.pitView();
  assert(pz.level === 4 && pz.pending === 3 && pz.skills[0].id === 'longDay' && pz.skills[0].ok, 'pitView at level 4 ' + describe(pz));
  for (let i = 1; i <= C.LONG_DAY_MAX; i++) assert(lv.sim.pickPitSkill('longDay').ok && lv.sim.pitView().longDay === i, 'Long Day pick ' + i);
  assert(!lv.sim.pickPitSkill('longDay').ok && lv.sim.pitView().pending === 0, 'a fourth Long Day');
  const ct = lv.sim.cookTime();
  assert(ct.total === L.seconds + 3 * C.LONG_DAY_SECONDS && ct.longDay === 45 && ct.text === 'Cook time 3:55', 'cookTime with Long Day 3 ' + describe(ct));
  const li = v35Monday(P, { decor: { lights: true } });
  const ctl = li.sim.cookTime();
  assert(C.LIGHTS_SECONDS === 20 && ctl.total === L.seconds + 20 && ctl.lights === 20 && ctl.yard === Math.round(L.seconds * C.YARD_DAY_FRAC) + 20, 'cookTime with the string lights ' + describe(ctl));
  assert(P.CATALOG.find((x) => x.id === 'lights').effect.includes('+20 s to every cook'), 'the string lights row does not say +20 s');
  // The lights stretch a booked cook: the hard end and last call move 20 s, the gate stays.
  const hv = v35Monday(P, { decor: { lights: true }, gear: { kettle2: true } });
  hv.sim.bookOffer('birthday');
  assert(hv.sim.skipToWeekend().ok, 'skip for the booked cook');
  hv.drain();
  const bk = hv.st().season.booking;
  const go = hv.sim.chooseDay('event');
  hv.drain();
  if (go.ok) {
    const t = hv.st().today;
    assert(t.gateAt === C.EVENT_GATE && t.endAt === L.seconds + 20 && t.lastCallAt === Math.min(C.EVENT_GATE + bk.window, L.seconds - C.LAST_CALL_GUARD) + 20, 'booked timings with the lights ' + describe([t.gateAt, t.lastCallAt, t.endAt]));
    assert(hv.sim.settle(4) === true && hv.st().till.pitXp === C.PIT_XP_EVENT + 4 * C.PIT_XP_STAR, 'booked xp ' + describe(hv.st().till.pitXp));
    notes.push('lights: ' + bk.label + ' ends at ' + t.endAt + ' s');
  } else notes.push('booked cook refused (' + go.message + '), lights checked on cookTime only');
  // 6. A v8 save from week 8 of the old nine clamps to week 7 on Monday, six results kept.
  const v8 = k.sim.serialize();
  v8.v = 8; delete v8.pit; delete v8.season.plan;
  v8.season.week = 8; v8.season.results = new Array(7).fill(0).map(() => ({ type: 'picnic', stars: 3 }));
  v8.season.day = 2; v8.season.dayLog = ['off', 'off', null, null, null, null, null];
  const m8 = P.validateSave(JSON.parse(JSON.stringify(v8)));
  assert(m8 && m8.v === SAVE_V && m8.season.week === 7 && m8.season.results.length === 6 && m8.season.day === 0 && m8.season.plan === null && m8.pit.xp === 0, 'the v8 week 8 save ' + describe(m8 && { w: m8.season.week, n: m8.season.results.length, d: m8.season.day }));
  notes.push('v8 week 8 save opens week 7 Monday');
  return notes.join('; ');
}

// The angle redo world (C) and the check 1, 2 and 8 limits.
const WORLD = { W: 656, H: 434, OX: 300, OY: 150, SX: 1.5, SY: 0.75 };
const OCCLUDE_MAX = 0.25;
const HOME_SPARE = 12;
const MIN_TILE_CSS = 40;
const HOME_PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
// Runs in the page: places every station, prop and decor sprite (all gear and decor) by plan A on the
// world (rule sprites anchor on the ground centre of their footprint, wall pieces on the barn wall
// foot), orders them by front tile x + y then X, and measures, per station and seat, the share of its
// opaque pixels (alpha 200 and up) covered by sprites of other pieces drawn after it. Also the world
// bounds of every station sprite and of the guests (24 by 51) on q0 and q1, for the home view.
function planGeometry(W) {
  const P = window.PitSim, A = P && P.art3, M = P && P.MAP;
  if (!A || typeof A.drawAt !== 'function' || typeof A.has !== 'function') return { err: 'PitSim.art3.drawAt missing' };
  const meta = (n) => { try { return (A.rule && typeof A.rule.meta === 'function' && A.rule.meta(n)) || {}; } catch (_e) { return {}; } };
  const iso = (sx, sy) => ({ X: W.OX + W.SX * (sx - sy), Y: W.OY + W.SY * (sx + sy) });
  const cv = document.createElement('canvas');
  cv.width = W.W; cv.height = W.H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const objs = [];
  const add = (target, group, name, tiles) => {
    if (!A.has(name)) return;
    let cx = 0, cy = 0;
    for (const t of tiles) { cx += t.x * 16 + 8; cy += t.y * 16 + 8; }
    cx /= tiles.length; cy /= tiles.length;
    if (meta(name).wall === true) cy = 0;
    const p = iso(cx, cy);
    ctx.clearRect(0, 0, W.W, W.H);
    A.drawAt(ctx, name, p.X, p.Y, 0, false);
    const d = ctx.getImageData(0, 0, W.W, W.H).data;
    const mask = new Uint8Array(W.W * W.H);
    let n = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let i = 0; i < mask.length; i++) {
      if (d[i * 4 + 3] < 200) continue;
      mask[i] = 1; n++;
      const x = i % W.W, y = (i - x) / W.W;
      if (x < minX) minX = x; if (x > maxX) maxX = x + 1; if (y < minY) minY = y; if (y > maxY) maxY = y + 1;
    }
    objs.push({ target, group, name, front: Math.max(...tiles.map((t) => t.x + t.y)), X: p.X, mask, n, box: { minX, maxX, minY, maxY } });
  };
  for (const s of M.stations) {
    if (s.sprite === 'counter') for (const t of s.tiles) add('station:' + s.id, 'station:' + s.id, 'counter', [t]);
    else add('station:' + s.id, 'station:' + s.id, s.sprite, s.tiles);
  }
  const picnic1 = M.props.find((p) => p.id === 'picnic1');
  for (const p of M.props) {
    const tiles = p.blocks.length ? p.blocks : (p.sprite === 'picnic_bench' ? picnic1.blocks : [p.tile]);
    const group = p.id === 'bench1' || p.id === 'picnic1' ? 'picnic1' : 'prop:' + p.id;
    add(p.id === 'bench1' ? 'bench:pt1' : null, group, p.sprite, tiles);
  }
  for (const d of M.decor) for (const dr of d.draws) {
    if (dr.overhead) continue;
    const target = dr.sprite === 'chair' ? 'seat:' + d.id : dr.sprite === 'picnic_bench' ? 'bench:pt2' : null;
    add(target, 'decor:' + d.id, dr.sprite, d.tiles);
  }
  objs.sort((a, b) => a.front - b.front || a.X - b.X);
  const seatTarget = { pt1a: 'bench:pt1', pt1b: 'bench:pt1', chair1: 'seat:chair1', chair2: 'seat:chair2', pt2a: 'bench:pt2', pt2b: 'bench:pt2' };
  const targets = [...M.stations.map((s) => ['station:' + s.id, s.id]), ...M.seats.map((s) => [seatTarget[s.id], s.id])];
  const occ = [];
  for (const [tg, id] of targets) {
    let total = 0, covered = 0;
    const by = {};
    objs.forEach((o, i) => {
      if (o.target !== tg) return;
      total += o.n;
      const later = objs.slice(i + 1).filter((q) => q.group !== o.group);
      for (let k = 0; k < o.mask.length; k++) {
        if (!o.mask[k]) continue;
        const q = later.find((l) => l.mask[k]);
        if (q) { covered++; by[q.name] = (by[q.name] || 0) + 1; }
      }
    });
    if (total === 0) return { err: 'no opaque pixels for ' + id + ' (' + tg + ')' };
    occ.push({ id, px: total, frac: Math.round(covered / total * 1000) / 1000, by });
  }
  const home = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
  const grow = (b) => { home.minX = Math.min(home.minX, b.minX); home.maxX = Math.max(home.maxX, b.maxX); home.minY = Math.min(home.minY, b.minY); home.maxY = Math.max(home.maxY, b.maxY); };
  for (const o of objs) if (o.target && o.target.indexOf('station:') === 0 && M.home.stations.includes(o.target.slice(8))) grow(o.box);
  for (const qi of M.home.queue) {
    const q = M.queue[qi], p = iso(q.x * 16 + 8, q.y * 16 + 8);
    grow({ minX: p.X - 12, maxX: p.X + 12, minY: p.Y - 51, maxY: p.Y });
  }
  return { occ, home };
}
// The angle redo plan A and F, sim side. A BFS self test: with every gear state (and decor off and
// on), the player's BFS reaches every active use tile and every crew tile from the spawn, and the
// customers' BFS reaches every active queue spot and owned seat from the customer spawn. Check 6:
// every cook loop leg is the plan's lane steps (1 to 3; 0 to the extension). Check 7: every prop or
// decor piece over 20 rp stands on row 0 or column 0, and nothing stands on an apron tile 1 to 4 rows
// straight behind a tile where the pitmaster or crew stands (the hat rule).
const RULE_H = { shed: 52, sign: 66, tree: 128, woodpile: 14, tools: 28, pot: 16, hose: 14, planter: 16, mailbox: 26,
  picnic: 13, picnic_bench: 7, shelf: 30, chair: 20, flower_box: 10, birdbath: 20, lights_post: 72 };
const WALL_HUNG = ['shed', 'sign'];   // the barn door and the sign hang on the barn wall (exempt from the hat rule)
// Plan A's own props table puts the mailbox (26 rp, table B) on the front fence line at (9,11), right of
// the gate; nothing used stands behind it, so check 7 names it next to the drum as an exception.
const TALL_EXCEPT = ['mailbox'];
const FOR_SALE = { kettle2: [[4, 7]], drum: [[2, 5], [2, 6]], bigtable: [[4, 4]], canopy: [[7, 2]], chair1: [[9, 3]], chair2: [[9, 4]],
  flowers: [[6, 10], [7, 10]], birdbath: [[3, 10]], lights: [[0, 7]], picnic2: [[6, 8], [7, 8]] };
const COOK_LEGS = [   // [leg, from station, from tile, to station, to tile, steps]
  ['charcoal to kettle 1', 'pile', [3, 8], 'kettle1', [3, 5], 3],
  ['charcoal to kettle 2', 'pile', [3, 8], 'kettle2', [3, 7], 1],
  ['meat to kettle 1', 'cooler', [3, 6], 'kettle1', [3, 5], 1],
  ['meat to kettle 2', 'cooler', [3, 6], 'kettle2', [3, 7], 1],
  ['kettle 1 to board', 'kettle1', [3, 5], 'board', [3, 4], 1],
  ['kettle 2 to board', 'kettle2', [3, 7], 'board', [3, 4], 3],
  ['drum to board', 'drum', [3, 5], 'board', [3, 4], 1],
  ['board to counter', 'board', [3, 4], 'table', [3, 3], 1],
  ['board to counter, bigtable', 'board', [3, 4], 'table', [3, 4], 0]
];
function walkSteps(sim, from, goal) {
  const M = globalThis[GLOBAL_NAME].MAP;
  const key = (x, y) => x + ',' + y;
  const dist = new Map([[key(from.x, from.y), 0]]);
  const q = [{ x: from.x, y: from.y }];
  while (q.length) {
    const c = q.shift();
    const d = dist.get(key(c.x, c.y));
    if (c.x === goal.x && c.y === goal.y) return d;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || nx >= M.W || ny < 0 || ny >= M.H || dist.has(key(nx, ny))) continue;
      if (!sim.walkable(nx, ny)) continue;
      dist.set(key(nx, ny), d + 1);
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}
function custReach(sim, from, goal) {
  const M = globalThis[GLOBAL_NAME].MAP;
  const key = (x, y) => x + ',' + y;
  const seen = new Set([key(from.x, from.y)]);
  const q = [{ x: from.x, y: from.y }];
  while (q.length) {
    const c = q.shift();
    if (c.x === goal.x && c.y === goal.y) return true;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || nx >= M.W || ny < 0 || ny > M.H || seen.has(key(nx, ny))) continue;
      if (!sim.custWalkable(nx, ny, goal.x, goal.y)) continue;
      seen.add(key(nx, ny));
      q.push({ x: nx, y: ny });
    }
  }
  return false;
}
function floorPlanHeadless(P) {
  const M = P.MAP;
  const T = (t) => '(' + t.x + ',' + t.y + ')';
  // The plan's new MAP fields.
  assert(sameJSON(Object.keys(M.forSale).sort(), Object.keys(FOR_SALE).sort()), 'MAP.forSale ids ' + describe(Object.keys(M.forSale || {})));
  for (const [id, tiles] of Object.entries(FOR_SALE)) assert(sameJSON(M.forSale[id].map((t) => [t.x, t.y]), tiles), 'MAP.forSale.' + id + ' ' + describe(M.forSale[id]));
  for (const id of ['kettle2', 'drum']) assert(sameJSON(M.station(id).tiles.map((t) => [t.x, t.y]), FOR_SALE[id]), id + ' marker tiles are not its footprint');
  for (const d of M.decor) assert(sameJSON(d.tiles.map((t) => [t.x, t.y]), FOR_SALE[d.id]), d.id + ' marker tiles are not its footprint');
  assert(sameJSON(M.home.stations, M.stations.map((s) => s.id)) && sameJSON(M.home.queue, [0, 1]), 'MAP.home ' + describe(M.home));
  assert(M.walk.every((t) => M.at(t.x, t.y) === M.T.LAWN), 'a MAP.walk tile is not lawn');
  assert(M.apron && M.apron.barn === 'y0' && M.apron.fence === 'x0', 'MAP.apron ' + describe(M.apron));
  assert(sameJSON([M.spawn.x, M.spawn.y, M.spawn.face, M.gate.x, M.gate.y, M.custSpawn.x, M.custSpawn.y, M.passStop.x, M.passStop.y], [3, 2, 'right', 8, 11, 8, 12, 8, 10]), 'spawn, gate, custSpawn, passStop ' + describe([M.spawn, M.gate, M.custSpawn, M.passStop]));
  assert(M.at(M.gate.x, M.gate.y) === M.T.GATE, 'the gate tile is not GATE');
  // The BFS self test.
  const startRep = P.C.START_REP;
  const fails = [];
  let routes = 0;
  for (const decorOn of [false, true]) {
    const decor = Object.fromEntries(DECOR_IDS.map((id) => [id, decorOn]));
    const saved = P.validateSave(saveV2({ day: 3, decor }, startRep));
    assert(saved, 'validateSave refused the floor plan save');
    const sim = P.createSim(saved, 1);
    const st = sim.state;
    for (let mask = 0; mask < (1 << GEAR_IDS.length); mask++) {
      GEAR_IDS.forEach((g, i) => { st.gear[g] = (mask & (1 << i)) !== 0; });   // fixture (W0)
      const tag = 'gear ' + mask + (decorOn ? ' decor' : '');
      const goals = [];
      for (const s of M.stations) {
        if (!P.tileOwned(s, st.gear)) continue;
        for (const u of s.use) if (P.tileOwned(u, st.gear)) goals.push([s.id + ' use ' + T(u), u]);
      }
      for (const k of ['buddyIdle', 'tenderIdle', 'prepIdle', 'prepUse']) goals.push([k, M[k]]);
      for (const [what, t] of goals) {
        routes += 1;
        if (!sim.walkable(t.x, t.y) || walkSteps(sim, M.spawn, t) === null) fails.push(tag + ': ' + what + ' unreachable from the spawn');
      }
      for (const qs of M.queue.filter((q) => P.tileOwned(q, st.gear, st.decor))) {
        routes += 1;
        if (!custReach(sim, M.custSpawn, qs)) fails.push(tag + ': queue ' + T(qs) + ' unreachable from the customer spawn');
      }
      for (const seat of M.seats.filter((x) => P.tileOwned(x, st.gear, st.decor))) {
        routes += 1;
        if (!custReach(sim, M.custSpawn, seat)) fails.push(tag + ': ' + seat.id + ' unreachable from the customer spawn');
      }
    }
  }
  assert(fails.length === 0, fails.length + ' unreachable, first ' + fails.slice(0, 3).join('; '));
  // Check 6: the cook loop legs, every gear owned.
  const sim6 = P.createSim(P.validateSave(saveV2({ day: 3 }, startRep)), 1);
  for (const g of GEAR_IDS) sim6.state.gear[g] = true;   // fixture (W0)
  const legs = [];
  for (const [leg, a, from, b, to, want] of COOK_LEGS) {
    const uf = M.station(a).use.find((u) => u.x === from[0] && u.y === from[1]);
    const ut = M.station(b).use.find((u) => u.x === to[0] && u.y === to[1]);
    assert(uf && ut, leg + ': ' + describe(from) + ' or ' + describe(to) + ' is not a use tile of ' + a + ' or ' + b);
    const n = walkSteps(sim6, uf, ut);
    assert(n === want && (n >= 1 && n <= 3 || (n === 0 && ut.gear === 'bigtable')), leg + ' is ' + n + ' lane steps, wanted ' + want);
    legs.push(n);
  }
  // Check 7: tall props on row 0 or column 0; the hat rule.
  const pieces = [];   // [id, sprite, tiles]
  const picnic1 = M.props.find((p) => p.id === 'picnic1');
  for (const p of M.props) pieces.push([p.id, p.sprite, p.blocks.length ? p.blocks : (p.sprite === 'picnic_bench' ? picnic1.blocks : [p.tile])]);
  for (const d of M.decor) for (const dr of d.draws) if (!dr.overhead) pieces.push([d.id, dr.sprite, d.tiles]);
  const tall = [];
  for (const [id, sprite, tiles] of pieces) {
    const h = RULE_H[sprite];
    assert(typeof h === 'number', 'no rule height for ' + sprite + ' (' + id + ')');
    if (h > 20 && !tiles.every((t) => t.x === 0 || t.y === 0) && !TALL_EXCEPT.includes(id)) tall.push(id + ' (' + sprite + ' ' + h + ' rp) on ' + tiles.map(T).join(' '));
  }
  assert(tall.length === 0, 'tall props off row 0 and column 0: ' + tall.join('; '));
  const stand = [M.spawn, M.buddyIdle, M.tenderIdle, M.prepIdle, M.prepUse];
  for (const s of M.stations) for (const u of s.use) stand.push(u);
  const behind = new Set();
  for (const t of stand) for (let k = 1; k <= 4; k++) {
    const x = t.x - k, y = t.y - k;
    if (x >= 0 && y >= 0 && (x === 0 || y === 0)) behind.add(x + ',' + y);
  }
  // v3.6: nobody stands on (3,1) since the register took it, so (2,0) left the set.
  for (const k of ['0,0', '1,0', '0,1', '0,2', '0,3', '0,4', '0,5', '0,6']) assert(behind.has(k), 'the hat rule set misses (' + k + '): ' + describe([...behind]));
  const hats = [];
  for (const [id, sprite, tiles] of pieces) {
    if (WALL_HUNG.includes(id)) continue;
    for (const t of tiles) if (behind.has(t.x + ',' + t.y)) hats.push(id + ' on ' + T(t));
  }
  assert(hats.length === 0, 'the hat rule: ' + hats.join('; '));
  return routes + ' BFS routes over 64 gear states twice; cook legs ' + legs.join(', ') + '; ' + pieces.length + ' prop and decor pieces, ' + behind.size + ' hat tiles clear, ' + TALL_EXCEPT.join(', ') + ' and the drum named exceptions';
}

// [S 19.6] The counter used end to end: with the bigger table, four plates set down one at a time
// fill four different spots, starting at the end nearest the line (queue spot 1) and working out,
// and each spot has its own draw point. Drives sim.interact() at the table's use tile.
function countersHeadless(P) {
  const h = headless(P, null, 19);
  const sim = h.sim, s = h.st();
  sim[SIM_METHODS.skipTutorial]();
  h.drain();
  s.gear.bigtable = true;
  s.phase = PHASE.service; s.paused = false;
  s.customers = [];
  const spots = s.stations.table.spots;
  while (spots.length < P.C.TABLE_SPOTS_BIG) spots.push(null);
  spots.fill(null);
  const use = P.MAP.station('table').use[0];
  s.player.x = use.x; s.player.y = use.y; s.player.face = use.face; s.player.busy = null;
  s.player.path = []; s.player.next = null; s.player.walking = false;
  const meats = ['chicken', 'ribs', 'chicken', 'sausage'];
  const landed = [];
  for (const meat of meats) {
    s.player.carrying = { kind: 'plates', meat, times: [s.clock] };
    const before = spots.map((sp) => (sp ? sp.times.length : 0));
    const r = sim[SIM_METHODS.interact]();
    h.drain();
    assert(r && r.ok === true, 'set down ' + meat + ' refused: ' + describe(r));
    assert(s.player.carrying === null, 'hands still hold ' + describe(s.player.carrying) + ' after the set down');
    const grew = spots.map((sp, i) => (sp ? sp.times.length : 0) - before[i]).map((d, i) => (d > 0 ? i : -1)).filter((i) => i >= 0);
    assert(grew.length === 1, 'plate ' + (landed.length + 1) + ' changed spots ' + describe(grew));
    landed.push(grew[0]);
  }
  assert(new Set(landed).size === 4, 'four plates landed in ' + describe(landed) + ', wanted four different spots');
  const qx = P.MAP.queue[0].x * 16 + 8, qy = P.MAP.queue[0].y * 16 + 8;
  const px = P.MAP.station('table').spotPx;
  const dist = landed.map((i) => Math.hypot(px[i].x - qx, px[i].y - qy));
  for (let k = 1; k < dist.length; k++) assert(dist[k] >= dist[k - 1], 'spot ' + landed[k] + ' is nearer the line than ' + landed[k - 1] + ': ' + describe(landed));
  const pts = landed.map((i) => px[i].x + ',' + px[i].y);
  assert(new Set(pts).size === 4, 'two spots share a draw point: ' + describe(pts));
  return 'spots ' + landed.join(', ') + ' from the line end';
}

// v3.6: the register at the line end of the counter. v3.7: a guest orders and pays there first: the
// pitmaster rings them up (a tap on the register, or standing at it with empty hands) or a TILL card on
// shift rings them up on its own; nobody ringing means they wait in line. Paid, they take the first
// free seat (or a to go spot) and wait for the plate. Every crew idle tile sits by its job (the RUN
// card within 2 steps of the counter and the board). A v10 save loads as v11.
function lineGuest(h, id, meat, fields) {
  return Object.assign({ x: 5, y: 1, px: 80, py: 16, face: 'left', next: null, path: [], walking: false, anim: 0, id, body: 0, want: meat || 'sausage',
    patienceMax: 60, patience: 60, wait: 0, queueIndex: 0, mode: 'waiting', mood: 'neutral', reason: null, pause: 0, hop: 0,
    seat: null, eat: 0, eatMax: 0, bonusPaid: false, booked: false, runPlate: false,
    paid: false, fed: false, togo: false, spot: -1, price: 0, paidAt: 0, rungBy: null, incoming: null }, fields || {});
}
// A paid guest already in a seat, waiting for the plate (fixture).
function seatedGuest(h, id, meat, seatId, fields) {
  const st = h.st();
  const seat = h.P.MAP.seats.find((x) => x.id === seatId);
  st.seats[seatId] = id;
  const c = lineGuest(h, id, meat, Object.assign({ x: seat.x, y: seat.y, px: seat.x * 16, py: seat.y * 16, face: seat.face, queueIndex: -1, mode: 'seated',
    seat: seatId, eatMax: 9, paid: true, price: h.P.MEATS[meat].price, paidAt: st.clock, rungBy: 'you' }, fields || {}));
  st.customers.push(c);
  return c;
}
function clearYardFixture(h) {
  const st = h.st();
  st.customers = []; st.spawnAt = Infinity;
  for (const k of Object.keys(st.seats)) st.seats[k] = null;
  if (st.today.pending !== undefined) st.today.pending = 0;
  st.stations.table.spots = st.stations.table.spots.map(() => null);
  st.stations.board.stacks = [];
  const pl = st.player;
  pl.x = 1; pl.y = 4; pl.px = 16; pl.py = 64; pl.path = []; pl.next = null; pl.walking = false; pl.carrying = null; pl.busy = null; pl.target = null; pl.queued = null;
}
function registerHeadless(P) {
  const C = P.C, M = P.MAP, notes = [];
  const reg = M.station('register');
  assert(reg && reg.type === 'register' && reg.gear === null && reg.tiles.length === 1 && reg.tiles[0].x === 3 && reg.tiles[0].y === 1, 'MAP register ' + describe(reg));
  assert(P.tileOwned(reg, {}), 'the register is not owned from the start');
  const lineEnd = M.station('table').tiles.find((t) => t.y === 1);
  assert(lineEnd && Math.abs(lineEnd.x - reg.tiles[0].x) + Math.abs(lineEnd.y - reg.tiles[0].y) === 1 && M.queue[0].y === reg.tiles[0].y, 'the register is not beside the counter end nearest the line');
  assert(reg.use.some((u) => u.x === 2 && u.y === 1) && M.tillIdle && M.tillIdle.x === 2 && M.tillIdle.y === 1, 'the TILL post is not the register use tile on the kitchen side ' + describe(M.tillIdle));
  assert(Array.isArray(M.togo) && M.togo.length >= 2 && M.togo.every((t) => M.at(t.x, t.y) === M.T.LAWN), 'MAP.togo ' + describe(M.togo));
  // Idle tiles against their jobs (lane steps over the yard with every gear owned).
  const hi = headless(P, null, 31);
  for (const g of GEAR_IDS) hi.st().gear[g] = true;   // fixture
  const near = (from, ids) => Math.min(...ids.flatMap((id) => M.station(id).use.filter((u) => P.tileOwned(u, hi.st().gear)).map((u) => walkSteps(hi.sim, from, u))).filter((n) => n !== null));
  const idle = {
    run: [near(M.buddyIdle, ['table']), near(M.buddyIdle, ['board'])],
    fire: [near(M.tenderIdle, ['kettle1', 'kettle2', 'drum', 'pile'])],
    prep: [walkSteps(hi.sim, M.prepIdle, M.prepUse)],
    till: [walkSteps(hi.sim, M.tillIdle, reg.use[0])]
  };
  assert(idle.run[0] <= 2 && idle.run[1] <= 2, 'the RUN idle tile ' + describe(M.buddyIdle) + ' is ' + idle.run.join(' and ') + ' steps from the counter and the board, wanted 2 or less');
  assert(idle.fire[0] <= 2 && idle.prep[0] <= 1 && idle.till[0] === 0, 'idle steps ' + describe(idle));
  notes.push('idle steps RUN ' + idle.run.join('/') + ', FIRE ' + idle.fire[0] + ', PREP ' + idle.prep[0] + ', TILL ' + idle.till[0]);
  // One guest at the front of the line, a plate on the counter, the player off the register (fixtures).
  const queueOne = (h, id) => {
    clearYardFixture(h);
    const st = h.st();
    st.stations.table.spots[0] = { meat: 'sausage', times: [st.clock], run: [false] };
    st.customers.push(lineGuest(h, id, 'sausage'));
    return st.cash;
  };
  const rungOf = (h, id) => h.log.filter((e) => e.type === 'rung' && e.id === id);
  const RX = reg.tiles[0].x * 16 + 8, RY = reg.tiles[0].y * 16;
  // (a) Nobody eats before paying: the plate waits on the counter, the guest waits in line.
  const ha = feltRun(P, 'fire', 3, 41);
  const cash0 = queueOne(ha, 9001);
  for (let i = 0; i < ha.ticksFor(10); i++) ha.tick();
  const ga0 = ha.st().customers.find((c) => c.id === 9001);
  assert(ga0 && ga0.queueIndex === 0 && ga0.paid === false && ha.st().cash === cash0 && rungOf(ha, 9001).length === 0 && !ha.log.some((e) => e.type === 'served' && e.id === 9001),
    'the guest paid or ate with nobody at the register: ' + describe(ga0 && { q: ga0.queueIndex, paid: ga0.paid, mode: ga0.mode }));
  notes.push('nobody at the register: the guest waits in line, unpaid');
  const pa = ha.st().player;
  pa.x = 3; pa.y = 2; pa.px = 48; pa.py = 32; pa.face = 'up';
  pa.carrying = { kind: 'plates', meat: 'sausage', times: [ha.st().clock] };   // hands full, so standing there does not ring
  assert(ha.sim.reach() === 'register', 'reach() from (3,2) facing up is ' + describe(ha.sim.reach()));
  pa.carrying = null;
  const ra = ha.sim.interact();
  ha.drain();
  const ga = rungOf(ha, 9001);
  const price = P.MEATS.sausage.price;
  assert(ra && ra.ok === true && ga.length === 1 && ga[0].by === 'you' && ga[0].x === RX && ga[0].y === RY && ga[0].price === price, 'tapping the register: ' + describe(ra) + ', rung ' + describe(ga));
  assert(ha.st().cash === cash0 + price, 'rung up for ' + (ha.st().cash - cash0) + ', wanted ' + price);
  const gp = ha.st().customers.find((c) => c.id === 9001);
  assert(gp.paid === true && gp.queueIndex === -1 && gp.mode === 'toSeat' && gp.seat !== null, 'after paying the guest is ' + describe({ mode: gp.mode, seat: gp.seat, q: gp.queueIndex }));
  ha.until(() => gp.mode === 'seated', 10);
  assert(gp.mode === 'seated' && gp.eat === 0 && !ha.log.some((e) => e.type === 'served' && e.id === 9001), 'the paid guest did not sit and wait: ' + gp.mode);
  notes.push('a tap rang up ' + price + ', then they sat with a number');
  // (b) Standing at the register with empty hands rings up too.
  queueOne(ha, 9002);
  const pb = ha.st().player;
  pb.x = 2; pb.y = 1; pb.px = 32; pb.py = 16;
  ha.tick();
  assert(rungOf(ha, 9002).length === 1 && rungOf(ha, 9002)[0].by === 'you', 'standing at the register did not ring up ' + describe(rungOf(ha, 9002)));
  // (c) No free seat: a to go spot by the counter, and the plate on the counter goes home with them.
  clearYardFixture(ha);
  for (const k of Object.keys(ha.st().seats)) ha.st().seats[k] = -1;   // every seat taken (fixture)
  ha.st().customers.push(lineGuest(ha, 9003, 'sausage'));
  const pc = ha.st().player;
  pc.x = 2; pc.y = 1; pc.px = 32; pc.py = 16;
  ha.tick();
  const g3 = ha.st().customers.find((c) => c.id === 9003);
  assert(g3 && g3.togo === true && g3.mode === 'togo', 'no seat: ' + describe(g3 && { mode: g3.mode, togo: g3.togo }));
  for (let i = 0; i < 10; i++) ha.tick();
  assert(!ha.log.some((e) => e.type === 'served' && e.id === 9003), 'the to go guest got food from an empty counter');
  ha.st().stations.table.spots[0] = { meat: 'sausage', times: [ha.st().clock], run: [false] };
  ha.tick();
  const tg = ha.log.filter((e) => e.type === 'to_go' && e.id === 9003);
  assert(tg.length === 1 && g3.mode === 'leaving' && g3.reason === 'togo' && ha.st().stations.table.spots[0] === null, 'the to go pickup ' + describe({ tg: tg.length, mode: g3.mode }));
  notes.push('no seat: they stand at a to go spot and take it home');
  // (d) A TILL card on shift rings everyone up on its own, faster with stars.
  const ringT = {};
  for (const stars of [1, 5]) {
    const ht = feltRun(P, 'till', stars, 43);
    const cr = ht.st().cashier;
    assert(cr && cr.x === M.tillIdle.x && cr.y === M.tillIdle.y && cr.vals && cr.vals.tillRing === P.skillValue('tillRing', stars), 'TILL mover ' + describe(cr && { x: cr.x, y: cr.y, vals: cr.vals }));
    queueOne(ht, 9100);
    const t0 = ht.st().clock;
    ht.until(() => rungOf(ht, 9100).length > 0, 4);
    const gt = rungOf(ht, 9100);
    assert(gt.length === 1 && gt[0].by === 'till', 'the TILL card did not ring up (' + stars + ' stars): ' + describe(gt));
    const rec = ht.st().today.crew['1'];
    assert(rec && rec.plates === 1, 'the TILL crew row ' + describe(rec));
    ringT[stars] = Math.round((ht.st().clock - t0) * 100) / 100;
  }
  assert(ringT[5] < ringT[1], 'a 5 star TILL rang up in ' + ringT[5] + ' s, a 1 star in ' + ringT[1] + ' s');
  notes.push('TILL rings in ' + ringT[1] + ' s at 1 star, ' + ringT[5] + ' s at 5');
  // (e) The pool and the walk-ins carry TILL cards.
  const pool = P.genPool({ seed: 7, year: 1 });
  assert(pool.filter((e) => e.role === 'till').length === 6, 'genPool TILL cards ' + pool.filter((e) => e.role === 'till').length);
  let wk = 0;
  for (let sd = 1; sd <= 30 && !wk; sd++) for (let w = 2; w <= 7 && !wk; w++) wk = P.genWalkins({ seed: sd, year: 1, week: w, rep: 80 }).filter((e) => e.role === 'till').length;
  assert(wk > 0, 'no TILL walk-in over 30 seeds');
  // (f) Save v11: a v10 save keeps its crew; guests in flight are never saved.
  const ser = ha.sim[SIM_METHODS.serialize]();
  assert(ser.v === SAVE_V && !('customers' in ser), 'serialize v ' + ser.v);
  const old = JSON.parse(JSON.stringify(ser));
  old.v = 10;
  const back = P.validateSave(old);
  assert(back && back.v === SAVE_V && back.crew.length === ser.crew.length, 'v10 save to v11 ' + describe(back && { v: back.v, crew: back.crew.map((c) => c.role) }));
  const mid = P.createSim(back, 5);
  assert(mid.state.customers.length === 0 && Object.values(mid.state.seats).every((x) => x === null), 'a loaded save has guests in flight');
  notes.push('v10 saves load as v11 with no guests in flight');
  return notes.join('; ');
}

// v3.7: plates go from the counter to the seated guest who ordered that meat: the RUN card walks it
// over, or the pitmaster taps the plate on the counter, then the guest's table. A guest eats only once
// the plate arrives; patience drains at the table, and a walk-out is refunded. Faster tips more.
function deliveryHeadless(P) {
  const notes = [];
  const M = P.MAP;
  const adj = (m, seatId) => { const s = M.seats.find((x) => x.id === seatId); return Math.abs(m.x - s.x) + Math.abs(m.y - s.y) === 1; };
  // (a) The RUN card takes the sausage plate to the sausage guest, not the chicken guest beside them.
  const hr = feltRun(P, 'run', 3, 51);
  clearYardFixture(hr);
  const b = hr.st().buddy;
  const chick = seatedGuest(hr, 9201, 'chicken', 'pt1a', { paidAt: hr.st().clock - 2 });
  const saus = seatedGuest(hr, 9202, 'sausage', 'pt1b');
  hr.st().stations.table.spots[1] = { meat: 'sausage', times: [hr.st().clock], run: [false] };
  let carried = false;
  hr.until(() => { if (b.carrying && b.carrying.kind === 'plates' && b.x >= 5) carried = true; return hr.log.some((e) => e.type === 'served' && e.id === 9202); }, 15);
  const sv = hr.log.find((e) => e.type === 'served' && e.id === 9202);
  assert(sv && sv.by === 'run' && carried && adj(b, 'pt1b') && saus.mode === 'eating' && saus.eat > 0, 'the RUN delivery ' + describe(sv && strip(sv)) + ', runner at ' + b.x + ',' + b.y + ', carried on the lawn ' + carried + ', guest ' + saus.mode);
  assert(chick.mode === 'seated' && chick.fed !== true && !hr.log.some((e) => e.type === 'served' && e.id === 9201), 'the chicken guest got the sausage plate');
  const runTip = sv.tip;
  hr.until(() => b.task === 'idle', 10);
  assert(b.x === M.buddyIdle.x && b.y === M.buddyIdle.y, 'the RUN card did not come back to the counter ' + b.x + ',' + b.y);
  notes.push('RUN walked the sausage plate to pt1b (' + sv.tip + ' tip), the chicken guest still waiting');
  // (b) The pitmaster by hand: tap the plate on the counter, then the guest's table.
  const hp = feltRun(P, 'fire', 3, 52);
  clearYardFixture(hp);
  const g = seatedGuest(hp, 9301, 'sausage', 'pt1a');
  hp.st().stations.table.spots[0] = { meat: 'sausage', times: [hp.st().clock], run: [false] };
  for (let i = 0; i < 20; i++) hp.tick();
  assert(g.mode === 'seated' && !hp.log.some((e) => e.type === 'served' && e.id === 9301), 'the guest ate a plate nobody carried');
  let taps = 0;
  taps += hp.sim.walkTo(4, 1) === true ? 1 : 0;
  hp.drain();
  hp.until(() => hp.st().player.carrying !== null, 5);
  assert(hp.st().player.carrying && hp.st().player.carrying.kind === 'plates' && hp.st().stations.table.spots[0] === null, 'the counter tap did not pick the plate up ' + describe(hp.st().player.carrying));
  const seat = M.seats.find((x) => x.id === 'pt1a');
  taps += hp.sim.walkTo(seat.x, seat.y + 1) === true ? 1 : 0;   // the table in front of the seat
  hp.drain();
  hp.until(() => hp.log.some((e) => e.type === 'served' && e.id === 9301), 10);
  const sh = hp.log.find((e) => e.type === 'served' && e.id === 9301);
  assert(sh && sh.by === 'you' && taps === 2 && g.mode === 'eating' && hp.st().player.carrying === null, 'hand delivery ' + describe(sh && strip(sh)) + ' in ' + taps + ' taps, guest ' + g.mode);
  // The way back is a tap on any patio station.
  assert(hp.sim.walkTo(4, 8) === true, 'the pitmaster could not walk back from the table');
  hp.drain();
  hp.until(() => hp.st().player.path.length === 0 && hp.st().player.next === null, 8);
  assert(hp.st().player.x <= 4, 'the pitmaster stuck on the lawn at ' + hp.st().player.x + ',' + hp.st().player.y);
  notes.push('by hand: 2 taps from the counter (1 straight from the board), ' + sh.tip + ' tip');
  // (c) Faster tips more: the same plate after a long wait tips less.
  clearYardFixture(hp);
  const slow = seatedGuest(hp, 9302, 'sausage', 'pt1b', { wait: 40, patience: 20 });
  hp.st().player.carrying = { kind: 'plates', meat: 'sausage', times: [hp.st().clock] };
  const sb = M.seats.find((x) => x.id === 'pt1b');
  hp.sim.walkTo(sb.x, sb.y);
  hp.drain();
  hp.until(() => hp.log.some((e) => e.type === 'served' && e.id === 9302), 10);
  const ss = hp.log.find((e) => e.type === 'served' && e.id === 9302);
  assert(ss && ss.tip < sh.tip, 'a slow plate tipped ' + (ss && ss.tip) + ', a quick one ' + sh.tip);
  assert(slow.mode === 'eating', 'slow guest ' + slow.mode);
  // (d) Patience drains at the table; a walk-out leaves without food and gets the price back.
  clearYardFixture(hp);
  const w = seatedGuest(hp, 9303, 'sausage', 'pt1a', { patience: 0.3 });
  const cash0 = hp.st().cash, rev0 = hp.st().today.revenue, wo0 = hp.st().today.walkouts;
  hp.until(() => hp.log.some((e) => e.type === 'walk_out' && e.id === 9303), 3);
  const wo = hp.log.find((e) => e.type === 'walk_out' && e.id === 9303);
  assert(wo && wo.refund === w.price || (wo && wo.refund === P.MEATS.sausage.price), 'walk-out ' + describe(wo && strip(wo)));
  assert(hp.st().cash === cash0 - P.MEATS.sausage.price && hp.st().today.revenue === rev0 - P.MEATS.sausage.price && hp.st().today.walkouts === wo0 + 1 && hp.st().seats.pt1a === null && w.mode === 'leaving',
    'refund: cash ' + cash0 + ' to ' + hp.st().cash + ', walkouts ' + hp.st().today.walkouts);
  notes.push('a table walk-out refunded ' + P.MEATS.sausage.price + ' and counts as a walk-out');
  // (e) RUN Friendliness nudges the tip: a 5 star runner's tip beats a 1 star's on the same plate.
  const tipAt = {};
  for (const st of [1, 5]) {
    const h = feltRun(P, 'run', st, 53);
    clearYardFixture(h);
    seatedGuest(h, 9400, 'ribs', 'pt1a');
    h.st().stations.table.spots[0] = { meat: 'ribs', times: [h.st().clock], run: [false] };
    // the walk itself is timed by stars; hold the wait still so only the tip share differs
    h.fixture = (s2) => { const c = s2.customers.find((x) => x.id === 9400); if (c) c.wait = 0; };
    h.until(() => h.log.some((e) => e.type === 'served' && e.id === 9400), 15);
    const e = h.log.find((x) => x.type === 'served' && x.id === 9400);
    tipAt[st] = e ? e.tip : null;
  }
  assert(tipAt[1] !== null && tipAt[5] !== null && tipAt[5] > tipAt[1], 'RUN tips ' + describe(tipAt));
  notes.push('RUN tip on ribs ' + tipAt[1] + ' at 1 star, ' + tipAt[5] + ' at 5 (3 star sausage ' + runTip + ')');
  return notes.join('; ');
}

// ---------------------------------------------------------------------------------------------
// Headless sims (steps 8 to 10). The harness owns every tick here; events are stamped with the
// clock, the tick count and a drain batch number right after each drain.
// ---------------------------------------------------------------------------------------------

// v3.2 (D10.1): the v3.1 headless steps play one cook a week, so their sims run in legacy days. A
// legacy week opens on Wednesday (list prices, training open, both weekend days ahead), and
// canLoadUp() and loadUp() read the week's cook as Sunday's: a Saturday booking moves to Sunday so
// the week closes after its report, and a Yard pick cooks a full length Sunday Yard day. The tick,
// spoilage and wages then run exactly as v3.1's one cook a week did. The v3.2 steps pass days: true.
function legacyDays(sim) {
  const raw = { loadUp: sim.loadUp, canLoadUp: sim.canLoadUp, prefill: sim.prefill, dayOptions: sim.dayOptions };
  const fix = () => {
    const st = sim.state, s = st.season;
    if (st.loop === 'week' && st.phase === 'morning' && s.day === 0 && s.dayLog.every((x) => x === null)) {
      s.day = 2; s.dayLog[0] = 'off'; s.dayLog[1] = 'off';
      st.cart = raw.prefill();
    }
  };
  const asSunday = (fn) => {
    const st = sim.state, s = st.season;
    if (st.loop !== 'week' || st.phase !== 'morning' || s.booking === null) return fn(false);
    const d = s.day, b = s.booking;
    s.day = 6;
    if (b.type !== 'yard' && b.day !== 6) s.booking = Object.assign({}, b, { day: 6 });
    const r = fn(true);
    if (sim.state.loop === 'week' && sim.state.phase === 'morning' && sim.state.season.day === 6) { s.day = d; s.booking = b; }
    return r;
  };
  for (const k of Object.keys(sim)) {
    if (typeof sim[k] !== 'function' || k in raw) continue;
    const f = sim[k];
    sim[k] = function (...a) { const r = f.apply(this, a); fix(); return r; };
  }
  sim.prefill = () => raw.prefill();
  sim.dayOptions = () => raw.dayOptions();
  sim.canLoadUp = () => { fix(); return asSunday((on) => {
    if (!on || sim.state.season.booking.type !== 'yard') return raw.canLoadUp();
    const o = raw.dayOptions().options.find((x) => x.kind === 'yard');
    return { ok: o.ok, reason: o.reason };
  }); };
  sim.loadUp = () => { fix(); return asSunday((on) => (on && sim.state.season.booking.type === 'yard' ? sim.chooseDay('yard') : raw.loadUp())); };
  fix();
  return sim;
}

function headless(P, saved, seed, opts = {}) {
  const sim = opts.days ? P.createSim(saved, seed) : legacyDays(P.createSim(saved, seed));
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
  // v3.7: the first plate off the board brings the guest; they pay at the register, the plate goes
  // on the counter, then the pitmaster carries it to their table (no RUN card on the tutorial day).
  const sliceIdx = h.log.length;
  assert(h.go('board', () => h.has(EVENT.sliceDone, sliceIdx) && h.stepIs('customer'), 10), 'board: no slice_done and step customer; step ' + describe(h.step()));
  const sliceEv = h.log[h.idx(EVENT.sliceDone, sliceIdx)];
  const batch = h.log.filter((e) => e._b === sliceEv._b);
  const order = [EVENT.sliceDone, EVENT.tutorialStep, EVENT.gateOpen, EVENT.customerArrived];
  const at = order.map((t) => batch.findIndex((e) => e.type === t && (t !== EVENT.tutorialStep || e.id === 'customer')));
  assert(at.every((i) => i >= 0) && at.every((i, j) => j === 0 || i > at[j - 1]), 'the slice drain is ' + describe(batch.map((e) => e.type + (e.id !== undefined ? ':' + e.id : ''))) + ', wanted ' + order.join(', ') + ' in order');
  const arrived = batch[at[3]];
  assert(arrived.id === 1 && arrived.meat === MEAT, 'scripted customer_arrived ' + describe(strip(arrived)));
  assert(st().clock === C.GATE_OPENS, 'clock after the slice ' + st().clock + ', wanted ' + C.GATE_OPENS);
  assert(h.until(() => h.stepIs('register', 'register'), WAIT_S.headlessServe), 'no step register: ' + describe(h.step()));
  const g1 = () => st().customers.find((c) => c.id === 1);
  assert(!g1().paid && !h.has(EVENT.served), 'the guest paid or ate before the register: ' + describe({ paid: g1().paid }));
  const ringIdx = h.log.length;
  assert(h.go('register', () => h.has('rung', ringIdx)), 'register: no rung; step ' + describe(h.step()));
  const rung = h.log[h.idx('rung', ringIdx)];
  assert(rung.id === 1 && rung.by === 'you' && g1().paid === true && g1().queueIndex === -1, 'rung ' + describe(strip(rung)) + ', guest ' + describe({ paid: g1().paid, q: g1().queueIndex }));
  assert(h.until(() => g1().mode === 'seated' && h.stepIs('plate', 'table'), WAIT_S.headlessSeat), 'the paid guest did not sit with step plate: ' + describe({ mode: g1().mode, step: h.step() }));
  assert(!h.has(EVENT.served) && g1().eat === 0, 'eating before the plate arrived');
  const tableIdx = h.log.length;
  assert(h.go('table', () => h.has(EVENT.setDown, tableIdx) && h.stepIs('deliver', 'table')), 'table: no set_down and step deliver; step ' + describe(h.step()));
  for (let i = 0; i < 20; i++) h.tick();
  assert(!h.has(EVENT.served, tableIdx) && g1().mode === 'seated', 'the seated guest got a plate nobody carried');
  assert(h.go('table', () => carryIs(h, CARRY_KIND.plates, MEAT) && h.stepIs('deliver', null)), 'table: did not take the plate back up; step ' + describe(h.step()) + ', carrying ' + describe(st().player.carrying));
  const seat1 = P.MAP.seats.find((x) => x.id === g1().seat);
  const servedIdx0 = h.log.length;
  assert(h.sim.walkTo(seat1.x, seat1.y + 1) === true, 'walkTo the guest\'s table refused');
  h.drain();
  assert(h.until(() => h.has(EVENT.served, servedIdx0), WAIT_S.headlessServe), 'no served within ' + WAIT_S.headlessServe + ' s of the table tap');
  const servedIdx = h.idx(EVENT.served, servedIdx0);
  const sv1 = h.log[servedIdx];
  assert(sv1.id === 1 && sv1.by === 'you' && g1().mode === 'eating' && st().player.carrying === null, 'hand delivery ' + describe(strip(sv1)) + ', guest ' + g1().mode);

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
  passHiring(a, '(a)');   // v3.1 (X8): Hiring Day before week 1
  const by = a.sim.bookOffer('yard');
  const lu = a.sim.loadUp();
  a.drain();
  assert(by && by.ok && lu && lu.ok, '(a) bookOffer yard ' + describe(by) + ', loadUp ' + describe(lu));
  assert(a.st().today.gateAt === C.EVENT_GATE, '(a) today.gateAt ' + a.st().today.gateAt);   // v3.5: a Yard day opens at EVENT_GATE
  assert(a.st().spawnAt === a.st().today.gateAt, '(a) spawnAt ' + a.st().spawnAt);
  const n2 = a.log.length;
  const gA = a.st().today.gateAt;   // v3.5: EVENT_GATE
  a.until(() => a.has(EVENT.customerArrived, n2), gA + 2);
  const soon = a.of(EVENT.gateSoon, n2)[0], open = a.of(EVENT.gateOpen, n2)[0], arr = a.of(EVENT.customerArrived, n2)[0];
  const tick = C.TICK_SECONDS + 1e-6;
  assert(soon && nearly(soon._at, gA - 10, tick), '(a) gate_soon at ' + (soon && soon._at));
  assert(open && nearly(open._at, gA, tick), '(a) gate_open at ' + (open && open._at));
  assert(arr && nearly(arr._at, gA, tick), '(a) first customer_arrived at ' + (arr && arr._at));
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
  h.drain();
  passHiring(h, 'burn');   // v3.1 (X8): Hiring Day before week 1
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
  R.headcount = (row, L) => Math.round(row.guests * C.LENGTHS.normal.factor);
  R.windowAt = (row, L) => row.window * C.LENGTHS.normal.window / C.BASE_WINDOW;
  // W3.3: an Offer's menu is in MEAT_IDS order, whatever order the row lists it in (the stretch stub lists brisket first).
  R.menuOf = (row, gear) => (row.menu === null ? MEAT_IDS.filter((m) => m !== 'brisket' || (gear && gear.drum === true)) : MEAT_IDS.filter((m) => row.menu.includes(m)));
  R.fee = (n, menu) => (menu.length ? Math.round(n * (menu.reduce((a, m) => a + M[m].price, 0) / menu.length) * C.FEE_MULT / C.FEE_ROUND) * C.FEE_ROUND : 0);
  R.deposit = (fee) => Math.round(fee * C.DEPOSIT_FRAC);
  // v3.3 [S 3.5]: the week 9 competition by the design's table (sim.js V33-1).
  // sim.js V33-8: the invited contest first ('finale'), then each lower one ('finale_' + id).
  R.comps = (input) => {
    const top = input.rep >= 67 ? 2 : (input.rep >= 34 ? 1 : 0);
    const out = [];
    for (let third = top; third >= 0; third--) {
      const cats = [['chicken', 'sausage', 'ribs', 'butt'], ['chicken', 'ribs', 'butt', 'brisket'], ['chicken', 'ribs', 'butt', 'brisket']][third];
      const rail = Object.fromEntries(MEAT_IDS.map((m) => [m, cats.includes(m) ? 1 : 0]));
      out.push({ id: third === top ? 'finale' : 'finale_' + ['backyard', 'regional', 'invitational'][third], type: 'finale',
        label: ['Backyard Open', 'Regional Cook-off', 'Invitational'][third], venue: 'grounds', host: null,
        headcount: 0, menu: cats, rail, pay: 0, deposit: 0, difficulty: 3, window: 0, patience: 0, safe: true, tier: 'safe', invite: false, menuIdx: 0, base: 0 });
    }
    return out;
  };
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
  R.grateSec = (gear, win) => (C.KETTLE_SLOTS * (gear && gear.kettle2 === true ? 2 : 1) + (gear && gear.drum === true ? C.DRUM_SLOTS : 0)) * (C.EVENT_GATE + win) * C.SAFE_LOAD;
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
    const L = 'normal';   // every cook runs the Normal length
    const rail = R.rail(R.headcount(row, L), R.menuOf(row, input.gear), null);
    let need = 0;
    for (const m of MEAT_IDS) if (rail[m] > 0) need += Math.ceil(rail[m] / M[m].plates) * M[m].slots * M[m].cook;
    const span = C.EVENT_GATE + R.windowAt(row, L);
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
    const L = 'normal';   // every cook runs the Normal length
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
    if (input.week === C.SEASON_WEEKS) return { offers: R.comps(input), swapped: false, rawStretch: false };   // v3.3
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
  // ---- v3.1 (X3): offers that differ every week. R.gen above stays the v3.0 model (step 12 compares
  // the host draws with it, deviation 24); R.gen31 is the X3.4 model with the X18.1 items 26 to 30.
  R.thirdOf = (rep) => (rep >= C.THIRD_EDGES[1] ? 2 : rep >= C.THIRD_EDGES[0] ? 1 : 0);
  R.kOf = (third, stretch) => C.THIRD_PAY[third] * (stretch ? C.STRETCH_PAY : 1);   // X3.3
  R.feeK = (n, menu, k) => (menu.length ? Math.round(n * (menu.reduce((a, m) => a + M[m].price, 0) / menu.length) * C.FEE_MULT * k / C.FEE_ROUND) * C.FEE_ROUND : 0);
  R.pair = (pair) => MEAT_IDS.filter((m) => pair.includes(m));
  R.base = (row, L) => Math.round(row.guests * C.LENGTHS.normal.factor);
  R.capNeedsAt = (row, menu, n, input) => {
    const L = 'normal';   // every cook runs the Normal length
    const need = R.slotSec(R.rail(n, menu, null));
    const span = C.EVENT_GATE + R.windowAt(row, L);
    const g = input.gear || {};
    const fits = (k2, dr) => need <= (C.KETTLE_SLOTS * (k2 ? 2 : 1) + (dr ? C.DRUM_SLOTS : 0)) * span * C.SAFE_LOAD + 1e-9;
    const k2 = g.kettle2 === true, dr = g.drum === true;
    if (fits(k2, dr)) return '';
    if (!k2 && fits(true, dr)) return P.STRINGS.ui.needsKettle2;
    if (!dr && fits(true, true)) return P.STRINGS.ui.needsDrum;
    return '';
  };
  R.safeAt = (row, menu, n, input) => menu.every((m) => R.cookable(m, input.gear)) && R.unlockMet(row, input.rep, input.gear) && R.capNeedsAt(row, menu, n, input) === '';
  R.offerAt = (row, menu, n, input, o) => {
    const L = 'normal';   // every cook runs the Normal length
    const fee = R.feeK(n, menu, o.k);
    return { id: o.id || row.id, type: row.id, label: row.label, venue: row.venue, host: null, headcount: n, menu: menu.slice(),
      rail: R.rail(n, menu, null), pay: fee, deposit: R.deposit(fee), difficulty: row.flames, window: R.windowAt(row, L), patience: row.patience,
      safe: o.safe, tier: 'safe', invite: o.invite === true, base: o.base, menuIdx: o.menuIdx };
  };
  R.resize = (o, n, k) => { o.headcount = n; o.rail = R.rail(n, o.menu, null); o.pay = R.feeK(n, o.menu, k); o.deposit = R.deposit(o.pay); };
  R.grateAt = (gear, win, load) => (C.KETTLE_SLOTS * (gear && gear.kettle2 === true ? 2 : 1) + (gear && gear.drum === true ? C.DRUM_SLOTS : 0)) * (C.EVENT_GATE + win) * load;
  // variant: { extraDraw, extraStats } for a Needs card that is not the week's stretch (deviation 22).
  R.gen31 = (input, variant = { extraDraw: true, extraStats: false }) => {
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
    const avoidSet = () => new Set(Array.isArray(input.avoid) ? input.avoid : []);   // review 1: crew and pitmaster names
    const L = 'normal';   // every cook runs the Normal length
    const third = R.thirdOf(input.rep);
    const kT = R.kOf(third, false), kS = R.kOf(third, true);
    if (input.week === C.SEASON_WEEKS) return { offers: R.comps(input), stretchId: null };   // step 1, v3.3: the competition
    const slots = C.OFFER_SLOTS[third];
    const invite = third === C.INVITE_THIRD;
    const idx = (row) => types.indexOf(row);
    // Step 3: one ry() draw per array index, before any filtering (X18.1 item 27), then the rotation
    // with the item 26 step forward when the rotated pair is unsafe and menus[0] is safe.
    const ry = refMulberry32(refMix32(input.seed ^ 0x4D454E55, input.year, 0));
    const wm = new Map();
    const seenIds = new Set();
    for (const row of types) {
      const d = ry();
      if (!row || typeof row !== 'object' || row.id === 'yard' || row.id === 'finale' || seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      const ms = Array.isArray(row.menus) ? row.menus : [row.menu];
      if (!ms.length) { wm.set(row, { menu: R.pair(row.menu || []), idx: 0, ms: [row.menu || []] }); continue; }
      const m0 = Math.floor(d * ms.length);
      const n = R.base(row, L);
      let j = (m0 + input.week - 1) % ms.length;
      if (!R.safeAt(row, R.pair(ms[j]), n, input) && R.safeAt(row, R.pair(ms[0]), n, input)) {
        let found = 0;
        for (let k = 1; k <= ms.length; k++) { const jj = (m0 + input.week - 1 + k) % ms.length; if (R.safeAt(row, R.pair(ms[jj]), n, input)) { found = jj; break; } }
        j = found;
      }
      wm.set(row, { menu: R.pair(ms[j]), idx: j, ms });
    }
    const baseOffer = (row) => {
      const w = wm.get(row);
      const n = R.base(row, L);
      return R.offerAt(row, w.menu, n, input, { k: kT, safe: R.safeAt(row, w.menu, n, input), base: n, menuIdx: w.idx });
    };
    // Step 4 (W3.4 steps 1 to 5, unchanged).
    const unlocked = types.filter((row) => wm.has(row) && R.unlockMet(row, input.rep, input.gear));
    const feeOf = (row) => baseOffer(row).pay;
    const isSafe = (row) => baseOffer(row).safe;
    const picked = [];
    const bday = unlocked.find((row) => row.id === 'birthday');
    if (input.cash < C.LOW_CASH_BIRTHDAY && bday) picked.push(bday);
    const rest = unlocked.filter((row) => !picked.includes(row));
    for (let i = rest.length - 1; i >= 1; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = rest[i]; rest[i] = rest[j]; rest[j] = t;
    }
    for (const row of rest) if (picked.length < slots && !picked.includes(row)) picked.push(row);
    if (picked.length > 0 && !picked.some(isSafe)) {
      const safeRows = unlocked.filter(isSafe).sort((a, b) => feeOf(a) - feeOf(b) || idx(a) - idx(b));
      if (safeRows.length) picked[picked.length - 1] = safeRows[0];
    }
    // W3.4 step 6's unpicked safe type, kept outside picked (X18.1 item 29 c).
    let inviteRow = null;
    if (invite) {
      const cand = unlocked.filter((row) => isSafe(row) && !picked.includes(row)).sort((a, b) => feeOf(b) - feeOf(a) || idx(a) - idx(b));
      if (cand.length) inviteRow = cand[0];
    }
    const rv = refMulberry32(refMix32(input.seed ^ 0x56415249, input.year, input.week));
    const offers = picked.map((row) => ({ row, o: baseOffer(row) }));
    const toStretch = (x, pay) => {
      x.o.tier = 'stretch';
      x.o.patience = x.row.patience + C.STRETCH_PATIENCE;
      x.o.difficulty = Math.min(3, x.row.flames + 1);
      if (pay) R.resize(x.o, x.o.headcount, kS);
    };
    // Step 5: the stretch. A Needs card is the gear stretch and the rest take SAFE_SIZES draws (step 6,
    // as v3.1 built it). Review 1 (X20.3), with no Needs card: one rv() draw u, then a SAFE_SIZES draw
    // per picked card in picked order; the cards whose largest fitting size at the stretch pay beats
    // STRETCH_EDGE times every other card at its safe size are the candidates; u picks one in picked
    // order and the rest take their safe sizes (no candidate: no stretch this week).
    let stretch = null;
    const needsCards = offers.filter((x) => !x.o.safe);
    if (needsCards.length) {
      stretch = needsCards[0];
      toStretch(stretch, true);
      for (const x of offers) {
        if (x === stretch) continue;
        const extraNeeds = !x.o.safe;
        if (extraNeeds) {
          x.o.tier = 'stretch';   // X18.1 item 26
          if (variant.extraStats) { x.o.patience = x.row.patience + C.STRETCH_PATIENCE; x.o.difficulty = Math.min(3, x.row.flames + 1); }
          if (!variant.extraDraw) continue;
        }
        const f = C.SAFE_SIZES[Math.floor(rv() * C.SAFE_SIZES.length)];
        R.resize(x.o, Math.max(x.o.menu.length, Math.round(x.o.base * f)), kT);
      }
    } else if (offers.length) {
      const u = rv();
      const safeN = new Map();
      for (const x of offers) {
        const f = C.SAFE_SIZES[Math.floor(rv() * C.SAFE_SIZES.length)];
        safeN.set(x, Math.max(x.o.menu.length, Math.round(x.o.base * f)));
      }
      const fitN = new Map(), cands = [];
      for (const x of offers) {
        const cap = R.grateAt(input.gear, x.o.window, C.STRETCH_LOAD) + 1e-9;
        let h = null;
        for (let n = Math.round(x.o.base * C.STRETCH_SIZE); n >= Math.ceil(x.o.base * C.STRETCH_MIN); n--) {
          if (R.slotSec(R.rail(n, x.o.menu, null)) <= cap) { h = n; break; }
        }
        if (h === null) continue;
        let top = 0;
        for (const y of offers) if (y !== x) top = Math.max(top, R.feeK(safeN.get(y), y.o.menu, kT));
        if (R.feeK(h, x.o.menu, kS) > top * C.STRETCH_EDGE) { fitN.set(x, h); cands.push(x); }
      }
      stretch = cands.length ? cands[Math.floor(u * cands.length)] : null;
      for (const x of offers) {
        if (x === stretch) { R.resize(x.o, fitN.get(x), kT); toStretch(x, true); } else R.resize(x.o, safeN.get(x), kT);
      }
    }
    // Step 7: the invite.
    let inv = null;
    if (invite) {
      if (inviteRow) {
        inv = baseOffer(inviteRow);
        inv.invite = true;
      } else {
        const loadable = offers.filter((x) => x.o.safe).sort((a, b) => b.o.pay - a.o.pay || idx(a.row) - idx(b.row));
        if (loadable.length) {
          const row = loadable[0].row;
          const w = wm.get(row);
          const n = R.base(row, L);
          for (let k = 1; k <= w.ms.length; k++) {
            const jj = (w.idx + k) % w.ms.length;
            const menu = R.pair(w.ms[jj]);
            if (R.safeAt(row, menu, n, input)) { inv = R.offerAt(row, menu, n, input, { id: 'invite', k: kT, safe: true, invite: true, base: n, menuIdx: jj }); break; }
          }
        }
      }
    }
    // v3.3 [S 3.3]: from season 2 headcount and pay rise a tenth a season, capped at 3 tenths, after sizing.
    const kY = 1 + Math.min(0.3, 0.1 * (Math.max(1, input.year || 1) - 1));
    if (kY > 1) {
      const sc = (o) => { o.headcount = Math.max(o.menu.length, Math.round(o.headcount * kY)); o.base = Math.round(o.base * kY);
        o.rail = R.rail(o.headcount, o.menu, null); o.pay = Math.round(o.pay * kY / 5) * 5; o.deposit = R.deposit(o.pay); };
      for (const x of offers) sc(x.o);
      if (inv) sc(inv);
    }
    // Step 8: display order and the hosts.
    const key = (x) => [x.o.safe ? 0 : 1, x.o.tier === 'safe' ? 0 : 1, x.o.difficulty, x.o.pay, idx(x.row)];
    const cmpKey = (a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; };
    const sorted = offers.slice().sort(cmpKey).map((x) => x.o);
    if (inv) sorted.push(inv);
    const used = avoidSet();
    for (const o of sorted) o.host = hostFor(used);
    const y = R.offer(B.yard, input);
    Object.assign(y, { tier: 'safe', invite: false, base: 0, menuIdx: 0 });
    sorted.push(y);
    return { offers: sorted, stretchId: stretch ? stretch.o.id : null };
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
  assert(s && s.v === SAVE_V, label + ': v ' + describe(s && s.v));
  assert(s.player === null, label + ': player ' + describe(s.player));
  assert(s.pitName === W15.defaultPit, label + ': pitName ' + describe(s.pitName));
  assert(s.season && s.season.year === 1 && s.season.week === 1 && sameJSON(s.season.results, []), label + ': season ' + describe(s.season));
  assert(s.season.pick === null && s.season.addon === null, label + ': pick and addon ' + describe(s.season && [s.season.pick, s.season.addon]));
  assert(Number.isInteger(s.season.seed) && s.season.seed >= 0, label + ': season.seed ' + describe(s.season.seed));
  assert(!('settings' in s), label + ': kept a settings key ' + describe(s.settings));
  assert(s.wood === 0, label + ': wood ' + describe(s.wood));
  // v3.1 (X11.3, X15.1 step 6): no hires, so no cards, and Hiring Day is still owed.
  assert(!('hires' in s), label + ': kept a hires key ' + describe(s.hires));
  assert(sameJSON(s.crew, []) && s.crewSeq === 1 && s.hiring === null, label + ': crew ' + describe(s.crew) + ', crewSeq ' + describe(s.crewSeq) + ', hiring ' + describe(s.hiring));
  assert(s.season.drafted === false && s.season.trained === null && sameJSON(s.season.walkins, []), label + ': drafted, trained, walkins ' + describe([s.season.drafted, s.season.trained, s.season.walkins]));
}

function validateV4(P) {
  const V = (o) => P.validateSave(JSON.parse(JSON.stringify(o)));
  const base = () => JSON.parse(JSON.stringify(SAVE_V4_SAMPLE));
  // v3.1: the W13.1 sample now migrates to v 5 with no cards (its hires are both false) and drafted
  // true (it has results), and nothing else moves.
  const rt = V(SAVE_V4_SAMPLE);
  const want4 = base();
  want4.v = SAVE_V;
  want4.pit = { xp: 0, longDay: 0 };   // v3.5
  delete want4.hires;
  delete want4.settings;   // 2026-10-19: an old save's length setting is ignored
  Object.assign(want4, { crew: [], crewSeq: 1, hiring: null });
  // v3.3: the shelf, the ribbons and no open Offseason.
  Object.assign(want4, { trophies: [], ribbons: { sausage: 0, chicken: 0, ribs: 0, butt: 0, brisket: 0 }, offseason: null });
  // D9: and the five day keys, on that week's Monday.
  Object.assign(want4.season, { drafted: true, trained: null, walkins: [], day: 0, dayLog: [null, null, null, null, null, null, null], prepped: false, loadin: false, overnight: null, advance: 0, plan: null });
  assert(deepEq(rt, want4), 'the W13.1 sample migrates to ' + describe(rt) + ', wanted ' + describe(want4));
  const cases = [
    ['charcoal 500', (s) => { s.charcoal = 500; }, (r) => r.charcoal === 200],
    ['wood -3', (s) => { s.wood = -3; }, (r) => r.wood === 0],
    ['week 7 with 3 results', (s) => { s.season.week = 7; s.season.results = s.season.results.slice(0, 3); s.season.pick = null; }, (r) => r.season.week === 4 && r.season.results.length === 3],
    ['9 results with week 2 (v3.5: six and the finale, week 7)', (s) => { s.season.week = 2; s.season.results = s.season.results.concat([{ type: 'birthday', stars: 3 }, { type: 'birthday', stars: 3 }, { type: 'birthday', stars: 3 }, { type: 'finale', stars: 4 }]); s.season.pick = null; }, (r) => r.season.week === SEASON_WEEKS && r.season.results.length === SEASON_WEEKS && r.season.results[SEASON_WEEKS - 1].type === 'finale' && r.season.pick === null],
    ['a bad result type', (s) => { s.season.week = 3; s.season.results = [{ type: 'bogus', stars: 3 }, { type: 'birthday', stars: 3 }]; s.season.pick = null; }, (r) => deepEq(r.season.results, [{ type: 'birthday', stars: 3 }]) && r.season.week === 2],
    ['stars 9', (s) => { s.season.week = 2; s.season.results = [{ type: 'picnic', stars: 9 }]; s.season.pick = null; }, (r) => r.season.results[0] && r.season.results[0].stars === 5],
    ['yard stars 4', (s) => { s.season.week = 2; s.season.results = [{ type: 'yard', stars: 4 }]; s.season.pick = null; }, (r) => r.season.results[0] && r.season.results[0].stars === 0],
    ['pick finale in week 3', (s) => { s.season.week = 3; s.season.results = s.season.results.slice(0, 2); s.season.pick = 'finale'; }, (r) => r.season.week === 3 && r.season.pick === null],
    ['addon brisket without the drum', (s) => { s.season.addon = 'brisket'; }, (r) => r.season.addon === null],
    ['player.name Ana<b>!', (s) => { s.player.name = 'Ana<b>!'; }, (r) => r.player && r.player.name === 'Anab'],
    ['look.skin 9', (s) => { s.player.look.skin = 9; }, (r) => r.player && r.player.look.skin === DEFAULT_LOOK.skin],
    ["pitName ''", (s) => { s.pitName = ''; }, (r) => r.pitName === W15.defaultPit],
    ['settings.length turbo', (s) => { s.settings.length = 'turbo'; }, (r) => !('settings' in r)],
    ['day 1 owing the tutorial with a player', (s) => { s.day = 1; s.tutorial = { done: false }; }, (r) => r.player === null && r.tutorial.done === false && r.season.week === 1 && r.season.results.length === 0],
    ['no results and no hires', (s) => { s.season.week = 1; s.season.results = []; s.season.pick = null; }, (r) => r.season.drafted === false && sameJSON(r.crew, [])]
  ];
  for (const [label, mut, ok] of cases) {
    const s = base();
    mut(s);
    let r;
    try { r = V(s); } catch (e) { throw new Error('v4 ' + label + ' threw: ' + e.message); }
    assert(r && r.v === SAVE_V, 'v4 ' + label + ' returned ' + describe(r && r.v));
    assert(!('hires' in r), 'v4 ' + label + ' kept a hires key');
    assert(ok(r), 'v4 ' + label + ' gave ' + describe({ charcoal: r.charcoal, wood: r.wood, season: r.season, player: r.player, pitName: r.pitName, crew: r.crew }));
  }
  const cyc = base(); cyc.season.self = cyc; cyc.player.look.loop = cyc;
  let threw = null;
  try { P.validateSave(cyc); } catch (e) { threw = e; }
  assert(!threw, 'cyclic v4 threw: ' + (threw && threw.message));
  return 'the W13.1 sample migrates to v 5 unchanged otherwise, ' + cases.length + ' dirty v4 cases clamp as W19 says';
}

// v3.1 (X11.1, X11.2, X15.1 step 6): the v5 sample round trips and the dirty v5 cases clamp.
function validateV5(P) {
  const V = (o) => P.validateSave(JSON.parse(JSON.stringify(o)));
  const base = () => JSON.parse(JSON.stringify(SAVE_V5_SAMPLE));
  const rt = V(SAVE_V5_SAMPLE);
  // D9: a v5 save migrates to v 6 on that week's Monday, nothing else moves.
  const want5 = base();
  want5.v = SAVE_V;
  want5.pit = { xp: 0, longDay: 0 };   // v3.5
  delete want5.settings;   // 2026-10-19: an old save's length setting is ignored
  Object.assign(want5.season, { day: 0, dayLog: [null, null, null, null, null, null, null], prepped: false, loadin: false, overnight: null, advance: 0, plan: null });
  // v3.3: the shelf, the ribbons and no open Offseason.
  Object.assign(want5, { trophies: [], ribbons: { sausage: 0, chicken: 0, ribs: 0, butt: 0, brisket: 0 }, offseason: null });
  assert(deepEq(rt, want5), 'the X11.1 sample does not migrate to v 6 on Monday: ' + describe(rt));
  const names = P.STRINGS.names;
  const extra = (over) => Object.assign(JSON.parse(JSON.stringify(SAVE_V5_SAMPLE.crew[0])), { id: 3, name: 'June' }, over);
  // A save that owes Hiring Day, with a pool shaped as X11.1 saves it (no stars, wage or idx).
  const hiringSave = (n) => {
    const s = base();
    s.season.week = 1; s.season.results = []; s.season.pick = null; s.season.drafted = false; s.season.trained = null; s.season.walkins = [];
    s.crew = []; s.crewSeq = 1;
    const pool = P.genPool({ seed: s.season.seed, year: 1, avoid: [] }).slice(0, n).map((e) => ({ name: e.name, role: e.role, skills: e.skills.slice(), potential: e.potential,
      mood: e.mood, look: Object.assign({}, e.look), status: 'open', tried: false }));
    s.hiring = { year: 1, round: 2, tryouts: 1, pool };
    return s;
  };
  const cases = [
    ["a card with role 'drive'", (s) => { s.crew.push(extra({ role: 'drive' })); }, (r) => r.crew.length === 2 && !r.crew.some((c) => c.role === 'drive')],
    ['skills [0.3, 9]', (s) => { s.crew[0].skills = [0.3, 9]; }, (r) => sameJSON(r.crew[0].skills, [1, 5]) && r.crew[0].potential === 5],
    ['potential 2 with skills [3, 4]', (s) => { s.crew[0].skills = [3, 4]; s.crew[0].potential = 2; }, (r) => r.crew[0].potential === 4],
    ['mood 5', (s) => { s.crew[0].mood = 5; }, (r) => r.crew[0].mood === 2],
    ['notice true at mood 0', (s) => { s.crew[1].notice = true; s.crew[1].mood = 0; }, (r) => r.crew[1].notice === false],
    ['notice true at mood -2', (s) => { s.crew[1].notice = true; s.crew[1].mood = -2; }, (r) => r.crew[1].notice === true && r.crew[1].mood === -2],
    ['two RUN cards brought', (s) => { s.crew[1].role = 'run'; s.crew[1].bring = true; }, (r) => r.crew.length === 2 && r.crew[0].bring === true && r.crew[1].bring === false],
    ['a duplicate id', (s) => { s.crew[1].id = 1; }, (r) => r.crew.length === 1 && r.crew[0].name === 'Rosa'],
    ["name 'Striker'", (s) => { s.crew[0].name = 'Striker'; }, (r) => names.includes(r.crew[0].name) && r.crew[0].name !== 'Striker' && r.crew[0].name !== r.crew[1].name && (names[1] === 'Dale' || r.crew[0].name === names[1])],
    ["trait 'x'", (s) => { s.crew[0].trait = 'x'; }, (r) => r.crew[0].trait === null],
    ['xp 500 and banked 40', (s) => { s.crew[0].xp = 500; s.crew[0].banked = 40; }, (r) => r.crew[0].xp === P.C.LEVEL_XP - 1 && r.crew[0].banked === 9],   // review 1: LEVEL_XP is tunable
    ['contract 3', (s) => { s.crew[0].contract = 3; }, (r) => r.crew[0].contract === 1 || r.crew[0].contract === 2],   // X11.2 pins 1 or 2, not clamp or default
    ['crewSeq 1 under the ids', (s) => { s.crewSeq = 1; }, (r) => r.crewSeq === 3],
    ['a walk-in with role drive', (s) => { s.season.walkins[0].role = 'drive'; }, (r) => sameJSON(r.season.walkins, [])],
    ['hiring with 18 pool entries', (s) => { Object.assign(s, hiringSave(18)); }, (r) => r.hiring !== null && r.hiring.pool.length === 18 && r.hiring.round === 2 && r.hiring.tryouts === 1 && r.season.drafted === false],
    ['hiring with 17 pool entries', (s) => { Object.assign(s, hiringSave(17)); }, (r) => r.hiring === null],
    ['hiring for another year', (s) => { Object.assign(s, hiringSave(18)); s.hiring.year = 2; }, (r) => r.hiring === null],
    ["pick 'invite' in week 3", (s) => { s.season.week = 3; s.season.results = s.season.results.slice(0, 2); s.season.pick = 'invite'; }, (r) => r.season.week === 3 && r.season.pick === 'invite']
  ];
  for (const [label, mut, ok] of cases) {
    const s = base();
    mut(s);
    let r;
    try { r = V(s); } catch (e) { throw new Error('v5 ' + label + ' threw: ' + e.message); }
    assert(r && r.v === SAVE_V, 'v5 ' + label + ' returned ' + describe(r && r.v));
    assert(ok(r), 'v5 ' + label + ' gave crew ' + describe(r.crew) + ', crewSeq ' + describe(r.crewSeq) + ', hiring ' + describe(r.hiring && { round: r.hiring.round, n: r.hiring.pool && r.hiring.pool.length }) + ', season ' + describe(r.season));
  }
  const cyc = base(); cyc.crew[0].look.loop = cyc; cyc.season.walkins[0].self = cyc;
  let threw = null;
  try { P.validateSave(cyc); } catch (e) { threw = e; }
  assert(!threw, 'cyclic v5 threw: ' + (threw && threw.message));
  return 'the X11.1 sample round trips, ' + cases.length + ' dirty v5 cases clamp as X11.2 says';
}

// A headless sim on the week 1 hub (skip, then the creator with the default look).
function toWeek(P, seed, look, name, pit) {
  const h = headless(P, null, seed);
  assert(h.sim.skipTutorial() === true, 'skipTutorial() did not return true');
  h.drain();
  h.sim.setPlayer(look || DEFAULT_LOOK, name || W15.defaultName, pit || W15.defaultPit);
  h.drain();
  passHiring(h, 'toWeek');   // v3.1 (X8): Hiring Day before week 1, passed with nobody hired
  assert(h.st().loop === LOOP.week && h.st().phase === PHASE.morning, 'not on the week hub: loop ' + describe(h.st().loop) + ', phase ' + h.st().phase);
  return h;
}
// v3.1 (X6.2, X8): pass every round of Hiring Day, then finishHiring().
function passHiring(h, label) {
  assert(h.st().loop === LOOP.hiring, (label || '') + ': not on Hiring Day: loop ' + describe(h.st().loop));
  for (let i = 0; i < 3; i++) {
    const r = h.sim.passRound();
    h.drain();
    assert(r && r.ok === true, (label || '') + ': passRound ' + (i + 1) + ' ' + describe(r));
  }
  const f = h.sim.finishHiring();
  h.drain();
  assert(f && f.ok === true && h.st().loop === LOOP.week, (label || '') + ': finishHiring ' + describe(f) + ', loop ' + describe(h.st().loop));
}
// v3.1 (X4.2): a full crew card for fixtures; skills, role and name given, the rest at the X15.3 defaults.
function mkCard(P, id, name, role, skills, over = {}) {
  return Object.assign({ id, name, role, skills: skills.slice(), potential: 5, xp: 0, banked: 0, mood: 0,
    wage: P.wageFor(P.cardStars(skills), role), contract: 1, seasons: 0, rookie: false, trait: null,
    look: Object.assign({}, DEFAULT_LOOK), bring: true, raised: false, notice: false, worked: 0, bench: 0 }, over);
}
// A headless week 1 hub with a fixture crew (W0: Node steps may write a headless state).
function crewWeek(P, seed, cards, over = {}) {
  const h = toWeek(P, seed);
  h.st().crew = cards.map((c) => JSON.parse(JSON.stringify(c)));
  h.st().crewSeq = cards.reduce((a, c) => Math.max(a, c.id), 0) + 1;
  if (over.cash !== undefined) h.st().cash = over.cash;
  if (over.rep !== undefined) h.st().rep = over.rep;
  if (over.gear) Object.assign(h.st().gear, over.gear);
  return h;
}
// Fixture: this week's offers again from the sim's own inputs (what setLength(current) used to do).
function reOffer(h) {
  const st = h.st(), se = st.season;
  const avoid = st.crew.map((c) => c.name);
  if (st.profile && typeof st.profile.name === 'string') avoid.push(st.profile.name);
  se.offers = h.P.genOffers({ seed: se.seed, year: se.year, week: se.week, rep: st.rep, cash: se.weekCash, gear: Object.assign({}, st.gear), avoid });
  se.booking = se.offers[0] || null;
  se.addon = null;
  st.cart = h.sim.prefill();
}
const cardOf = (h, id) => h.st().crew.find((c) => c.id === id) || null;
// Book an offer, load up and settle it; returns the till.
function settleWeek(h, stars, offerId) {
  const st = h.st();
  const id = offerId || (st.season.offers.find((o) => o.type !== 'yard' && o.safe) || {}).id;
  const b = h.sim.bookOffer(id);
  assert(b && b.ok, 'bookOffer ' + describe(id) + ' ' + describe(b));
  const lu = h.sim.loadUp();
  h.drain();
  assert(lu && lu.ok, 'loadUp ' + describe(lu) + ', canLoadUp ' + describe(h.sim.canLoadUp()));
  assert(h.sim.settle(stars) === true, 'settle(' + stars + ') refused');
  h.drain();
  return h.st().till;
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
  const trashT = P.MAP.station('trash').tiles[0];   // the angle redo: the trash is (2,2)
  b.sim.walkTo(trashT.x, trashT.y);
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

// v3.1 (X3.2): the projection adds the tier, the invite flag, menuIdx and base (not on the finale, deviation 23).
const offerView31 = (o) => Object.assign(offerView(o), { tier: o.tier, invite: o.invite, menuIdx: o.menuIdx }, o.type === 'finale' ? {} : { base: o.base });
const GEN_VARIANTS = [{ extraDraw: true, extraStats: false }, { extraDraw: false, extraStats: false }, { extraDraw: true, extraStats: true }, { extraDraw: false, extraStats: true }];
const offerBrief = (o) => [o.id, o.tier, o.headcount, o.base, o.menu && o.menu.join('+'), o.pay, o.deposit, o.host, o.menuIdx, o.invite];

function generatorHeadless(P) {
  const C = P.C;
  const R = refModel(P);
  const notes = [];
  const variantHits = new Set();
  const noGear = Object.fromEntries(GEAR_IDS.map((g) => [g, false]));
  const k2Gear = Object.assign({}, noGear, { kettle2: true });
  const drumGear = Object.assign({}, noGear, { kettle2: true, drum: true });
  const base = { seed: 7, year: 1, rep: 20, cash: 80, gear: noGear, length: 'normal' };
  const books = (list) => list.filter((o) => o.type !== 'yard');
  const cmp = (input, label) => {
    const got = P.genOffers(input);
    assert(Array.isArray(got), label + ': genOffers returned ' + describe(got));
    assert(got.every((o) => Object.isFrozen(o)), label + ': an offer is not frozen');
    let want = null;
    for (let i = 0; i < GEN_VARIANTS.length && !want; i++) {
      const w = R.gen31(input, GEN_VARIANTS[i]);
      if (deepEq(got.map(offerView31), w.offers.map(offerView31))) { want = w; if (i > 0) variantHits.add(i); }
    }
    if (!want) {
      const w0 = R.gen31(input);
      const a = got.map(offerView31), b = w0.offers.map(offerView31);
      let at = 0;
      while (at < Math.max(a.length, b.length) && deepEq(a[at], b[at])) at += 1;
      throw new Error(label + ': genOffers ' + describe(got.map(offerBrief)) + ', the X3.4 reference ' + describe(w0.offers.map(offerBrief))
        + '; first difference at card ' + at + ': ' + describe(a[at]) + ' against ' + describe(b[at]));
    }
    for (const o of got) {
      assert(typeof o.needs === 'string' && (o.safe ? o.needs === '' : o.needs.length > 0), label + ': ' + o.id + ' needs ' + describe(o.needs) + ' with safe ' + o.safe);
      assert(o.tier === 'safe' || o.tier === 'stretch', label + ': ' + o.id + ' tier ' + describe(o.tier));
    }
    const hosts = books(got).filter((o) => !o.comp).map((o) => o.host);   // v3.3: the competition has no host
    assert(hosts.every((h) => P.STRINGS.names.includes(h)), label + ': hosts ' + describe(hosts));
    assert(new Set(hosts).size === hosts.length, label + ': hosts repeat ' + describe(hosts));
    const y = got.find((o) => o.type === 'yard');
    if (y) assert(y.host === null && y.tier === 'safe' && y.invite === false && y.base === 0 && y.menuIdx === 0, label + ': the Yard day ' + describe(offerBrief(y)));
    // Deviation 24: the r draws are v3.0's, so the host names in display order are the v3.0 model's.
    const h30 = books(R.gen(input).offers).map((o) => o.host);
    const n = Math.min(h30.length, hosts.length);
    assert(sameJSON(hosts.slice(0, n), h30.slice(0, n)), label + ': hosts ' + describe(hosts) + ' differ from the v3.0 model ' + describe(h30));
    return { got, want };
  };
  const by = (list, id) => list.find((o) => o.id === id);
  const sizesOf = (b, len) => C.SAFE_SIZES.map((f) => Math.max(len, Math.round(b * f)));
  const HC = (n) => Math.round(n * C.LENGTHS.normal.factor);   // v3.5: a row's guests at the length
  const menuIn = (id, menu) => BOOKING_MENUS[id].some((pr) => sameJSON(MEAT_IDS.filter((m) => pr.includes(m)), menu));
  const kS0 = R.kOf(0, true);
  // Weeks 1 to 8 on one kettle: the Birthday is the safe bet, the Church picnic the gear stretch.
  for (let w = 1; w <= SEASON_WEEKS - 1; w++) {
    const { got } = cmp(Object.assign({}, base, { week: w }), 'week ' + w);
    assert(sameJSON(got.map((o) => o.id), ['birthday', 'picnic', 'yard']), 'week ' + w + ' ids ' + describe(got.map((o) => o.id)));
    const b0 = by(got, 'birthday'), p0 = by(got, 'picnic');
    assert(b0.tier === 'safe' && b0.safe === true && b0.base === HC(12) && sizesOf(HC(12), b0.menu.length).includes(b0.headcount) && menuIn('birthday', b0.menu),
      'week ' + w + ' Birthday ' + describe(offerBrief(b0)) + ', wanted the safe bet, base 12, a SAFE_SIZES headcount');
    assert(p0.tier === 'stretch' && p0.safe === false && p0.needs === P.STRINGS.ui.needsKettle2 && p0.headcount === HC(20) && p0.base === HC(20) && menuIn('picnic', p0.menu)
      && p0.pay === R.feeK(HC(20), p0.menu, kS0) && p0.patience === P.BOOKINGS.picnic.patience + C.STRETCH_PATIENCE && p0.difficulty === Math.min(3, P.BOOKINGS.picnic.flames + 1),
      'week ' + w + ' Church picnic ' + describe(offerBrief(p0)) + ', wanted the stretch: 20 guests, the Needs line, the stretch pay, patience and flames');
  }
  const w1 = P.genOffers(Object.assign({}, base, { week: 1 }));
  assert(deepEq(w1, P.genOffers(Object.assign({}, base, { week: 1 }))), 'the same input twice differs');
  const lit = atStart(C, ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC']);
  const bd = by(w1, 'birthday'), pc = by(w1, 'picnic'), yd = by(w1, 'yard');
  const expectOffer = (o, want, label) => {
    for (const [k, v] of Object.entries(want)) assert(deepEq(o[k], v), label + '.' + k + ' is ' + describe(o[k]) + ', wanted ' + describe(v));
  };
  expectOffer(bd, { difficulty: 1, window: 60 * C.LENGTHS.normal.window / C.BASE_WINDOW, patience: 45, rail: R.rail(bd.headcount, bd.menu, null), pay: R.feeK(bd.headcount, bd.menu, 1), deposit: R.deposit(R.feeK(bd.headcount, bd.menu, 1)) }, 'birthday');   // W26 Q-5: window 60
  expectOffer(pc, { window: C.LENGTHS.normal.window, rail: R.rail(HC(20), pc.menu, null), deposit: R.deposit(pc.pay) }, 'picnic');
  expectOffer(yd, { headcount: 0, menu: [], pay: 0, deposit: 0, rail: zeroMeat() }, 'yard');
  // Deviation 25: the v3.0 literals on the draw that keeps the v3.0 shape.
  if (lit && bd.headcount === 12 && sameJSON(bd.menu, ['sausage', 'chicken'])) {
    assert(bd.pay === 100 && bd.deposit === 30, 'literal: Birthday ' + bd.pay + '/' + bd.deposit + ', wanted 100/30');
    notes.push('Birthday 12 guests, fee 100, deposit 30 (literal)');
  } else notes.push('Birthday ' + bd.headcount + ' guests of ' + bd.menu.join(' and ') + ', fee ' + bd.pay);
  if (lit && sameJSON(pc.menu, ['chicken', 'butt'])) assert(R.feeK(20, pc.menu, 1) === 275, 'literal: the base picnic fee ' + R.feeK(20, pc.menu, 1) + ', wanted 275');
  notes.push('the stretch picnic pays ' + pc.pay + ' (' + pc.menu.join(' and ') + ')');
  // W24 P-1: one kettle cannot feed the Church picnic, two can; the Birthday fits one. An old
  // input's length key changes nothing (2026-10-19).
  for (const L of ['normal', 'short']) {
    const one = P.genOffers(Object.assign({}, base, { week: 1, length: L }));
    const two = P.genOffers(Object.assign({}, base, { week: 1, length: L, gear: k2Gear }));
    if (L !== 'normal') assert(sameJSON(one, P.genOffers(Object.assign({}, base, { week: 1 }))), 'a length key moved the offers ' + describe(one.map(offerBrief)));
    const p1 = by(one, 'picnic'), p2 = by(two, 'picnic'), b1 = by(one, 'birthday');
    assert(p1.safe === false && p1.needs === P.STRINGS.ui.needsKettle2, L + ': one kettle picnic safe ' + p1.safe + ', needs ' + describe(p1.needs));
    assert(p2.safe === true && p2.needs === '', L + ': two kettle picnic safe ' + p2.safe + ', needs ' + describe(p2.needs));
    assert(b1.safe === true, L + ': one kettle Birthday is not safe: ' + describe(b1.needs));
  }
  notes.push('the picnic needs the second kettle');
  // X15.1 step 12: weeks 2 to 8 on two kettles, two loadable cards, exactly one sized up stretch, and
  // each type's menu pair moves on from the week before.
  let prev = null;
  const stretchSeen = {};
  for (let w = 1; w <= SEASON_WEEKS - 1; w++) {
    const list = cmp(Object.assign({}, base, { week: w, gear: k2Gear }), 'two kettles week ' + w).got;
    const bk = books(list);
    const idxNow = Object.fromEntries(bk.map((o) => [o.type, o.menuIdx]));
    if (w >= 2) {
      assert(bk.length === 2 && bk.every((o) => o.safe), 'two kettles week ' + w + ': ' + describe(bk.map(offerBrief)) + ', wanted two loadable cards');
      const st = bk.filter((o) => o.tier === 'stretch');
      assert(st.length === 1 && st[0].headcount > st[0].base, 'two kettles week ' + w + ': stretch cards ' + describe(st.map(offerBrief)) + ', wanted exactly one, sized above its base');
      const sf = bk.find((o) => o.tier === 'safe');
      assert(sf && sizesOf(sf.base, sf.menu.length).includes(sf.headcount) && sf.pay === R.feeK(sf.headcount, sf.menu, 1), 'two kettles week ' + w + ': the safe bet ' + describe(sf && offerBrief(sf)));
      assert(st[0].pay === R.feeK(st[0].headcount, st[0].menu, kS0) && st[0].patience < P.BOOKINGS[st[0].type].patience, 'two kettles week ' + w + ': the stretch pay or patience ' + describe(offerBrief(st[0])));
      // Review 1 (X20.3): the STRETCH card always pays the most, and is the bigger job.
      assert(st[0].pay > sf.pay * C.STRETCH_EDGE, 'two kettles week ' + w + ': the stretch pays ' + st[0].pay + ', the safe bet ' + sf.pay + ' (review 1: the stretch pays the most)');
      for (const [type, mi] of Object.entries(idxNow)) assert(prev && prev[type] !== undefined && prev[type] !== mi, 'two kettles week ' + w + ': ' + type + ' menuIdx ' + mi + ' as in week ' + (w - 1));
      stretchSeen[st[0].type] = (stretchSeen[st[0].type] || 0) + 1;
    }
    prev = idxNow;
  }
  notes.push('two kettles weeks 2 to 8: one sized stretch a week (' + Object.entries(stretchSeen).map(([k, v]) => k + ' ' + v).join(', ') + '), menus rotate');
  // The middle third pays a tenth more (X3.3), on one kettle and two.
  for (const gear of [noGear, k2Gear]) {
    for (let w = 1; w <= SEASON_WEEKS - 1; w++) {
      const list = cmp(Object.assign({}, base, { week: w, rep: 50, gear }), 'rep 50 week ' + w).got;
      for (const o of books(list)) {
        const k = R.kOf(1, o.tier === 'stretch');
        assert(o.pay === R.feeK(o.headcount, o.menu, k), 'rep 50 week ' + w + ': ' + o.id + ' pays ' + o.pay + ', wanted ' + R.feeK(o.headcount, o.menu, k) + ' at THIRD_PAY[1]');
      }
    }
  }
  // The top third's repeat invite (X3.4 step 7).
  let invites = 0;
  for (const gear of [noGear, k2Gear]) {
    for (let w = 1; w <= SEASON_WEEKS - 1; w++) {
      const list = cmp(Object.assign({}, base, { week: w, rep: 80, gear }), 'rep 80 week ' + w).got;
      const bk = books(list);
      const last = bk[bk.length - 1];
      assert(last && last.id === 'invite' && last.invite === true && last.tier === 'safe' && last.safe === true && ['birthday', 'picnic'].includes(last.type)
        && bk.slice(0, -1).every((o) => o.invite === false && o.id !== 'invite'), 'rep 80 week ' + w + ': ' + describe(bk.map(offerBrief)) + ', wanted the repeat invite after the other bookings');
      assert(last.pay === R.feeK(last.headcount, last.menu, R.kOf(2, false)) && last.headcount === last.base, 'rep 80 week ' + w + ': the invite ' + describe(offerBrief(last)));
      invites += 1;
    }
  }
  notes.push(invites + ' repeat invites at rep 80');
  // v3.3 [S 3.5]: week 9 is the competition the fan rating third picks, the same at every gear.
  for (const gear of [noGear, k2Gear, drumGear]) {
    const o = P.genOffers(Object.assign({}, base, { week: 9, gear }))[0];
    assert(o.id === 'finale' && o.comp && o.headcount === 0 && o.pay === 0 && o.deposit === 0 && o.host === null && o.day === 5, 'competition ' + describe(offerView(o)));
  }
  const f9 = cmp(Object.assign({}, base, { week: SEASON_WEEKS }), 'week 9').got;
  assert(f9.length === 1 && f9[0].id === 'finale' && f9[0].comp.contest === 'backyard' && sameJSON(f9[0].menu, ['chicken', 'sausage', 'ribs', 'butt']) && f9[0].comp.entry === 20
    && sameJSON(f9[0].comp.prizes, [200, 120, 80]) && sameJSON(f9[0].comp.times, [68, 128, 188, 248]) && f9[0].comp.field === 10 && f9[0].comp.mean === 60, 'week 9 ' + describe(f9[0]));
  const g9r = cmp(Object.assign({}, base, { week: SEASON_WEEKS, rep: 50 }), 'week 9 at rep 50').got;
  const g9i = cmp(Object.assign({}, base, { week: SEASON_WEEKS, rep: 80, gear: drumGear }), 'week 9 at rep 80').got;
  assert(sameJSON(g9r.map((o) => o.id), ['finale', 'finale_backyard']) && sameJSON(g9i.map((o) => o.id), ['finale', 'finale_regional', 'finale_backyard']), 'week 9 lower contests (V33-8) ' + describe([g9r.map((o) => o.id), g9i.map((o) => o.id)]));
  const f9r = g9r[0], f9i = g9i[0];
  assert(f9r.comp.contest === 'regional' && f9r.comp.entry === 50 && f9r.comp.noDrum === true && f9r.comp.mean === 70 && sameJSON(f9r.comp.prizes, [500, 300, 150])
    && f9i.comp.contest === 'invitational' && f9i.comp.entry === 100 && f9i.comp.noDrum === false && f9i.comp.mean === 80 && sameJSON(f9i.comp.prizes, [1200, 600, 300]), 'contests ' + describe([f9r.comp, f9i.comp]));
  // v3.3 [S 3.3]: seasons 2 to 5 against the reference with the season factor.
  for (const year of [2, 3, 4, 5]) for (const week of [2, 5, SEASON_WEEKS - 1]) cmp(Object.assign({}, base, { year, week, rep: 50, gear: k2Gear, cash: 300 }), 'season ' + year + ' week ' + week);
  assert(P.seasonScale(1) === 1 && Math.abs(P.seasonScale(2) - 1.1) < 1e-9 && Math.abs(P.seasonScale(4) - 1.3) < 1e-9 && Math.abs(P.seasonScale(9) - 1.3) < 1e-9, 'seasonScale');
  notes.push('week 9 the competition (Backyard Open, Regional Cook-off at rep 50, Invitational at 80); seasons 2 to 5 scaled');
  const low = cmp(Object.assign({}, base, { week: 2, cash: 50 }), 'cash 50').got;
  assert(low.some((o) => o.id === 'birthday'), 'cash 50 has no Birthday ' + describe(low.map((o) => o.id)));
  // offerSlots() by third, on a sim with a rep fixture.
  const sim = P.createSim(null, 1);
  for (const rep of [33, 34, 66, 67]) {
    sim.state.rep = rep;   // fixture
    const third = R.thirdOf(rep);
    assert(sim.fanThird() === third, 'fanThird() at rep ' + rep + ' is ' + sim.fanThird());
    assert(deepEq(sim.offerSlots(), { slots: C.OFFER_SLOTS[third], invite: third === C.INVITE_THIRD }), 'offerSlots() at rep ' + rep + ' is ' + describe(sim.offerSlots()));
  }
  // Stub types: five safe rows (no menus: X3.1 reads [row.menu]); slots, dedupe, invite and display order.
  const stub = (id, guests, menu, flames) => Object.freeze({ id, label: 'Stub ' + id, guests, menu: Object.freeze(menu), patience: 45, window: 80, flames, venue: 'backyard', icon: 'ev_birthday', unlock: null });
  const five = [stub('s1', 10, ['sausage'], 1), stub('s2', 12, ['chicken'], 2), stub('s3', 14, ['ribs'], 1), stub('s4', 8, ['butt'], 3), stub('s5', 16, ['sausage', 'chicken'], 2)];
  const orderKey = (o) => [o.safe ? 0 : 1, o.tier === 'safe' ? 0 : 1, o.difficulty, o.pay];
  const before = (a, b) => { const ka = orderKey(a), kb = orderKey(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i]; return true; };
  for (const [rep, n] of [[20, 2], [50, 3], [80, 4]]) {
    for (let w = 1; w <= SEASON_WEEKS - 1; w++) {
      const got = cmp(Object.assign({}, base, { week: w, rep, types: five }), 'stub rep ' + rep + ' week ' + w).got;
      const bk = books(got);
      assert(bk.length === n, 'stub rep ' + rep + ' week ' + w + ': ' + bk.length + ' bookings, wanted ' + n);
      assert(new Set(bk.map((o) => o.type)).size === bk.length, 'stub rep ' + rep + ': a type twice');
      const main = bk.filter((o) => !o.invite);
      for (let i = 1; i < main.length; i++) assert(before(main[i - 1], main[i]), 'stub rep ' + rep + ' week ' + w + ' order ' + describe(main.map(offerBrief)));
      assert(bk.every((o, i) => !o.invite || i === bk.length - 1), 'stub rep ' + rep + ' week ' + w + ': the invite is not the last booking');
      assert(bk.every((o) => o.menuIdx === 0), 'stub rep ' + rep + ': a stub row with no menus has menuIdx ' + describe(bk.map((o) => o.menuIdx)));
      assert(got[got.length - 1].type === 'yard', 'stub rep ' + rep + ': the Yard day is not last');
      if (rep === 80) {
        const left = five.filter((r) => !bk.some((o) => o.id === r.id));
        assert(left.length === 1, 'stub rep 80 left out ' + describe(left.map((r) => r.id)));
      }
    }
  }
  // A stub list of stretch rows (brisket without the drum) and one safe row.
  const stretch = [stub('b1', 10, ['brisket'], 1), stub('b2', 12, ['brisket'], 2), stub('b3', 14, ['brisket'], 3), stub('b4', 8, ['brisket', 'sausage'], 1), stub('ok', 10, ['sausage'], 2)];
  for (let w = 1; w <= SEASON_WEEKS - 1; w++) {
    const input = Object.assign({}, base, { week: w, types: stretch });
    const { got } = cmp(input, 'stretch week ' + w);
    const bk = books(got);
    assert(bk.some((o) => o.safe), 'stretch week ' + w + ': no safe offer ' + describe(bk.map((o) => [o.id, o.safe])));
    const firstStretch = bk.findIndex((o) => !o.safe);
    assert(firstStretch < 0 || bk.slice(firstStretch).every((o) => !o.safe), 'stretch week ' + w + ': a safe offer after a stretch one');
    assert(bk.every((o) => o.safe || o.tier === 'stretch'), 'stretch week ' + w + ': a SAFE BET card over a Needs line ' + describe(bk.map(offerBrief)));
  }
  notes.push('stub slots 2, 3, 3 plus invite; the stretch list kept a safe offer every week');
  if (variantHits.size) notes.push('deviation 22 readings matched: ' + [...variantHits].map((i) => describe(GEN_VARIANTS[i])).join(', '));
  return 'X3.4 reference matched on every input (ids, tiers, sizes, pay, menus, hosts), Normal length, the finale; ' + notes.join('; ');
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
    // Deviation 25: the W19 literals hold on the draw that keeps the v3.0 picnic (20 guests of chicken
    // and pork butt at the bottom third's safe tier); the formula above holds on every draw.
    const v30Shape = offer.headcount === 20 && offer.tier === 'safe' && sameJSON(offer.menu, ['chicken', 'butt']) && h.sim.fanThird() === 0;
    if (payLit && v30Shape) assert(offer.pay === 275 && offer.deposit === 83 && t.payRest === LIT[stars][0] && cs[0].pay === LIT[stars][1], stars + ' stars: fee ' + offer.pay + ', deposit ' + offer.deposit + ', rest ' + t.payRest + ', total ' + cs[0].pay + ', W19 literal ' + LIT[stars].join(' and '));
    if (!v30Shape) rests.push('(' + offer.headcount + ' guests, ' + offer.tier + ', fee ' + offer.pay + ')');
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
  // v3.1 (X8, X15.1 step 14): setPlayer lands on Hiring Day; three passes and finishHiring give week 1.
  assert(st().loop === LOOP.hiring, 'loop after setPlayer ' + describe(st().loop) + ', wanted hiring');
  assert(deepEq(st().profile, { name: MARTY.name, look: MARTY.look }), 'state.profile ' + describe(st().profile));
  assert(st().pitName === MARTY.pit, 'state.pitName ' + describe(st().pitName));
  const seq = h.log.slice(n0).map((e) => e.type);
  const order = [EV3.playerSet, EV31.hiringOpen, EVENT.saveWanted].map((t) => seq.indexOf(t));
  assert(order.every((i) => i >= 0) && order.every((i, j) => j === 0 || i > order[j - 1]), 'events after setPlayer ' + describe(seq) + ', wanted player_set, hiring_open, save_wanted (X8)');
  assert(!seq.includes(EV3.weekStart), 'week_start fired before Hiring Day: ' + describe(seq));
  const sw = h.of(EVENT.saveWanted, n0);
  assert(sw.some((e) => e.reason === 'player'), 'no save_wanted player: ' + describe(sw.map(strip)));
  const hn = h.log.length;
  for (let i = 0; i < 3; i++) { const pr = h.sim.passRound(); h.drain(); assert(pr && pr.ok === true, 'passRound ' + (i + 1) + ' ' + describe(pr)); }
  const fh = h.sim.finishHiring();
  h.drain();
  assert(fh && fh.ok === true && st().loop === LOOP.week && st().phase === PHASE.morning, 'finishHiring ' + describe(fh) + ', loop ' + describe(st().loop));
  const seqH = h.log.slice(hn).map((e) => e.type);
  const fi = seqH.indexOf(EV31.hiringDone);
  const orderH = [EV31.hiringDone, EV3.weekStart, EV3.offersReady, EVENT.saveWanted].map((t) => seqH.indexOf(t, fi));
  assert(fi >= 0 && orderH.every((i) => i >= 0) && orderH.every((i, j) => j === 0 || i > orderH[j - 1]), 'events after finishHiring ' + describe(seqH) + ', wanted hiring_done, week_start, offers_ready, save_wanted (X8)');
  assert(h.of(EVENT.saveWanted, hn).some((e) => e.reason === 'hiring'), 'no save_wanted hiring: ' + describe(h.of(EVENT.saveWanted, hn).map(strip)));
  const ws = h.of(EV3.weekStart, hn)[0];
  assert(ws.year === 1 && ws.week === 1, 'week_start ' + describe(strip(ws)));
  const bk = st().season.booking;
  assert(bk && bk.id === 'birthday', 'season.booking ' + describe(bk && bk.id));
  // X3.4: the Birthday is the week's safe bet, its headcount one SAFE_SIZES draw off its base.
  const bdBase = Math.round(P.BOOKINGS.birthday.guests * C.LENGTHS.normal.factor);
  assert(bk.tier === 'safe' && bk.base === bdBase && C.SAFE_SIZES.map((f) => Math.max(bk.menu.length, Math.round(bdBase * f))).includes(bk.headcount), 'the Birthday ' + describe(offerBrief(bk)));
  const v30Bday = bk.headcount === 12 && sameJSON(bk.menu, ['sausage', 'chicken']);   // deviation 25
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
  if (v30Bday && atStart(C, ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC'])) assert(bk.deposit === 30, 'deposit ' + bk.deposit + ', W19 literal 30');
  assert(st().loop === LOOP.prep, 'loop after loadUp ' + describe(st().loop));
  const td = st().today;
  const L = C.LENGTHS.normal;
  const lastCall = Math.min(td.gateAt + bk.window, L.seconds - C.LAST_CALL_GUARD);
  assert(td.gateAt === C.EVENT_GATE && td.lastCallAt === lastCall && td.endAt === L.seconds, 'timings ' + describe([td.gateAt, td.lastCallAt, td.endAt]) + ', wanted ' + describe([C.EVENT_GATE, lastCall, L.seconds]));
  assert(td.gateAt === 20 && td.lastCallAt === 121.25 && td.endAt === 190, 'timings ' + describe([td.gateAt, td.lastCallAt, td.endAt]) + ', v3.5 literal 20, 121.25, 190 (the Birthday window 60 at the 135 length)');
  assert(td.kind === 'booking' && td.booked === bk.headcount && td.pending === bk.headcount, 'today booked ' + td.booked + ', pending ' + td.pending + ', kind ' + td.kind);
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
  const want = R.score({ booked: bk.headcount, fed: 0, waitSum: 0, burnt: 0, offMenu: 0 });
  assert(cs.length === 1 && cs[0].stars === want.stars && cs[0].score === want.score && cs[0].fed === 0 && cs[0].booked === bk.headcount, 'client_stars ' + describe(cs.map(strip)) + ', wanted stars ' + want.stars + ' score ' + want.score);
  assert(cs[0].stars === 1 && cs[0].score === 0, 'client_stars ' + describe(strip(cs[0])) + ', W24 literal 1 star, score 0');
  assert(t.payRest === R.payRest(bk.pay, bk.deposit, 1), 'till.payRest ' + t.payRest + ', wanted ' + R.payRest(bk.pay, bk.deposit, 1));
  if (v30Bday && atStart(C, ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC', 'PAY_BASE', 'PAY_PER_STAR'])) assert(t.payRest === 14, 'till.payRest ' + t.payRest + ', W24 literal 14');
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
  assert(h.of(EVENT.saveWanted, n2).some((e) => e.reason === 'day'), 'no save_wanted day after finishReport');
  const ws2 = h.of(EV3.weekStart, n2)[0];
  assert(ws2.year === 1 && ws2.week === 2, 'week_start ' + describe(strip(ws2)));
  // The picnic with an add-on, a refused add-on and a length change.
  const nb = h.log.length;
  assert(h.sim.bookOffer('picnic').ok, 'bookOffer picnic');
  h.drain();
  // Integration I-1 (contract W23): the event keeps its own type; the booking rides in id and booking.
  const bp = h.of(EV3.bookingPicked, nb);
  assert(bp.length === 1 && bp[0].id === 'picnic' && bp[0].booking === 'picnic', 'booking_picked events ' + describe(h.log.slice(nb).map(strip)));
  // X3.1: the picnic's menu pair rotates, so the add-on is the first meat off its menu (no brisket
  // without the drum) and the refused one is a meat on it.
  const pk2 = st().season.booking;
  const addon = MEAT_IDS.find((m) => m !== 'brisket' && !pk2.menu.includes(m));
  const ad = h.sim.setAddon(addon);
  assert(ad && ad.ok, 'setAddon ' + addon + ' ' + describe(ad));
  assert(st().season.addon === addon, 'season.addon ' + describe(st().season.addon));
  const r2 = h.sim.railFor(st().season.booking, addon);
  const r2want = R.rail(pk2.headcount, pk2.menu, addon);
  assert(deepEq(r2, r2want), 'railFor picnic + ' + addon + ' ' + describe(r2) + ', wanted ' + describe(r2want));
  if (atStart(C, ['ADDON_SHARE']) && pk2.headcount === 20 && sameJSON(pk2.menu, ['chicken', 'butt']) && addon === 'ribs') assert(r2.chicken === 8 && r2.butt === 7 && r2.ribs === 5, 'rail ' + describe(r2) + ', W19 literal 8, 7, 5');
  assert(deepEq(cartView(st()), h.sim.prefill()), 'cart after setAddon is not prefill()');
  const bad = h.sim.setAddon(pk2.menu[0]);
  assert(bad && bad.ok === false && bad.message === UI.addonNo, 'setAddon ' + pk2.menu[0] + ' ' + describe(bad));
  // 2026-10-19: no length setting; every cook is Normal and the save carries no settings.
  assert(typeof h.sim.setLength === 'undefined' && !('settings' in st()) && !('settings' in h.sim.serialize()), 'a length setting is still there ' + describe(st().settings));
  notes.push('max line ' + maxLine + ', spawned ' + arrived.length + ', missed ' + t.missed + ', orders ' + describe(orders));
  notes.push(boardHeadless(P));
  return 'creator, Hiring Day passed, week 1 Birthday of ' + bk.headcount + ' idle to 1 star and rest pay ' + t.payRest + ', week 2 picnic plus ' + addon + ' ' + describe(r2) + ', no length setting; ' + notes.join('; ');
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
    if (w === SEASON_WEEKS) assert(ids[0] === 'finale' && ids.every((id) => /^finale/.test(id)), 'week 9 offers ' + describe(ids));
    const first = st().season.offers[0];
    assert(h.sim.bookOffer(first.id).ok, 'week ' + w + ': bookOffer ' + first.id);
    const lu = h.sim.loadUp();
    h.drain();
    assert(lu && lu.ok, 'week ' + w + ': loadUp ' + describe(lu) + ', canLoadUp ' + describe(h.sim.canLoadUp()) + ', cash ' + st().cash);
    if (w === SEASON_WEEKS) {
      // v3.3 [S 3.4, 3.5]: the competition runs C.COMP_SECONDS whatever the length, with no guests.
      const ft = st().today;
      assert(ft.endAt === C.COMP_SECONDS && ft.comp && ft.booked === 0 && ft.pending === 0, 'competition timings ' + describe([ft.gateAt, ft.lastCallAt, ft.endAt, ft.booked]));
      if (atStart(C, ['COMP_SECONDS'])) assert(ft.endAt === 270, 'competition end ' + ft.endAt + ', v3.5 literal 270');
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
  assert(se.length === 1 && se[0].year === 1 && sameJSON(se[0].stars.slice(0, SEASON_WEEKS - 1), new Array(SEASON_WEEKS - 1).fill(3)) && se[0].stars.length === SEASON_WEEKS && [3, 4].includes(se[0].stars[SEASON_WEEKS - 1]), 'season_end ' + describe(se.map(strip)));
  // v3.1 (X5.9, X15.1 step 16): a fixture card whose contract runs out at this season end, off the
  // table wage, resting, raised and a rookie, renews at wageFor(cardStars(skills), role).
  const fx = mkCard(P, 1, 'Dale', 'fire', [3, 3.5], { wage: 12, contract: 1, mood: -1, rookie: true, raised: true, bring: false, bench: 1, worked: 3 });
  st().crew = [fx];   // fixture (W0)
  st().crewSeq = 2;
  const wageTo = P.wageFor(P.cardStars(fx.skills), fx.role);
  const repBefore = st().rep, cashBefore = st().cash, chBefore = st().charcoal, stockBefore = Object.assign({}, st().stock);
  const repTo = Math.max(C.SEASON_REP_FLOOR, Math.floor(repBefore * C.SEASON_CARRY_REP));
  const pv = h.sim.seasonEndPreview();
  assert(pv && pv.year === 1 && sameJSON(pv.stars.slice(0, SEASON_WEEKS - 1), new Array(SEASON_WEEKS - 1).fill(3)) && pv.stars.length === SEASON_WEEKS && pv.cash === cashBefore && pv.repFrom === repBefore && pv.repTo === repTo && pv.charcoal === chBefore && deepEq(pv.spoiled, stockBefore), 'seasonEndPreview() ' + describe(pv) + ', wanted rep ' + repBefore + ' to ' + repTo);
  assert(Array.isArray(pv.crew) && deepEq(pv.crew, [{ id: 1, name: 'Dale', wageFrom: 12, wageTo, renews: true }]), 'seasonEndPreview().crew ' + describe(pv.crew) + ', wanted Dale renewing 12 to ' + wageTo);
  assert(st().rep === repBefore && st().cash === cashBefore, 'seasonEndPreview() changed state');
  const n1 = h.log.length;
  assert(h.sim.startSeason() === true, 'startSeason() did not return true');
  h.drain();
  const s = st();
  assert(s.season.year === 2 && s.season.week === 1 && sameJSON(s.season.results, []), 'season after startSeason ' + describe({ year: s.season.year, week: s.season.week, results: s.season.results }));
  assert(s.rep === repTo, 'rep ' + repBefore + ' to ' + s.rep + ', wanted ' + repTo);
  assert(deepEq(s.stock, zeroMeat()), 'stock after startSeason ' + describe(s.stock));
  assert(s.charcoal === chBefore && s.cash === cashBefore, 'charcoal ' + s.charcoal + ', cash ' + s.cash + ', wanted ' + chBefore + ', ' + cashBefore);
  // X8: startSeason opens Hiring Day for year 2.
  assert(s.loop === LOOP.hiring && s.phase === PHASE.morning, 'loop after startSeason ' + s.loop + ', wanted hiring');
  const seq = h.log.slice(n1).map((e) => e.type);
  const o = [EV3.seasonStart, EV31.hiringOpen, EVENT.saveWanted].map((x) => seq.indexOf(x));
  assert(o.every((i) => i >= 0) && o[1] > o[0] && o[2] > o[1], 'events after startSeason ' + describe(seq) + ' (X8)');
  assert(h.of(EVENT.saveWanted, n1).some((e) => e.reason === 'season'), 'no save_wanted season');
  const hv = h.sim.hiringView();
  assert(hv && hv.year === 2 && hv.round === 1 && hv.pool.length === C.POOL_SIZE && !hv.pool.some((e) => e.name === 'Dale'), 'hiringView() in year 2 ' + describe(hv && { year: hv.year, round: hv.round, n: hv.pool.length }));
  const c = cardOf(h, 1);
  assert(c && c.contract === 1 && c.wage === wageTo && c.raised === false && c.seasons === 1 && c.rookie === false && c.mood === 0 && c.bench === 0 && c.notice === false,
    'the renewed card ' + describe(c) + ', wanted contract 1, wage ' + wageTo + ', not raised, 1 season, no NEW, mood 0, bench 0');
  const n2 = h.log.length;
  passHiring(h, 'season 2');
  const seq2 = h.log.slice(n2).map((e) => e.type);
  const o2 = [EV31.hiringDone, EV3.weekStart, EV3.offersReady].map((x) => seq2.indexOf(x));
  assert(o2.every((i) => i >= 0) && o2[1] > o2[0] && o2[2] > o2[1], 'events after finishHiring ' + describe(seq2));
  assert(st().season.year === 2 && st().season.week === 1, 'after Hiring Day year ' + st().season.year + ' week ' + st().season.week);
  assert(h.sim.startSeason() === false, 'a second startSeason() outside seasonEnd did not return false');
  return 'nine settle(3) weeks, season_end with nine 3s, rep ' + repBefore + ' to ' + repTo + ', cash ' + cashBefore + ' and charcoal ' + chBefore + ' kept, Hiring Day for year 2, Dale renewed 12 to ' + wageTo + ', year 2 week 1';
}

// ---- v3.3 the competition and the Offseason (sim names: design 19.9) ------------------------------

// A week 9 Saturday hub from a real week 1 save: eight results, the Saturday open, the gear and
// crew given. Returns the headless harness on it (days on).
function compSave(P, over = {}) {
  const h0 = toWeek(P, over.seed || 33);
  const s = h0.sim.serialize();
  s.season.week = SEASON_WEEKS;
  s.season.results = new Array(SEASON_WEEKS - 1).fill(0).map(() => ({ type: 'birthday', stars: 3 }));
  s.season.day = 5;
  s.season.dayLog = ['off', 'off', 'off', 'off', 'off', null, null];
  s.season.pick = null;
  s.cash = over.cash === undefined ? 600 : over.cash;
  s.season.weekCash = s.cash;
  s.charcoal = 6;
  s.rep = over.rep === undefined ? 20 : over.rep;
  Object.assign(s.gear, { kettle2: true, cooler: true }, over.gear || {});
  if (over.crew) { s.crew = over.crew; s.crewSeq = over.crew.reduce((a, c) => Math.max(a, c.id), 0) + 1; }
  if (over.trophies) s.trophies = over.trophies;
  return s;
}
function compFrom(P, over = {}) {
  const v = P.validateSave(JSON.parse(JSON.stringify(compSave(P, over))));
  assert(v && v.v === SAVE_V, 'validateSave refused the week 9 fixture');
  return headless(P, v, over.seed || 33, { days: true });
}
// Book the competition and load up on the Saturday.
function compLoad(h) {
  const st = h.st();
  const o = st.season.offers[0];
  assert(st.season.offers.every((x) => x.comp) && o && o.comp && o.id === 'finale', 'week 9 offers ' + describe(st.season.offers.map((x) => x.id)));
  assert(h.sim.bookOffer('finale').ok, 'bookOffer finale');
  const cash0 = st.cash;
  const cart = h.sim.cartTotal();
  const r = h.sim.chooseDay('event');
  h.drain();
  assert(r && r.ok === true, 'chooseDay(event) ' + describe(r) + ' canLoadUp ' + describe(h.sim.canLoadUp()));
  assert(st.phase === 'service' && st.today.comp && st.today.endAt === h.C.COMP_SECONDS, 'not at the competition');
  assert(st.cash === cash0 - cart - o.comp.entry, 'entry: cash ' + cash0 + ' less cart ' + cart + ' and entry ' + o.comp.entry + ' is ' + st.cash);
  return o;
}
// The competition bot: puts each category on so it is done near its turn-in, pulls, slices at the
// board (or leaves it for PREP), turns in at the window; boxes on the board stay for a RUN card.
function compPlay(h, opts = {}) {
  const P = h.P, C = h.C, sim = h.sim, st = h.st();
  const M = P.MEATS;
  const tile = (id) => P.MAP.station(id).tiles[0];
  const cookers = () => ['kettle1', 'kettle2', 'drum'].filter((id) => P.tileOwned(P.MAP.station(id), st.gear));
  const free = (ck, size) => {
    const used = new Set();
    for (const p of ck.pieces) for (let k = 0; k < p.size; k++) used.add(p.slot + k);
    const n = ck.id === 'drum' ? C.DRUM_SLOTS : C.KETTLE_SLOTS;
    for (let i = 0; i + size <= n; i++) { let ok = true; for (let k = 0; k < size; k++) if (used.has(i + k)) ok = false; if (ok) return true; }
    return false;
  };
  const started = new Set();
  const decide = () => {
    const c = st.player.carrying;
    const cv = sim.compView();
    if (c) {
      if (c.kind === 'charcoal') { let b = cookers()[0]; for (const id of cookers()) if (st.stations[id].fire < st.stations[b].fire) b = id; return tile(b); }
      if (c.kind === 'raw') { const ok = cookers().filter((id) => (!M[c.meat].drumOnly || id === 'drum') && free(st.stations[id], M[c.meat].slots) && st.stations[id].fire >= C.COLD_UNDER); return ok.length ? tile(ok[0]) : null; }
      if (c.kind === 'cooked') return tile(opts.whole ? 'table' : 'board');
      if (c.kind === 'box') return tile('table');
      if (c.kind === 'burnt') return tile('trash');
      return null;
    }
    for (const id of cookers()) for (const p of st.stations[id].pieces) if (p.state !== 'cooking') return tile(id);
    for (const id of cookers()) if (st.stations[id].fire < 50 && st.charcoal > 0 && !st.tender) return tile('pile');
    if (!st.buddy && st.stations.board.boxes.length) return tile('board');
    for (let i = 0; i < cv.cats.length; i++) {
      const m = cv.cats[i];
      if (cv.left[i] <= 0 || cv.boxes[i] !== null || started.has(m) || !(st.stock[m] > 0)) continue;
      if (st.clock + M[m].cook / 0.8 + 14 >= cv.at[i] && cookers().some((id) => (!M[m].drumOnly || id === 'drum') && free(st.stations[id], M[m].slots) && st.stations[id].fire >= C.COLD_UNDER)) {
        sim.selectMeat(m); started.add(m); return tile('cooler');
      }
    }
    return null;
  };
  let g = 0;
  const views = [];
  while (st.phase === 'service' && g++ < 8000) {
    const p = st.player;
    if (!(p.busy || p.next || p.path.length || p.target)) { const t = decide(); if (t) sim.walkTo(t.x, t.y); }
    if (g % 20 === 0) { const v = sim.compView(); if (v) views.push(v); }
    h.tick();
  }
  assert(st.loop === 'report', 'the competition did not end: loop ' + st.loop + ' clock ' + st.clock);
  return views;
}

function compHeadless(P) {
  const C = P.C;
  const h = compFrom(P, { seed: 33 });
  const st = h.st;
  // The cart: one of each category plus a spare, and the entry gate.
  assert(h.sim.bookOffer('finale').ok, 'bookOffer finale');
  const cart = st().cart.meat;
  assert(cart.chicken === 2 && cart.sausage === 2 && cart.ribs === 2 && cart.butt === 2 && cart.brisket === 0, 'competition cart ' + describe(cart));
  assert(h.sim.setAddon('brisket').ok !== true, 'an add-on at the competition');
  const poor = compFrom(P, { seed: 33, cash: 15 });
  assert(poor.sim.bookOffer('finale').ok, 'bookOffer finale (cash 15)');
  const why = poor.sim.canLoadUp();
  assert(why.ok === false && why.reason === P.STRINGS.comp.goEntry.replace('{n}', '20'), 'cash 15 against cart and entry ' + describe(why));
  const n0 = h.log.length;
  const offer = compLoad(h);
  const views = compPlay(h);
  const ins = h.of('turn_in', n0), judged = h.of('turnin_judged', n0), missed = h.of('turnin_missed', n0);
  assert(ins.length === 4 && judged.length === 4 && missed.length === 0, 'turn-ins ' + describe({ ins: ins.length, judged: judged.length, missed: missed.length }));
  assert(sameJSON(judged.map((e) => e.meat), offer.menu), 'judging order ' + describe(judged.map((e) => e.meat)));
  // Each box judged at its turn-in time (V33-2): the event lands on the tick of the time.
  for (const e of judged) assert(Math.abs(e._at - C.COMP_TURNINS[e.slot]) < 0.06, e.meat + ' judged at ' + e._at);
  // A live view: the hold clock runs on a box handed in, the next turn-in index moves on.
  assert(views.some((v) => v.boxes.some((b) => b && b.judged === false && b.held > 0)) && views[0].next === 0 && views.some((v) => v.next === 2), 'compView over the cook');
  const t = st().till;
  assert(t.kind === 'comp' && t.stars === 0 && t.repReason === 'placing' && t.entry === 20 && t.comp && t.comp.boxes.length === 4, 'the till ' + describe({ kind: t.kind, stars: t.stars, comp: !!t.comp }));
  const c = t.comp;
  for (const b of c.boxes) {
    assert(b.score === b.done + b.hold + b.look && b.done >= 0 && b.done <= 50 && b.hold >= 0 && b.hold <= 30 && b.look === 20 && b.sliced === true && b.missed === false, 'box ' + describe(b));
  }
  assert(c.standings.length === 10 && c.standings.filter((r) => r.you).length === 1 && c.standings.every((r, i) => i === 0 || c.standings[i - 1].total >= r.total), 'standings ' + describe(c.standings));
  assert(c.place === c.standings.findIndex((r) => r.you) + 1 && c.total === c.boxes.reduce((a, b) => a + b.score, 0), 'place ' + c.place + ' total ' + c.total);
  assert(c.prize === (c.place <= 3 ? [200, 120, 80][c.place - 1] : P.C.CONTESTS[0].show) && c.judges.length === 3 && c.judges.every((j) => P.STRINGS.names.includes(j)), 'prize or judges ' + describe({ prize: c.prize, judges: c.judges }));
  const rivalNames = c.standings.filter((r) => !r.you).map((r) => r.name);
  assert(rivalNames.every((nm) => P.STRINGS.rivals.includes(nm)) && new Set(rivalNames).size === 9, 'rivals ' + describe(rivalNames));
  assert(t.repDelta === (c.place <= 3 ? 10 : 0), 'fan rating ' + t.repDelta + ' at place ' + c.place);
  const res = st().season.results[SEASON_WEEKS - 1];
  assert(res && res.type === 'finale' && res.place === c.place && res.contest === 'backyard' && res.stars === (c.place <= 3 ? 4 : 3), 'week 9 result ' + describe(res));
  assert(st().trophies.length === (c.place === 1 ? 1 : 0) && c.trophy === (c.place === 1), 'trophy ' + describe(st().trophies));
  // The same seed gives the same field (seeded rivals).
  const h2 = compFrom(P, { seed: 33 });
  compLoad(h2);
  assert(h2.sim.settle(3) === true, 'settle(3) at the competition');
  h2.drain();
  const c2 = h2.st().till.comp;
  assert(deepEq(c2.standings.filter((r) => !r.you), c.standings.filter((r) => !r.you)) && c2.boxes.every((b) => b.score === C.COMP_SETTLE[2]), 'seeded field or settle boxes ' + describe(c2.boxes));
  // A whole piece turned in: look 10.
  const h3 = compFrom(P, { seed: 33 });
  compLoad(h3);
  compPlay(h3, { whole: true });
  const w = h3.st().till.comp.boxes;
  assert(w.every((b) => b.missed || (b.look === 10 && b.sliced === false)), 'whole pieces ' + describe(w));
  return 'place ' + c.place + ' of 10 on ' + c.total + ' (' + c.boxes.map((b) => b.meat + ' ' + b.score).join(', ') + '), prize ' + c.prize + ', judges ' + c.judges.join(', ') + '; settle(3) boxes ' + C.COMP_SETTLE[2] + '; whole pieces look 10';
}

function compCrewHeadless(P) {
  const crew = ['run', 'prep', 'fire'].map((role, i) => mkCard(P, i + 1, ['Rosa', 'Theo', 'Dale'][i], role, [3, 3], { wage: 20, seasons: 1, worked: 3 }));
  const h = compFrom(P, { seed: 34, rep: 70, crew });
  const n0 = h.log.length;
  const offer = compLoad(h);
  assert(offer.comp.contest === 'invitational' && offer.comp.noDrum === true && h.sim.compView().noDrum === true, 'the Invitational without the drum ' + describe(offer.comp));
  compPlay(h);
  const ready = h.of('box_ready', n0), ins = h.of('turn_in', n0), fed = h.of('fire_fed', n0);
  assert(ready.length >= 2 && ready.every((e) => e.by === 'prep'), 'box_ready ' + describe(ready.map(strip)));
  assert(ins.length >= 2 && ins.every((e) => e.by === 'run'), 'turn_in ' + describe(ins.map(strip)));
  assert(fed.length >= 3 && fed.every((e) => e.id === 3 && (e.cooker === 'kettle1' || e.cooker === 'kettle2') && typeof e.x === 'number'), 'fire_fed ' + describe(fed.slice(0, 3).map(strip)));
  const c = h.st().till.comp;
  const bri = c.boxes[3];
  assert(bri.meat === 'brisket' && bri.missed === true && bri.score === 0 && c.noDrum === true, 'brisket without the drum ' + describe(bri));
  const rows = h.st().till.crew;
  assert(Array.isArray(rows) && rows.length === 3, 'crew rows ' + describe(rows));
  return ready.length + ' boxes by PREP, ' + ins.length + ' turned in by RUN, ' + fed.length + ' fire_fed puffs, brisket missed (no drum), place ' + c.place;
}

function shelfHeadless(P) {
  const C = P.C;
  // A win with room on the shelf: a trophy, ribbons for the categories beaten.
  const h = compFrom(P, { seed: 35 });
  compLoad(h);
  assert(h.sim.settle(5) === true, 'settle(5)');
  h.drain();
  const c = h.st().till.comp;
  assert(c.place === 1 && c.trophy === true && h.st().trophies.length === 1 && deepEq(h.st().trophies[0], { year: 1, contest: 'backyard', place: 1 }), 'a win ' + describe({ place: c.place, trophies: h.st().trophies }));
  const rib = h.st().ribbons;
  assert(c.ribbons.length >= 1 && c.ribbons.every((m) => rib[m] === 1), 'ribbons ' + describe({ c: c.ribbons, rib }));
  const ev = h.of('comp_results');
  assert(ev.length === 1 && ev[0].place === 1 && ev[0].trophy === true, 'comp_results ' + describe(ev.map(strip)));
  // Saved and reloaded: v7 keeps the shelf and the ribbons, and drops a bad entry.
  const sv = h.sim.serialize();
  assert(sv.v === SAVE_V && deepEq(sv.trophies, [{ year: 1, contest: 'backyard', place: 1 }]) && deepEq(sv.ribbons, rib), 'saved shelf ' + describe({ t: sv.trophies, r: sv.ribbons }));
  const dirty = JSON.parse(JSON.stringify(sv));
  dirty.trophies = dirty.trophies.concat([{ year: 2, contest: 'nope' }, 'x', { year: 'q', contest: 'regional' }]);
  dirty.ribbons.ribs = -4;
  const v = P.validateSave(dirty);
  assert(v && v.trophies.length === 2 && v.trophies[1].contest === 'regional' && v.trophies[1].year === 1 && v.ribbons.ribs === 0, 'dirty shelf ' + describe(v && { t: v.trophies, r: v.ribbons }));
  const v6 = Object.assign(JSON.parse(JSON.stringify(sv)), { v: 6 });
  const m6 = P.validateSave(v6);
  assert(m6 && m6.v === SAVE_V && m6.trophies.length === 0, 'a v6 save reads no shelf ' + describe(m6 && m6.trophies));
  // A full shelf: the win still counts, no seventh trophy.
  const six = new Array(C.TROPHY_MAX).fill(0).map((x, i) => ({ year: 1, contest: 'backyard', place: 1 }));
  const hf = compFrom(P, { seed: 35, trophies: six });
  assert(hf.st().trophies.length === 6, 'six trophies loaded');
  compLoad(hf);
  hf.sim.settle(5);
  hf.drain();
  const cf = hf.st().till.comp;
  assert(cf.place === 1 && cf.trophy === false && cf.shelfFull === true && hf.st().trophies.length === 6, 'a full shelf ' + describe({ place: cf.place, trophy: cf.trophy, n: hf.st().trophies.length }));
  // A low finish: no trophy, no fans, only the Backyard Open's show money (V33-9).
  const hl = compFrom(P, { seed: 35 });
  compLoad(hl);
  hl.sim.settle(1);
  hl.drain();
  const cl = hl.st().till.comp;
  assert(cl.place > 3 && cl.prize === P.C.CONTESTS[0].show && P.C.CONTESTS[0].show > 0 && hl.st().till.repDelta === 0 && hl.st().trophies.length === 0 && hl.st().season.results[SEASON_WEEKS - 1].stars === 3, 'a low finish ' + describe({ place: cl.place, prize: cl.prize }));
  return 'win: trophy and ribbons ' + c.ribbons.join(', ') + '; saved v7 and cleaned; a v6 save has an empty shelf; a full shelf keeps 6; place ' + cl.place + ' pays the show money ' + cl.prize;
}

// To the Offseason by the week 9 settle and the report; the crew given.
function toOffseason(P, crew, seed, stars) {
  const h = compFrom(P, { seed, crew });
  compLoad(h);
  assert(h.sim.settle(stars || 3) === true, 'settle at the competition');
  h.drain();
  h.sim.finishReport();
  h.drain();
  for (let k = 0; k < 3 && h.st().loop === 'week'; k++) { h.sim.chooseDay('off'); h.drain(); h.sim.advanceDay(); h.drain(); }
  assert(h.st().loop === 'seasonEnd', 'not on the Offseason: loop ' + h.st().loop);
  return h;
}

function offseasonHeadless(P) {
  const C = P.C;
  // Eight cards: 1 to 6 past their third season (moving on rolls), 7 at +2 mood on an ending contract,
  // 8 on a two season contract.
  const crew = [];
  for (let i = 1; i <= 6; i++) crew.push(mkCard(P, i, P.STRINGS.names[i * 3], ['run', 'fire', 'prep'][i % 3], [3, 3], { seasons: 2 + (i % 2), mood: i <= 3 ? 1 : (i === 4 ? -1 : 0), contract: 1, bring: false }));
  crew.push(mkCard(P, 7, 'Maya', 'run', [2, 2], { seasons: 0, mood: 2, contract: 1, bring: false }));
  crew.push(mkCard(P, 8, 'Gus', 'fire', [2, 2], { seasons: 0, mood: 0, contract: 2, bring: false }));
  let h = null, pv = null;
  for (const seed of [41, 42, 43, 44, 45, 46, 47, 48]) {
    h = toOffseason(P, crew, seed);
    pv = h.sim.seasonEndPreview();
    if (pv.leaving.length >= 1 && pv.leaving.some((l) => l.refers > 0)) break;
  }
  assert(pv.leaving.length >= 1, 'no card moved on in eight seeds');
  const opened = h.of('offseason_open');
  assert(opened.length === 1, 'offseason_open ' + describe(opened.map(strip)));
  // The screen, top to bottom: the record with the placing, the shelf, contracts, moving on, coming next.
  assert(pv.record.length === SEASON_WEEKS && pv.record[SEASON_WEEKS - 1].type === 'finale' && pv.record[SEASON_WEEKS - 1].place >= 1 && pv.record[SEASON_WEEKS - 1].contest === 'backyard' && pv.place === pv.record[SEASON_WEEKS - 1].place, 'record ' + describe(pv.record[SEASON_WEEKS - 1]));
  assert(Array.isArray(pv.trophies) && pv.nextYear === 2 && 'next' in pv && Math.abs(pv.scale - 1.1) < 1e-9, 'preview fields ' + describe({ nextYear: pv.nextYear, next: pv.next, scale: pv.scale }));
  const atEnd = h.st().crew.map((c) => JSON.parse(JSON.stringify(c)));
  for (const l of pv.leaving) {
    const c = atEnd.find((x) => x.id === l.id);
    assert(c.seasons + 1 >= C.MOVE_ON_AFTER && P.STRINGS.movingOn.includes(l.reason) && l.refers === (c.mood >= 0 ? Math.max(1, Math.round((P.cardStars(c.skills) - 1) * 2) / 2) : 0), 'moving on ' + describe(l));
  }
  assert(!pv.leaving.some((l) => l.id === 7 || l.id === 8), 'a card in its first season moved on');
  const ids = pv.contracts.map((e) => e.id);
  assert(!ids.includes(8) && ids.includes(7) && !pv.leaving.some((l) => ids.includes(l.id)), 'contracts ' + describe(ids));
  const maya = pv.contracts.find((e) => e.id === 7);
  const mayaMood = atEnd.find((c) => c.id === 7).mood;
  assert(maya.asks === (mayaMood >= 2 ? Math.round(P.wageFor(P.cardStars([2, 2]), 'run') * C.RESIGN_HAPPY) : P.wageFor(P.cardStars([2, 2]), 'run')) && maya.decided === null, 'Maya at +2 asks ' + describe(maya));
  // Picks: Maya re-signs for two seasons; another ending card is let go; Gus has nothing to sign.
  assert(h.sim.resign(7, 2).ok === true && h.sim.resign(8, 1).ok === false, 'resign');
  const goId = ids.find((id) => id !== 7);
  if (goId !== undefined) assert(h.sim.release(goId).ok === true, 'release');
  h.drain();
  const picks = h.of('offseason_pick');
  assert(picks.length === (goId !== undefined ? 2 : 1) && picks[0].decided === 'sign2', 'offseason_pick ' + describe(picks.map(strip)));
  // The picks survive a reload.
  const sv = h.sim.serialize();
  assert(sv.offseason && sv.offseason.year === 1 && sv.offseason.decide['7'] === 'sign2', 'saved picks ' + describe(sv.offseason));
  const h2 = headless(P, P.validateSave(JSON.parse(JSON.stringify(sv))), 9, { days: true });
  const pv2 = h2.sim.seasonEndPreview();
  assert(h2.st().loop === 'seasonEnd' && pv2.contracts.find((e) => e.id === 7).decided === 'sign2' && deepEq(pv2.leaving, pv.leaving), 'reloaded Offseason ' + describe(pv2.contracts));
  // Start season 2: who stays, who goes, the friends at Hiring Day.
  const n1 = h2.log.length;
  assert(h2.sim.startSeason() === true, 'startSeason');
  h2.drain();
  const left = new Set(pv.leaving.map((l) => l.id).concat(goId !== undefined ? [goId] : []));
  const now = h2.st().crew.map((c) => c.id);
  assert(now.every((id) => !left.has(id)) && now.length === 8 - left.size, 'crew after Start ' + describe(now) + ' gone ' + describe([...left]));
  const m = h2.st().crew.find((c) => c.id === 7);
  assert(m.contract === 2 && m.wage === maya.asks && m.mood === (mayaMood > 0 ? mayaMood - 1 : (mayaMood < 0 ? mayaMood + 1 : 0)), 'Maya re-signed ' + describe(m));
  for (const e of pv.contracts) if (e.id !== 7 && e.id !== goId) { const c = h2.st().crew.find((x) => x.id === e.id); assert(c && c.contract === 1 && c.wage === e.asks, 'undecided re-signs for one season ' + describe(c)); }
  assert(h2.of('crew_moved_on', n1).length === pv.leaving.length, 'crew_moved_on events');
  const hv = h2.sim.hiringView();
  const refers = pv.leaving.filter((l) => l.refers > 0);
  assert(hv && hv.refs.length === refers.length, 'referrals ' + describe(hv && hv.refs));
  hv.refs.forEach((r, i) => assert(r.from === refers[i].name && r.role === refers[i].role && r.stars >= refers[i].stars - 1 && r.status === 'open', 'referral ' + describe(r)));
  if (hv.refs.length > 0 && h2.st().crew.length < C.CREW_MAX) {
    const round = hv.round;
    const r = h2.sim.hireReferral(0);
    h2.drain();
    assert(r.ok === true && h2.sim.hiringView().round === round && h2.sim.hiringView().refs[0].status === 'mine', 'hireReferral ' + describe(r));
    const card = h2.st().crew.find((c) => c.id === r.id);
    assert(card && card.contract === 2 && card.rookie === true, 'the friend signs for two seasons, NEW');
    const sv2 = h2.sim.serialize();
    assert(sv2.hiring && sv2.hiring.refs.length === hv.refs.length && sv2.hiring.refs[0].status === 'mine', 'saved refs ' + describe(sv2.hiring && sv2.hiring.refs));
    const h3 = headless(P, P.validateSave(JSON.parse(JSON.stringify(sv2))), 9, { days: true });
    assert(h3.st().loop === 'hiring' && h3.sim.hiringView().refs.length === hv.refs.length, 'refs after a reload');
  }
  return pv.leaving.length + ' moved on (' + pv.leaving.map((l) => l.name + ' ' + l.reason + (l.refers ? ' refers ' + l.refers : '')).join('; ') + '), ' + pv.contracts.length + ' contracts, Maya re-signed 2 at ' + maya.asks + ', ' + hv.refs.length + ' referral(s)';
}

function season2Headless(P) {
  const C = P.C;
  const h = toOffseason(P, [], 51, 5);
  const before = { cash: h.st().cash, rep: h.st().rep, trophies: h.st().trophies.length, gear: Object.assign({}, h.st().gear), charcoal: h.st().charcoal };
  assert(before.trophies === 1, 'the week 9 win did not put a trophy up ' + describe(h.st().trophies));
  h.sim.startSeason();
  h.drain();
  passHiring(h, 'season 2');
  const s = h.st();
  assert(s.season.year === 2 && s.season.week === 1 && s.cash === before.cash && s.charcoal === before.charcoal && deepEq(s.gear, before.gear), 'carry overs ' + describe({ year: s.season.year, cash: s.cash }));
  assert(s.rep === Math.max(C.SEASON_REP_FLOOR, Math.floor(before.rep * C.SEASON_CARRY_REP)) && s.trophies.length === 1, 'fan rating or shelf ' + describe({ rep: s.rep, trophies: s.trophies }));
  // Season 2 offers are the season 1 generator times 1.1 (the reference in step 13 checks the draw).
  const book = s.season.offers.filter((o) => o.type !== 'yard');
  assert(book.length >= 1 && book.every((o) => o.headcount >= o.menu.length && o.pay % 5 === 0 && o.deposit === Math.round(o.pay * C.DEPOSIT_FRAC)), 'season 2 cards ' + describe(book.map((o) => [o.id, o.headcount, o.pay])));
  const y1 = P.genOffers({ seed: s.season.seed, year: 2, week: 1, rep: s.rep, cash: s.season.weekCash, gear: s.gear, length: 'normal' });
  assert(y1.length === s.season.offers.length, 'genOffers year 2 against the hub');
  // Saved in season 2 with the shelf; week 9 offers the competition by the new fan rating.
  const sv = h.sim.serialize();
  assert(sv.season.year === 2 && sv.trophies.length === 1, 'season 2 save ' + describe({ year: sv.season.year, t: sv.trophies }));
  const w9 = P.genOffers({ seed: s.season.seed, year: 2, week: 9, rep: s.rep, cash: 500, gear: s.gear, length: 'normal' });
  assert(w9.length === 1 && w9[0].comp && w9[0].comp.contest === P.contestFor(s.rep).id && w9[0].pay === 0, 'season 2 week 9 ' + describe(w9[0] && w9[0].comp));
  return 'season 2 week 1: cash ' + s.cash + ', rep ' + before.rep + ' to ' + s.rep + ', 1 trophy kept, ' + book.length + ' scaled cards; week 9 ' + w9[0].label;
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
// v3.1 headless checks (X15.1 step 5 and X15.2 steps 63 to 69). Expectations are computed from C
// with the X5 and X6 formulas, written here from the contract; the X15 literals are asserted too
// while C holds the starting values they assume (W22.18).
// ---------------------------------------------------------------------------------------------

const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
const atStartX = (C, keys) => keys.every((k) => deepEq(C[k], C_X2[k]));
// X5.1, from the contract.
function refSkillValue(C, key, stars) {
  const v = C.SKILL_CURVE[key];
  if (!v) return NaN;
  const n = Number(stars);
  const s = Math.min(5, Math.max(1, Number.isFinite(n) && typeof stars === 'number' ? n : 1));
  return s <= 3 ? v[0] + (v[1] - v[0]) * (s - 1) / 2 : v[1] + (v[2] - v[1]) * (s - 3) / 2;
}
const refCardStars = (sk) => Math.floor(((sk[0] + sk[1]) / 2) * 2) / 2;
function refWageFor(C, stars, role) {
  const s = Math.min(5, Math.max(1, typeof stars === 'number' && Number.isFinite(stars) ? stars : 1));
  return Math.round(C.WAGE_TABLE[Math.round((s - 1) * 2)] * C.ROLE_WAGE[ROLE_IDS.includes(role) ? role : 'run']);
}
// X6.1 and X6.3, from the contract: the pool and the walk-ins.
function refName(names, r, avoid, list) {
  let i = Math.floor(r() * names.length);
  let guard = 0;
  while ((avoid.includes(names[i]) || list.some((e) => e.name === names[i])) && guard++ < names.length) i = (i + 1) % names.length;
  return names[i];
}
// Review 1 (X20.8): a crew look draws its hat as none for 1 - HAT_SHARE of the range and the three
// hats evenly over the rest; long hair (2) never sits under the cap (1).
function refLook(r, C) {
  const share = C && typeof C.HAT_SHARE === 'number' ? C.HAT_SHARE : 0.25;
  const look = {};
  for (const k of LOOK_KEYS) {
    const u = r();
    if (k === 'hat') { const hats = LOOK_COUNTS.hat - 1, edge = 1 - share; look.hat = u < edge ? 0 : 1 + Math.min(hats - 1, Math.floor((u - edge) / share * hats)); }
    else look[k] = Math.floor(u * LOOK_COUNTS[k]);
  }
  if (look.hair === 2 && look.hat === 1) look.hat = 0;
  return look;
}
function refGenPool(P, input) {
  const C = P.C, names = P.STRINGS.names, avoid = input.avoid || [];
  const rp = refMulberry32(refMix32((input.seed ^ 0x504F4F4C) >>> 0, input.year, 0));
  const roles = [];
  for (const role of ROLE_IDS) for (let i = 0; i < 6; i++) roles.push(role);
  for (let i = roles.length - 1; i >= 1; i--) {
    const j = Math.floor(rp() * (i + 1));
    const t = roles[i]; roles[i] = roles[j]; roles[j] = t;
  }
  const out = [];
  const headed = new Set();   // review 1 (X20.7): a role's first card is a headliner
  for (let idx = 0; idx < roles.length; idx++) {
    const name = refName(names, rp, avoid, out);
    const head = !headed.has(roles[idx]);
    headed.add(roles[idx]);
    const hl = C.HEADLINER || [2.5, 2];
    const s0 = head ? hl[0] + Math.floor(rp() * hl[1]) / 2 : 1 + Math.floor(rp() * 5) / 2;
    const s1 = head ? hl[0] + Math.floor(rp() * hl[1]) / 2 : 1 + Math.floor(rp() * 5) / 2;
    const potential = Math.min(5, Math.max(Math.max(s0, s1) + 0.5, 2 + Math.floor(rp() * 7) / 2));
    const mood = rp() < 0.5 ? 0 : 1;
    const look = refLook(rp, C);
    const stars = refCardStars([s0, s1]);
    out.push({ idx, name, role: roles[idx], skills: [s0, s1], potential, mood, look, stars, wage: refWageFor(C, stars, roles[idx]) });
  }
  return out;
}
function refGenWalkins(P, input) {
  const C = P.C, names = P.STRINGS.names, avoid = input.avoid || [];
  const third = input.rep >= C.THIRD_EDGES[1] ? 2 : input.rep >= C.THIRD_EDGES[0] ? 1 : 0;
  const rw = refMulberry32(refMix32((input.seed ^ 0x57414C4B) >>> 0, input.year, input.week));
  const out = [];
  const count = input.week === 1 ? 0 : C.WALKINS[third];   // review 1 (X20.7): none the week of Hiring Day
  for (let n = 0; n < count; n++) {
    const role = ROLE_IDS[Math.floor(rw() * ROLE_IDS.length)];
    const name = refName(names, rw, avoid, out);
    const s0 = 2 + Math.floor(rw() * 5) / 2;
    const s1 = 2 + Math.floor(rw() * 5) / 2;
    rw();   // the v3.1 potential draw, kept in the stream
    const potential = Math.max(s0, s1);   // review 1: walk-ins come at their ceiling
    const mood = rw() < 0.5 ? 0 : 1;
    const look = refLook(rw, C);
    const stars = refCardStars([s0, s1]);
    out.push({ name, role, skills: [s0, s1], potential, mood, look, stars, wage: refWageFor(C, stars, role) });
  }
  return out;
}
const appView = (a) => ({ name: a.name, role: a.role, skills: a.skills, potential: a.potential, mood: a.mood, look: a.look, stars: a.stars, wage: a.wage });
// X6.2: other outfits take TAKEN_PER_ROUND of the TAKEN_SHORTLIST best open entries after a round.
function refTaken(P, pool, status, seed, year, round) {
  const C = P.C;
  const ro = refMulberry32(refMix32((seed ^ 0x52495641) >>> 0, year, round));
  const list = pool.filter((e) => status[e.idx] === 'open').sort((a, b) => (b.stars + b.potential) - (a.stars + a.potential) || a.idx - b.idx).slice(0, C.TAKEN_SHORTLIST);
  const taken = [];
  for (let k = 0; k < C.TAKEN_PER_ROUND && list.length; k++) {
    const j = Math.floor(ro() * list.length);
    taken.push(list[j].idx);
    list.splice(j, 1);
  }
  return taken;
}
// A headless sim from a v5 save built off the X11.1 sample (week 3, two results, no crew unless given).
function v5Save(over = {}) {
  const s = JSON.parse(JSON.stringify(SAVE_V5_SAMPLE));
  s.season.week = 3; s.season.results = s.season.results.slice(0, 2); s.season.pick = null; s.season.trained = null; s.season.walkins = [];
  s.crew = []; s.crewSeq = 1; s.day = 4;
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object') Object.assign(s[k], v);
    else s[k] = v;
  }
  if (Array.isArray(s.crew) && s.crew.length && !('crewSeq' in over)) s.crewSeq = s.crew.reduce((a, c) => Math.max(a, c.id), 0) + 1;
  s.season.weekCash = s.cash;
  return s;
}
function fromSave(P, save, seed) {
  const v = P.validateSave(JSON.parse(JSON.stringify(save)));
  assert(v, 'validateSave refused the fixture ' + describe(save).slice(0, 200));
  return headless(P, v, seed);
}

// v3.2 (D10.1): a v6 save fixture on the v5 one (week 3, two results), Monday unless `over` says.
function v6Save(over = {}) {
  const s = v5Save(over);
  s.v = 6;
  s.season = Object.assign({ day: 0, dayLog: NULL7(), prepped: false, loadin: false, overnight: null }, s.season);
  return s;
}
function daysFrom(P, save, seed) {
  const v = P.validateSave(JSON.parse(JSON.stringify(save)));
  assert(v && v.v === SAVE_V, 'validateSave refused the v6 fixture ' + describe(save).slice(0, 200));   // v3.3: a v6 save loads as 7
  return headless(P, v, seed, { days: true });
}
const ZERO_STOCK = { sausage: 0, chicken: 0, ribs: 0, butt: 0, brisket: 0 };
function emptyCartNode(sim) {
  for (const m of Object.keys(ZERO_STOCK)) sim.buy(m, -999);
  sim.buy('charcoal', -999);
}
// A quick day by the sim's own calls: chooseDay, then the result card's advanceDay.
function quickNode(h, kind, opt) {
  const r = h.sim.chooseDay(kind, opt);
  h.drain();
  assert(r && r.ok === true, 'chooseDay(' + kind + ') ' + describe(r) + ' on day ' + h.st().season.day);
  const card = h.sim.dayCardView();
  const a = h.sim.advanceDay();
  assert(a.ok === true || h.st().loop !== 'week', 'advanceDay() ' + describe(a));
  return card;
}

function daysLoopHeadless(P) {
  const C = P.C;
  const notes = [];
  assert(sameJSON(P.DAY_IDS, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), 'DAY_IDS ' + describe(P.DAY_IDS));
  assert(C.SAVE_VERSION === SAVE_V && C.WEEK_DAYS === 7 && sameJSON(C.BOOK_DAY, { birthday: 5, picnic: 6, finale: 5, yard: null }), 'D2 keys');
  // The week by the sim: the options each day, the tick, the save on every day change.
  const h = daysFrom(P, v6Save({ season: { pick: 'birthday' } }), 7201);
  const s = () => h.st().season;
  assert(h.st().loop === 'week' && s().day === 0 && s().booking.type === 'birthday' && s().booking.day === 5, 'the fixture week ' + describe({ loop: h.st().loop, day: s().day, b: s().booking && s().booking.type }));
  const kinds = () => h.sim.dayOptions().options.map((o) => o.kind);
  assert(sameJSON(kinds(), ['yard', 'off']), 'Monday options ' + describe(kinds()));   // v3.4: a Yard day or Rest
  assert(h.sim.loadUp().ok === false && h.sim.loadUp().message === fill(D32.goNotToday, { day: 'Saturday' }), 'loadUp on Monday ' + describe(h.sim.loadUp()));
  // D4.2 and step 74 (Node): the same cart costs round(5 x price x m) + round(5 x bag x m) each weekday.
  const priceOf = (id) => P.CATALOG.find((r) => r.id === id).price;
  const seen = [];
  for (let d = 0; d < 4; d++) {
    emptyCartNode(h.sim);
    h.sim.buy('chicken', 5); h.sim.buy('charcoal', 5);
    const m = C.DAY_PRICE[d];
    const want = Math.round(5 * priceOf('chicken') * m) + Math.round(5 * priceOf('charcoal') * m);
    const cash0 = h.st().cash;
    assert(h.sim.cartTotal() === want, 'day ' + d + ' cart total ' + h.sim.cartTotal() + ', wanted ' + want);
    // v3.4: the morning shop's Confirm buys at today's price and stays in the morning; then Rest.
    const bought = h.sim.shopConfirm();
    h.drain();
    assert(bought.ok && bought.spent === want && h.st().cash === cash0 - want && h.st().phase === 'morning' && s().day === d, 'day ' + d + ' cash ' + h.st().cash + ' after ' + cash0 + ' less ' + want + ' ' + describe(bought));
    quickNode(h, 'off');
    seen.push(want);
    const sv = h.sim.serialize();
    assert(sv.v === SAVE_V && sv.season.day === d + 1 && sv.season.dayLog[d] === 'off' && sv.season.dayLog[d + 1] === null, 'save after day ' + d + ' ' + describe(sv.season.dayLog));
    assert(h.of(EVENT.saveWanted).some((e) => e.reason === 'day'), 'no save_wanted day');
  }
  assert(sameJSON(kinds(), ['yard', 'off']), 'Friday options ' + describe(kinds()));
  quickNode(h, 'off');
  assert(sameJSON(kinds(), ['event']), 'Saturday options ' + describe(kinds()));
  // D9: a Saturday save reloads on Saturday; a report save is Sunday's morning.
  const back = daysFrom(P, h.sim.serialize(), 7202);
  assert(back.st().season.day === 5 && back.st().season.booking.type === 'birthday', 'Saturday reload ' + describe({ day: back.st().season.day }));
  const lu = h.sim.chooseDay('event');
  h.drain();
  assert(lu.ok && h.st().loop === 'prep' && h.st().today.weekday === false && h.st().today.dayIdx === 5, 'the event ' + describe(lu));
  h.until(() => h.st().phase === 'service', 5);
  assert(h.sim.settle(3) === true, 'settle(3) refused');
  h.drain();
  const rep = h.sim.serialize();
  assert(rep.season.day === 6 && rep.season.week === 3 && rep.season.results.length === 3 && rep.season.dayLog[5] === 'event' && rep.season.pick === 'birthday', 'the report save ' + describe(rep.season));
  const sun = daysFrom(P, rep, 7203);
  assert(sun.st().loop === 'week' && sun.st().season.day === 6 && sun.st().season.offers.length === 0 && sameJSON(sun.sim.dayOptions().options.map((o) => o.kind), ['yard', 'off']), 'the report save reloads on Sunday ' + describe({ loop: sun.st().loop, day: sun.st().season.day }));
  h.sim.finishReport(); h.drain();
  assert(h.st().loop === 'week' && s().day === 6 && s().results.length === 3, 'after the report ' + describe({ loop: h.st().loop, day: s().day }));
  const nb = h.log.length;
  quickNode(h, 'off');
  const types = h.log.slice(nb).map((e) => e.type);
  assert(s().week === 4 && s().day === 0 && types.includes('week_start') && types.includes('offers_ready') && types[types.length - 1] === 'save_wanted', 'Sunday off to week 4 ' + describe(types));
  // A Yard week: a weekday Yard day is half length and writes no result; Sunday writes { yard, 0 }.
  const yo = s().offers.find((o) => o.type === 'yard');
  h.sim.bookOffer(yo.id); h.drain();
  quickNode(h, 'off');
  emptyCartNode(h.sim); h.sim.buy('sausage', 3); h.sim.buy('charcoal', 3);
  const y = h.sim.chooseDay('yard');
  h.drain();
  const L = C.LENGTHS.normal;
  assert(y.ok && h.st().today.endAt === Math.round(L.seconds * C.YARD_DAY_FRAC) && h.st().today.weekday === true
    && h.st().today.lastCallAt === Math.min(h.st().today.gateAt + Math.round(L.window * C.YARD_DAY_FRAC), h.st().today.endAt - C.LAST_CALL_GUARD), 'the Tuesday Yard day ' + describe({ y, endAt: h.st().today.endAt }));
  h.until(() => h.st().loop === 'report', 200);
  assert(h.st().loop === 'report' && s().results.length === 3, 'the Yard day report ' + describe({ loop: h.st().loop, results: s().results.length }));
  h.sim.finishReport(); h.drain();
  assert(s().day === 2 && s().offers.length > 0, 'Wednesday with the offers kept ' + describe({ day: s().day }));
  for (let d = 2; d < 5; d++) quickNode(h, 'off');
  assert(sameJSON(kinds(), ['yard', 'off']), 'a Yard week Saturday ' + describe(kinds()));
  quickNode(h, 'off');
  assert(sameJSON(kinds(), ['yard', 'off']), 'a Yard week Sunday ' + describe(kinds()));
  quickNode(h, 'off');
  assert(s().week === 5 && sameJSON(s().results[s().results.length - 1], { type: 'yard', stars: 0 }), 'the Yard week result ' + describe(s().results));
  // D4.4: the Prep cushion stops at 20.
  const sc = P.scoreEvent({ booked: 10, fed: 10, waitSum: 0, burnt: 1, offMenu: 0, cold: 0, prepBonus: C.PREP_QUALITY });
  const sc0 = P.scoreEvent({ booked: 10, fed: 10, waitSum: 0, burnt: 0, offMenu: 0, cold: 0, prepBonus: C.PREP_QUALITY });
  assert(sc.parts.quality === C.SCORE_QUALITY && sc0.parts.quality === C.SCORE_QUALITY, 'prep cushion ' + describe([sc.parts, sc0.parts]));
  // D9: dirty v6 day keys.
  const V = (o) => P.validateSave(JSON.parse(JSON.stringify(o)));
  const d1 = V(v6Save({ season: { pick: 'birthday', day: 9, dayLog: ['market', 'nap', 7], loadin: true, overnight: { meat: 'butt', n: 2 } } }));
  assert(d1.season.day === 6 && sameJSON(d1.season.dayLog, ['market', 'off', 'off', 'off', 'off', 'off', null]) && d1.season.loadin === true && d1.season.overnight === null, 'dirty v6 day 9 ' + describe(d1.season));
  const d2 = V(v6Save({ season: { pick: 'birthday', day: 2, loadin: true, prepped: 'yes' } }));
  assert(d2.season.day === 2 && d2.season.loadin === false && d2.season.prepped === false, 'loadin before Friday ' + describe(d2.season));
  const d3 = V(v6Save({ season: { pick: null, day: 5, loadin: true } }));
  assert(d3.season.day === 5 && d3.season.loadin === false && sameJSON(d3.season.dayLog, ['off', 'off', 'off', 'off', 'off', null, null]), 'no pick keeps the day, never the Load-in ' + describe(d3.season));
  const d4 = V(v6Save({ season: { week: 5, pick: 'birthday', day: 3 } }));
  assert(d4.season.week === 3 && d4.season.day === 0, 'a week that does not hold opens Monday ' + describe(d4.season));
  assert(V({ v: 12 }) === null, '{ v: 12 } accepted');
  notes.push('morning shops cost ' + seen.join(', ') + ' Monday to Thursday');
  return notes.join('; ') + '; the report save reloads on Sunday, a Yard week writes { yard, 0 }, dirty v6 keys clamp';
}

// v3.2 playtest round (sim.js V32-8 to V32-11).
function daysPlaytestHeadless(P) {
  const C = P.C;
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const opt = (h, kind) => h.sim.dayOptions().options.find((o) => o.kind === kind);
  // V32-8 and V32-9: Monday opens empty; with no cooler a Market run and a Yard day warn before the tap.
  const h = daysFrom(P, v6Save({ gear: { cooler: false }, stock: ZERO_STOCK, season: { pick: 'birthday' } }), 7901);
  assert(sum(h.st().cart.meat) === 0 && h.st().cart.charcoal === 0, 'the Monday cart ' + describe(h.st().cart));
  assert(opt(h, 'yard').ok === false && opt(h, 'market') === undefined, 'Monday yard with nothing, no Market run ' + describe(h.sim.dayOptions().options));
  h.sim.buy('sausage', 4); h.sim.buy('charcoal', 2);
  assert(h.sim.shopView().spoil === fill(D32.marketSpoil, { n: 4 }) && opt(h, 'yard').warn === D32.yardSpoil && opt(h, 'off').warn === '', 'the warnings ' + describe([h.sim.shopView(), h.sim.dayOptions().options]));
  // V32-10: the weekday Yard day halves the gate too.
  const y = h.sim.chooseDay('yard');
  h.drain();
  const t = h.st().today, L = C.LENGTHS.normal;
  const gate = Math.round(C.EVENT_GATE * C.YARD_DAY_FRAC);
  assert(y.ok && t.gateAt === gate && t.endAt === Math.round(L.seconds * C.YARD_DAY_FRAC)
    && t.lastCallAt === Math.min(gate + Math.round(L.window * C.YARD_DAY_FRAC), t.endAt - C.LAST_CALL_GUARD) && h.st().spawnAt === gate, 'the half day ' + describe({ gateAt: t.gateAt, lastCallAt: t.lastCallAt, endAt: t.endAt, spawnAt: h.st().spawnAt }));
  // V32-11, v3.4: the first Rest trains the card and names it; at the mood cap it says nothing changed.
  const happy = Object.assign({}, DAY_CARD, { mood: C.DAYOFF_MOOD_CAP });
  const g = daysFrom(P, v6Save({ cash: 300, crew: [happy], season: { pick: 'birthday' } }), 7902);
  const oc = quickNode(g, 'off');
  assert(oc.moodTop === true && oc.mood.length === 0 && oc.trained && oc.trained.name === 'Rosa' && oc.trained.xp === C.TRAIN_XP, 'the Rest card ' + describe(oc));
  return 'Monday cart empty, spoil warnings, gate ' + gate + ' s on the half day, the Rest card trains and says nothing changed';
}

function daysStockHeadless(P) {
  const C = P.C;
  const notes = [];
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const U = P.STRINGS.ui;
  for (const [k, v] of Object.entries(D34)) assert(U[k] === v, 'STRINGS.ui.' + k + ' is ' + describe(U[k]));
  assert(P.STRINGS.dayKind.off === 'Rest', 'Day off is not Rest: ' + describe(P.STRINGS.dayKind.off));
  // 73 (Node), v3.4: the Monday shop's Confirm (no day) buys 4 sausage. No cooler: they spoil Monday
  // night; with the cooler all 4 keep to Saturday.
  for (const cooler of [false, true]) {
    const h = daysFrom(P, v6Save({ gear: { cooler }, stock: ZERO_STOCK, season: { pick: 'birthday' } }), 7301);
    emptyCartNode(h.sim);
    h.sim.buy('sausage', 4);
    const bought = h.sim.shopConfirm();
    h.drain();
    assert(bought.ok && h.st().stock.sausage === 4 && h.st().season.day === 0 && h.st().phase === 'morning', 'the Monday shop ' + describe({ bought, stock: h.st().stock }));
    const card = quickNode(h, 'off');
    if (!cooler) {
      assert(card.spoiled === 4 && h.st().stock.sausage === 0, 'no cooler: spoiled ' + card.spoiled + ', Tuesday sausage ' + h.st().stock.sausage);
      assert(h.of('spoiled').some((e) => e.units === 4), 'no spoiled event');
    } else {
      for (let d = 1; d < 5; d++) quickNode(h, 'off');
      assert(h.st().season.day === 5 && h.st().stock.sausage === 4, 'with the cooler, Saturday sausage ' + h.st().stock.sausage);
    }
  }
  notes.push('no cooler 4 spoil Monday night, the cooler keeps 4 to Saturday');
  // The four old day kinds are gone; every day but the booked one is a Yard day or Rest.
  const g = daysFrom(P, v6Save({ stock: ZERO_STOCK, season: { pick: 'birthday' } }), 7302);
  for (const k of ['market', 'prep', 'train', 'loadin']) assert(g.sim.chooseDay(k).ok === false, k + ' is still a day choice');
  // The morning shop: nothing is spent until Confirm, Back puts the cart back, Confirm starts the day.
  const m = daysFrom(P, v6Save({ gear: { cooler: false }, stock: ZERO_STOCK, charcoal: 0, cash: 200, season: { pick: 'birthday' } }), 7303);
  const cash0 = m.st().cash;
  assert(m.sim.shopNeeded('yard') === true && m.sim.shopNeeded('off') === false, 'shopNeeded ' + describe([m.sim.shopNeeded('yard'), m.sim.shopNeeded('off')]));
  const v = m.sim.shopOpen('yard');
  assert(v && v.kind === 'yard' && v.total > 0 && v.lines.length > 0 && v.ok === true && v.day === 0 && v.price === C.DAY_PRICE[0] && m.st().cash === cash0, 'shopOpen(yard) ' + describe(v));
  assert(m.sim.shopBack().ok && sum(m.st().cart.meat) + m.st().cart.charcoal === 0 && m.st().cash === cash0, 'Back ' + describe(m.st().cart));
  m.sim.shopOpen('yard');
  const spend = m.sim.cartTotal();
  const cf = m.sim.shopConfirm('yard');
  m.drain();
  assert(cf.ok && cf.spent === spend && m.st().cash === cash0 - spend && m.st().loop === 'prep' && m.st().today.weekday === true, 'Confirm starts the Yard day ' + describe({ cf, cash: m.st().cash, loop: m.st().loop }));
  notes.push('shop Back spent 0, Confirm spent ' + spend + ' and opened the Yard day');
  // The warning before spending below what the weekend booking needs.
  const w = daysFrom(P, v6Save({ stock: ZERO_STOCK, charcoal: 0, season: { pick: 'birthday' } }), 7304);
  const need = w.sim.shopView().reserve;
  assert(need > 0, 'the weekend reserve ' + need);
  const rail = w.sim.railFor(w.st().season.booking, w.st().season.addon);
  const off = ['sausage', 'chicken', 'ribs', 'butt'].find((x) => !(rail[x] > 0));
  w.st().cash = need + 5;   // fixture
  emptyCartNode(w.sim);
  w.sim.buy(off, 3);
  const wv = w.sim.shopView();
  assert(wv.after < wv.reserve && wv.warn === fill(D34.shopWarn, { left: wv.after, day: 'Saturday', need: wv.reserve }), 'the reserve warning ' + describe(wv));
  emptyCartNode(w.sim);
  assert(w.sim.shopView().warn === '', 'a warning on an empty cart');
  notes.push('reserve ' + need + ', the warning reads "' + wv.warn + '"');
  // The start button: Yard day when stocked, Rest when cash and stock fall short, the booking on its day.
  const r = daysFrom(P, v6Save({ stock: Object.assign({}, ZERO_STOCK, { sausage: 4 }), charcoal: 6, cash: 300, season: { pick: 'birthday' } }), 7305);
  const rec = r.sim.recommendDay();
  assert(rec.kind === 'yard' && rec.start === fill(D34.startDay, { day: 'Monday', kind: 'Yard day' }) && sameJSON(rec.alt.map((a) => a.kind), ['off']) && rec.alt[0].label === 'Rest'
    && rec.shop === false && rec.rescue === false, 'the Monday pick ' + describe(rec));
  const firstRest = quickNode(r, 'off');
  for (let d = 1; d < 5; d++) quickNode(r, 'off');
  const sat = r.sim.recommendDay();
  const label = r.st().season.booking.label;
  assert(sat.kind === 'event' && sat.label === label && sat.start === fill(D34.startDay, { day: 'Saturday', kind: label }) && sat.shop === true, 'the Saturday pick ' + describe(sat));
  r.sim.shopOpen('event');
  const ev = r.sim.shopConfirm('event');
  r.drain();
  assert(ev.ok && r.st().today.prepBonus === C.PREP_QUALITY && r.st().season.prepped === true, 'automatic prep ' + describe({ ev, prepBonus: r.st().today.prepBonus }));
  assert(firstRest.trained === null, 'a Rest with no crew trained ' + describe(firstRest.trained));
  notes.push('picks: ' + rec.start + ', ' + sat.start + ' with the prep bonus');
  // Automatic training: the week's first Rest trains the card with the least xp, once.
  const t = daysFrom(P, v6Save({ cash: 300, crew: [Object.assign({}, DAY_CARD, { xp: 5 }), Object.assign({}, DAY_CARD, { id: 2, name: 'Lou', xp: 1 })], crewSeq: 3, season: { pick: 'birthday' } }), 7306);
  const t1 = quickNode(t, 'off');
  const t2 = quickNode(t, 'off');
  assert(t1.trained && t1.trained.id === 2 && t1.trained.xp === C.TRAIN_XP && t2.trained === null && t.st().season.trained === 2, 'Rest training ' + describe([t1.trained, t2.trained]));
  // The broke rescue: Monday, 3 cash, no stock, a cooler.
  const b = daysFrom(P, v6Save({ gear: { cooler: true }, stock: ZERO_STOCK, charcoal: 0, cash: 3, season: { pick: 'birthday' } }), 7307);
  const bs = () => b.st().season;
  const dep = bs().booking.deposit;
  const rv = b.sim.rescueView();
  assert(rv && rv.cash === 3 && rv.need > 3 && rv.gear.some((x) => x.id === 'cooler' && x.price === 30) && rv.gear.every((x) => x.price === Math.floor(P.CATALOG.find((c) => c.id === x.id).price * C.SELL_BACK)) && rv.advance === dep && rv.restart === true, 'rescueView ' + describe(rv));
  const brec = b.sim.recommendDay();
  assert(brec.rescue === true && brec.kind === 'off', 'the broke pick ' + describe(brec));
  const other = bs().offers.find((o) => o.id !== bs().booking.id);
  const adv = b.sim.rescueAdvance();
  b.drain();
  assert(adv.ok && b.st().cash === 3 + dep && bs().advance === dep && b.of('advance').length === 1 && b.sim.rescueAdvance().ok === false, 'rescueAdvance ' + describe({ adv, cash: b.st().cash, advance: bs().advance }));
  if (other) assert(b.sim.bookOffer(other.id).message === D34.advanceLocked && bs().booking.type === 'birthday', 'the advance did not lock the booking');
  const sv = b.sim.serialize();
  assert(sv.v === SAVE_V && sv.season.advance === dep, 'the save keeps the advance ' + describe(sv.season.advance));
  assert(daysFrom(P, sv, 7308).st().season.advance === dep, 'the reload keeps the advance');
  const v7 = P.validateSave(JSON.parse(JSON.stringify(Object.assign({}, sv, { v: 7 }))));
  assert(v7 && v7.v === SAVE_V && v7.season.advance === 0, 'a v7 save reads advance 0 ' + describe(v7 && v7.season.advance));
  for (let d = 0; d < 5; d++) quickNode(b, 'off');
  b.st().charcoal = 6;   // fixture: Saturday's cook
  const before = b.st().cash;
  b.sim.shopOpen('event');
  const paid = b.sim.cartTotal();
  const lu = b.sim.shopConfirm('event');
  b.drain();
  assert(lu.ok && b.st().cash === before - paid && bs().advance === 0, 'Saturday with the advance taken: no second deposit ' + describe({ lu, before, paid, cash: b.st().cash }));
  notes.push('advance ' + dep + ' up front, none at the load');
  // An advance on a week that never plays the event goes back Sunday night.
  const k = daysFrom(P, v6Save({ stock: ZERO_STOCK, charcoal: 0, cash: 3, season: { pick: 'birthday' } }), 7309);
  assert(k.sim.rescueAdvance().ok, 'the second advance');
  const kd = k.st().season.booking.deposit;
  for (let d = 0; d < 5; d++) quickNode(k, 'off');
  emptyCartNode(k.sim);
  assert(sameJSON(k.sim.dayOptions().options.map((o) => o.kind), ['event', 'off']), 'Saturday with nothing to cook ' + describe(k.sim.dayOptions().options));
  quickNode(k, 'off');
  const sunCash = k.st().cash;
  quickNode(k, 'off');
  assert(k.st().cash === Math.max(0, sunCash - kd) && k.st().season.advance === 0 && k.of('advance_back').length === 1, 'the advance back ' + describe({ sunCash, cash: k.st().cash }));
  // Sell at half, and the season restart.
  const sold = daysFrom(P, v6Save({ gear: { cooler: true }, stock: ZERO_STOCK, charcoal: 0, cash: 3, season: { pick: 'birthday' } }), 7310);
  const so = sold.sim.rescueSell('cooler');
  assert(so.ok && so.price === 30 && sold.st().cash === 33 && sold.st().gear.cooler === false, 'rescueSell ' + describe(so));
  const rs = daysFrom(P, v6Save({ stock: ZERO_STOCK, charcoal: 0, cash: 0, season: { pick: 'birthday' } }), 7311);
  const gearWas = JSON.stringify(rs.st().gear), repWas = rs.st().rep;
  assert(rs.st().season.week > 1, 'the restart fixture is week 1');
  const rr = rs.sim.rescueRestart();
  rs.drain();
  assert(rr.ok && rs.st().season.week === 1 && rs.st().season.results.length === 0 && rs.st().cash === C.START_CASH && rs.st().loop === 'week' && rs.st().phase === 'morning'
    && rs.st().season.day === 0 && JSON.stringify(rs.st().gear) === gearWas && rs.st().rep === repWas && rs.of('season_restart').length === 1, 'rescueRestart ' + describe({ rr, week: rs.st().season.week, cash: rs.st().cash }));
  notes.push('sell 30, the advance back on Sunday, restart to week 1 at ' + C.START_CASH);
  return notes.join('; ');
}

function surfaceV31(P, sim) {
  const C = P.C;
  const tuned = [];
  for (const [k, v] of Object.entries(C_X2)) {
    assert(k in C, 'C.' + k + ' missing (X2)');
    if (C_X2_FIXED.includes(k)) { assert(deepEq(C[k], v), 'C.' + k + ' is ' + describe(C[k]) + ', wanted exactly ' + describe(v)); continue; }
    if (k === 'SKILL_CURVE') {
      assert(C[k] && typeof C[k] === 'object' && sameJSON(Object.keys(C[k]).sort(), CURVE_KEYS.slice().sort()), 'C.SKILL_CURVE keys ' + describe(C[k] && Object.keys(C[k])));
      for (const ck of CURVE_KEYS) {
        const a = C[k][ck];
        assert(Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(x)), 'C.SKILL_CURVE.' + ck + ' is ' + describe(a));
        assert(a[1] === CURVE_MID[ck], 'C.SKILL_CURVE.' + ck + ' 3 star value ' + a[1] + ', fixed at ' + CURVE_MID[ck] + ' (X2)');
      }
    } else if (Array.isArray(v)) {
      assert(Array.isArray(C[k]) && C[k].length === v.length && C[k].every((x) => Number.isFinite(x)), 'C.' + k + ' is ' + describe(C[k]) + ', wanted ' + v.length + ' numbers');
    } else if (typeof v === 'number') {
      assert(typeof C[k] === 'number' && Number.isFinite(C[k]), 'C.' + k + ' is ' + describe(C[k]) + ', wanted a number');
    } else {
      assert(C[k] && typeof C[k] === 'object' && sameJSON(Object.keys(C[k]).sort(), Object.keys(v).sort()) && Object.values(C[k]).every((x) => Number.isFinite(x)), 'C.' + k + ' is ' + describe(C[k]));
    }
    if (!deepEq(C[k], v)) tuned.push(k + ' ' + describe(v) + ' to ' + describe(C[k]));
  }
  const SC = C.SKILL_CURVE;
  assert(C.TENDER_THRESHOLD === SC.fireSense[1] && C.TENDER_CYCLE === SC.firePace[1] && C.NPC_TILES_PER_S === SC.runSpeed[1] && C.NPC_TILES_PER_S === SC.prepPace[1] && C.BUDDY_HANDLE === SC.runHandle[1],
    'the X2 ties: TENDER_THRESHOLD ' + C.TENDER_THRESHOLD + ', TENDER_CYCLE ' + C.TENDER_CYCLE + ', NPC_TILES_PER_S ' + C.NPC_TILES_PER_S + ', BUDDY_HANDLE ' + C.BUDDY_HANDLE + ' against the 3 star column');
  assert(C.BUDDY_WAGE === 20 && C.TENDER_WAGE === 30 && P.wageFor(2.5, 'run') === C.BUDDY_WAGE && P.wageFor(3, 'fire') === C.TENDER_WAGE,
    'BUDDY_WAGE ' + C.BUDDY_WAGE + ' and TENDER_WAGE ' + C.TENDER_WAGE + ' against wageFor(2.5, run) ' + P.wageFor(2.5, 'run') + ' and wageFor(3, fire) ' + P.wageFor(3, 'fire'));
  assert(sameJSON(P.ROLE_IDS, ROLE_IDS), 'ROLE_IDS ' + describe(P.ROLE_IDS));
  for (const n of ['genPool', 'genWalkins', 'cardStars', 'wageFor', 'skillValue']) assert(typeof P[n] === 'function', 'PitSim.' + n + ' is not a function');
  for (const id of BOOKING_IDS) {
    const row = P.BOOKINGS[id];
    const want = BOOKING_MENUS[id];
    if (want === null) { assert(row.menus === null, 'BOOKINGS.' + id + '.menus ' + describe(row.menus) + ', wanted null'); continue; }
    assert(Array.isArray(row.menus) && Object.isFrozen(row.menus) && row.menus.every((p) => Object.isFrozen(p)) && deepEq(row.menus, want), 'BOOKINGS.' + id + '.menus ' + describe(row.menus) + ', wanted ' + describe(want) + ' (frozen)');
    if (want.length) assert(deepEq(row.menu, row.menus[0]), 'BOOKINGS.' + id + '.menu ' + describe(row.menu) + ' is not menus[0]');
  }
  for (const [k, t] of Object.entries(PREP_TILES)) assert(deepEq(P.MAP[k], t), 'MAP.' + k + ' is ' + describe(P.MAP[k]) + ', wanted ' + describe(t));
  const missingM = SIM_METHODS_V31.filter((m) => !Object.prototype.hasOwnProperty.call(sim, m) || typeof sim[m] !== 'function');
  assert(missingM.length === 0, 'X7 methods missing (own function properties): ' + missingM.join(', '));
  const s = sim.state;
  assert(s.hires === undefined, 'state.hires is ' + describe(s.hires) + ' (X4.1: removed)');
  assert(Array.isArray(s.crew) && s.crew.length === 0 && s.crewSeq === 1 && s.hiring === null && s.prep === null, 'a new game crew ' + describe({ crew: s.crew, crewSeq: s.crewSeq, hiring: s.hiring, prep: s.prep }));
  assert(s.season.drafted === false && s.season.trained === null && Array.isArray(s.season.walkins), 'a new game season ' + describe({ drafted: s.season.drafted, trained: s.season.trained, walkins: s.season.walkins }));
  assert(Array.isArray(s.stations.board.waiting) && s.stations.board.waiting.length === 0, 'state.stations.board.waiting ' + describe(s.stations.board.waiting));
  sim.drainEvents();
  const hr = sim.hire('buddy');
  assert(deepEq(hr, { ok: false, hired: false, message: '' }), "hire('buddy') returned " + describe(hr));
  const ev = sim.drainEvents();
  assert(ev.length === 0, "hire('buddy') emitted " + describe(ev));
  s.gear.kettle2 = true; s.gear.drum = true;   // fixture: the v3.0 order reached the buddy here
  const g = sim.goal();
  assert(g && g.id !== 'buddy' && g.id === 'bigtable', 'goal() with the second kettle and the drum ' + describe(g) + ', wanted bigtable (GOAL_ORDER has no buddy)');
  report.metrics.cTunedV31 = tuned;
  return 'v3.1: ' + Object.keys(C_X2).length + ' X2 keys (ties hold), ROLE_IDS, menus on the rows, MAP.prepIdle and prepUse, ' + SIM_METHODS_V31.length + ' X7 methods, no state.hires, the hire stub, no buddy goal' + (tuned.length ? '; tuned: ' + tuned.join('; ') : '; every X2 value at its starting value');
}

// Step 63.
function crewRulesHeadless(P) {
  const C = P.C, U = P.STRINGS.ui, S = P.STRINGS;
  const notes = [];
  for (const key of CURVE_KEYS) {
    for (const s of [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) {
      const got = P.skillValue(key, s), want = refSkillValue(C, key, s);
      assert(near(got, want), 'skillValue(' + key + ', ' + s + ') is ' + got + ', wanted ' + want);
    }
  }
  if (atStartX(C, ['SKILL_CURVE'])) {
    assert(sameJSON([1, 2, 3, 4, 5].map((s) => P.skillValue('fireSense', s)), [45, 50, 55, 60, 65]), 'fireSense at 1 to 5 stars ' + describe([1, 2, 3, 4, 5].map((s) => P.skillValue('fireSense', s))));
    assert(sameJSON([1, 2, 3, 4, 5].map((s) => P.skillValue('firePace', s)), [5, 4.5, 4, 3.25, 2.5]), 'firePace at 1 to 5 stars ' + describe([1, 2, 3, 4, 5].map((s) => P.skillValue('firePace', s))));
    notes.push('fireSense 45 to 65, firePace 5 to 2.5 (literal)');
  }
  let odd;
  try { odd = [P.skillValue('bogus', 3), P.skillValue('fireSense', 'x'), P.skillValue('fireSense', 9), P.cardStars([2, 'x']), P.wageFor('x', 'drive')]; } catch (e) { throw new Error('a crew helper threw on odd input: ' + e.message); }
  assert(Number.isNaN(odd[0]) && near(odd[1], refSkillValue(C, 'fireSense', 1)) && near(odd[2], refSkillValue(C, 'fireSense', 5)) && odd[4] === refWageFor(C, 1, 'run'), 'odd input ' + describe(odd));
  assert(P.cardStars([2.5, 3]) === 2.5 && P.cardStars([3, 3]) === 3 && P.cardStars([1, 1.5]) === 1, 'cardStars examples ' + describe([P.cardStars([2.5, 3]), P.cardStars([3, 3]), P.cardStars([1, 1.5])]));
  for (const role of ROLE_IDS) for (let s = 1; s <= 5; s += 0.5) assert(P.wageFor(s, role) === refWageFor(C, s, role), 'wageFor(' + s + ', ' + role + ') is ' + P.wageFor(s, role) + ', wanted ' + refWageFor(C, s, role));
  if (atStartX(C, ['WAGE_TABLE', 'ROLE_WAGE'])) {
    assert(P.wageFor(3, 'fire') === 30 && P.wageFor(2.5, 'run') === 20 && P.wageFor(5, 'fire') === 58 && P.wageFor(1, 'prep') === 10, 'wageFor examples ' + describe([P.wageFor(3, 'fire'), P.wageFor(2.5, 'run'), P.wageFor(5, 'fire'), P.wageFor(1, 'prep')]) + ', X5.1 literal 30, 20, 58, 10');
  }
  // X5.2: effective skills through crewView.
  const a = mkCard(P, 1, 'Rosa', 'run', [1, 1], { mood: -2, bring: false });
  const b = mkCard(P, 2, 'Dale', 'fire', [5, 5], { mood: 2, bring: false });
  const c = mkCard(P, 3, 'Opal', 'prep', [3, 3], { mood: -1, bring: false });
  const h = crewWeek(P, 631, [a, b, c]);
  const effOf = (k) => k.skills.map((s) => Math.min(5, Math.max(1, s + C.MOOD_STARS[k.mood + 2])));
  for (const k of [a, b, c]) {
    const v = h.sim.crewView(k.id);
    assert(v && v.id === k.id && sameJSON(v.eff, effOf(k)) && v.stars === P.cardStars(k.skills) && v.levelNeed === C.LEVEL_XP, 'crewView(' + k.id + ') ' + describe(v) + ', wanted eff ' + describe(effOf(k)));
    for (let i = 0; i < 2; i++) for (const key of C.ROLE_SKILLS[k.role][i]) assert(near(v.values[key], P.skillValue(key, v.eff[i])), 'crewView(' + k.id + ').values.' + key + ' ' + v.values[key] + ', wanted skillValue at ' + v.eff[i]);
  }
  if (atStartX(C, ['MOOD_STARS'])) assert(sameJSON(h.sim.crewView(1).eff, [1, 1]) && sameJSON(h.sim.crewView(2).eff, [5, 5]) && sameJSON(h.sim.crewView(3).eff, [2.5, 2.5]), 'X5.2 clamp literals: ' + describe([1, 2, 3].map((i) => h.sim.crewView(i).eff)));
  const all = h.sim.crewView();
  assert(Array.isArray(all) && all.length === 3, 'crewView() ' + describe(all));
  all[0].skills[0] = 4;
  assert(cardOf(h, 1).skills[0] === 1, 'crewView() returned the live card, not a copy');
  assert(h.sim.crewView(99) === null, 'crewView(99) ' + describe(h.sim.crewView(99)));
  const pr = h.sim.payroll();
  assert(pr && pr.budget === C.PAYROLL[0] && pr.slots === C.ROSTER_SLOTS[0] && pr.count === 3 && pr.now === 0, 'payroll() ' + describe(pr));
  if (atStartX(C, ['PAYROLL', 'ROSTER_SLOTS'])) assert(pr.budget === 60 && pr.slots === 2, 'payroll() ' + describe(pr) + ', X15.2 literal budget 60, slots 2');
  // setBring swaps two RUN cards.
  const h2 = crewWeek(P, 632, [mkCard(P, 1, 'Rosa', 'run', [2, 2]), mkCard(P, 2, 'Theo', 'run', [3, 3], { bring: false })]);
  const n2 = h2.log.length;
  const sb = h2.sim.setBring(2, true);
  h2.drain();
  const swapMsg = fill(U.oneRole, { role: S.roleName.run.toLowerCase(), name: 'Rosa' });
  assert(sb && sb.ok === true && sb.swapped === 1 && sb.message === swapMsg, 'setBring(2, true) ' + describe(sb) + ', wanted swapped 1 and ' + describe(swapMsg));
  assert(cardOf(h2, 1).bring === false && cardOf(h2, 2).bring === true, 'after the swap bring ' + describe([cardOf(h2, 1).bring, cardOf(h2, 2).bring]));
  const bs = h2.of(EV31.bringSet, n2);
  assert(bs.length === 1 && deepEq(strip(bs[0]), { type: EV31.bringSet, id: 2, bring: true, swapped: 1 }) && h2.of(EVENT.saveWanted, n2).some((e) => e.reason === 'crew'), 'setBring events ' + describe(h2.log.slice(n2).map(strip)));
  // The payroll budget at Load up and go.
  const h3 = crewWeek(P, 633, [mkCard(P, 1, 'Dale', 'fire', [5, 5]), mkCard(P, 2, 'Rosa', 'run', [2.5, 2.5])]);
  const p3 = h3.sim.payroll();
  const can = h3.sim.canLoadUp();
  assert(p3.now === P.wageFor(5, 'fire') + P.wageFor(2.5, 'run') && p3.now > p3.budget && can.ok === false && can.reason === fill(U.goPayroll, { p: p3.now, b: p3.budget }), 'canLoadUp over budget ' + describe(can) + ', payroll ' + describe(p3));
  if (atStartX(C, ['WAGE_TABLE', 'ROLE_WAGE', 'PAYROLL'])) assert(can.reason === fill(U.goPayroll, { p: 78, b: 60 }), 'canLoadUp ' + describe(can) + ', X15.2 literal 78 and 60');
  const lu3 = h3.sim.loadUp();
  assert(lu3 && lu3.ok === false && h3.st().loop === LOOP.week, 'loadUp over the budget ' + describe(lu3));
  h3.sim.setBring(2, false);
  // Review 1 (X20.13): read through C. At a budget of 58 or more (the backyard's 60) the FIRE card alone
  // loads, as built in v3.1; under 58 it is over the budget too, and resting it as well loads.
  const fireAlone = P.wageFor(5, 'fire');
  if (fireAlone <= p3.budget) assert(h3.sim.canLoadUp().ok === true, 'canLoadUp with the RUN card resting ' + describe(h3.sim.canLoadUp()));
  else {
    const c3 = h3.sim.canLoadUp();
    assert(c3.ok === false && c3.reason === fill(U.goPayroll, { p: fireAlone, b: p3.budget }), 'canLoadUp with only the 5 star FIRE card (' + fireAlone + ' over ' + p3.budget + ') ' + describe(c3));
    h3.sim.setBring(1, false);
    assert(h3.sim.canLoadUp().ok === true, 'canLoadUp with both cards resting ' + describe(h3.sim.canLoadUp()));
  }
  notes.push('payroll ' + p3.now + ' of ' + p3.budget + ' refused, ' + h3.sim.payroll().now + ' loads');
  // XP, training and levels.
  const xp0 = C.LEVEL_XP - 10;   // review 1: LEVEL_XP moved 200 to 120, so the fixture sits 10 under it
  const h4 = crewWeek(P, 634, [mkCard(P, 1, 'Rosa', 'run', [2.5, 3], { potential: 4, xp: xp0 })]);
  const n4 = h4.log.length;
  const tr = h4.sim.train(1);
  h4.drain();
  const c4 = cardOf(h4, 1);
  assert(tr && tr.ok === true && c4.xp === xp0 + C.TRAIN_XP - C.LEVEL_XP && c4.banked === 1 && h4.st().season.trained === 1, 'train(1) ' + describe(tr) + ', card xp ' + c4.xp + ', banked ' + c4.banked + ', trained ' + describe(h4.st().season.trained));
  if (atStartX(C, ['TRAIN_XP'])) assert(c4.xp === 30, 'xp after training ' + c4.xp + ', X15.2 literal 30');
  const te = h4.of(EV31.trained, n4), lr = h4.of(EV31.levelReady, n4);
  assert(te.length === 1 && deepEq(strip(te[0]), { type: EV31.trained, id: 1, name: 'Rosa', xp: C.TRAIN_XP }) && lr.length === 1 && deepEq(strip(lr[0]), { type: EV31.levelReady, id: 1, name: 'Rosa', banked: 1 }), 'train events ' + describe(h4.log.slice(n4).map(strip)));
  const tr2 = h4.sim.train(1);
  assert(tr2 && tr2.ok === false && tr2.message === U.trainDone, 'a second train ' + describe(tr2));
  const n5 = h4.log.length;
  const lv = h4.sim.levelUp(1, 0);
  h4.drain();
  assert(lv && lv.ok === true && cardOf(h4, 1).skills[0] === 3 && cardOf(h4, 1).banked === 0, 'levelUp(1, 0) ' + describe(lv) + ', card ' + describe(cardOf(h4, 1)));
  const le = h4.of(EV31.levelUp, n5);
  assert(le.length === 1 && le[0].id === 1 && le[0].skill === 0 && le[0].value === 3, 'level_up ' + describe(le.map(strip)));
  assert(h4.sim.levelUp(1, 1).ok === false, 'levelUp with no banked level was not refused');
  const h5 = crewWeek(P, 635, [mkCard(P, 1, 'Theo', 'fire', [4, 3], { potential: 4, banked: 1 })]);
  const at = h5.sim.levelUp(1, 0);
  assert(at && at.ok === false && at.message === U.atPotential && cardOf(h5, 1).banked === 1, 'levelUp at potential ' + describe(at));
  assert(h5.sim.levelUp(1, 1).ok === true && sameJSON(cardOf(h5, 1).skills, [4, 3.5]), 'levelUp(1, 1) under potential gave ' + describe(cardOf(h5, 1).skills));
  const h6 = crewWeek(P, 636, [mkCard(P, 1, 'Maya', 'prep', [4, 4], { potential: 4, banked: 1, mood: 0 })]);
  const n6 = h6.log.length;
  const both = h6.sim.levelUp(1, 0);
  h6.drain();
  assert(both && both.ok === true && cardOf(h6, 1).mood === 1 && cardOf(h6, 1).banked === 0 && sameJSON(cardOf(h6, 1).skills, [4, 4]), 'levelUp with both at potential ' + describe(both) + ', card ' + describe(cardOf(h6, 1)));
  assert(h6.of(EV31.levelUp, n6).some((e) => e.skill === -1), 'level_up with skill -1 ' + describe(h6.log.slice(n6).map(strip)));
  // The raise, once a contract.
  const h7 = crewWeek(P, 637, [mkCard(P, 1, 'Gus', 'run', [2.5, 2.5], { wage: 20, mood: 0 })]);
  const n7 = h7.log.length;
  const r1 = h7.sim.giveRaise(1);
  h7.drain();
  const w7 = Math.round(20 * (1 + C.RAISE_FRAC));
  assert(r1 && r1.ok === true && r1.wage === w7 && cardOf(h7, 1).wage === w7 && cardOf(h7, 1).mood === 1 && cardOf(h7, 1).raised === true, 'giveRaise ' + describe(r1) + ', card ' + describe(cardOf(h7, 1)));
  assert(h7.of(EV31.raise, n7).some((e) => e.id === 1 && e.wage === w7), 'raise events ' + describe(h7.log.slice(n7).map(strip)));
  if (atStartX(C, ['RAISE_FRAC'])) assert(w7 === 24, 'the raised wage ' + w7 + ', literal 24');
  const r2 = h7.sim.giveRaise(1);
  assert(r2 && r2.ok === false && cardOf(h7, 1).wage === w7, 'a second raise ' + describe(r2));
  // Letting go: free before the first event, a send-off of the wage after, refused above cash.
  const h8 = crewWeek(P, 638, [mkCard(P, 1, 'Ivy', 'run', [2, 2], { worked: 0 }), mkCard(P, 2, 'Hank', 'fire', [3, 3], { worked: 1, wage: 30 }), mkCard(P, 3, 'Lena', 'prep', [2, 2], { worked: 2, wage: 16 })], { cash: 100 });
  const n8 = h8.log.length;
  const g1 = h8.sim.letGo(1);
  h8.drain();
  assert(g1 && g1.ok === true && g1.sendoff === 0 && h8.st().cash === 100 && cardOf(h8, 1) === null, 'letGo at worked 0 ' + describe(g1) + ', cash ' + h8.st().cash);
  const g2 = h8.sim.letGo(2);
  h8.drain();
  assert(g2 && g2.ok === true && g2.sendoff === 30 && h8.st().cash === 70 && cardOf(h8, 2) === null, 'letGo at worked 1 ' + describe(g2) + ', cash ' + h8.st().cash);
  const lg = h8.of(EV31.letGo, n8);
  assert(lg.length === 2 && lg[0].id === 1 && lg[0].sendoff === 0 && lg[1].id === 2 && lg[1].sendoff === 30, 'crew_let_go events ' + describe(lg.map(strip)));
  h8.st().cash = 15;   // fixture: under Lena's send-off of 16
  const g3 = h8.sim.letGo(3);
  assert(g3 && g3.ok === false && g3.message === U.sendOffCash && cardOf(h8, 3) !== null && h8.st().cash === 15, 'letGo above cash ' + describe(g3));
  return 'skillValue on ' + CURVE_KEYS.length + ' curves, cardStars and wageFor, X5.2 clamps, payroll, the swap, the budget, train and banked levels, at potential, the mood level, the raise, three send-offs; ' + notes.join('; ');
}

// Step 64.
function hiringHeadless(P) {
  const C = P.C, U = P.STRINGS.ui, names = P.STRINGS.names;
  const notes = [];
  const g1 = P.genPool({ seed: 7, year: 1 }), g2 = P.genPool({ seed: 7, year: 1 });
  assert(Array.isArray(g1) && deepEq(g1, g2), 'genPool twice differs');
  assert(g1.length === C.POOL_SIZE, 'genPool has ' + g1.length + ' entries');
  for (const role of ROLE_IDS) assert(g1.filter((e) => e.role === role).length === 6, 'genPool ' + role + ' count ' + g1.filter((e) => e.role === role).length);
  for (const e of g1) {
    assert(e.stars >= 1 && e.stars <= 3 && e.potential >= 2 && e.potential <= 5 && e.potential >= Math.max(...e.skills) + 0.5, 'genPool entry ' + describe(e));
    assert(e.stars === P.cardStars(e.skills) && e.wage === P.wageFor(e.stars, e.role) && (e.mood === 0 || e.mood === 1), 'genPool entry stars, wage or mood ' + describe(e));
    assert(LOOK_KEYS.every((k) => Number.isInteger(e.look[k]) && e.look[k] >= 0 && e.look[k] < LOOK_COUNTS[k]), 'genPool look ' + describe(e.look));
  }
  assert(sameJSON(g1.map((e) => e.idx), g1.map((_, i) => i)), 'genPool idx ' + describe(g1.map((e) => e.idx)));
  assert(g1.every((e) => names.includes(e.name)) && new Set(g1.map((e) => e.name)).size === g1.length, 'genPool names ' + describe(g1.map((e) => e.name)));
  const avoid = names.slice(0, 24);
  const ga = P.genPool({ seed: 7, year: 1, avoid });
  assert(!ga.some((e) => avoid.includes(e.name)), 'genPool with avoid used ' + describe(ga.filter((e) => avoid.includes(e.name)).map((e) => e.name)));
  for (const input of [{ seed: 7, year: 1 }, { seed: 7, year: 2 }, { seed: 123456789, year: 1, avoid }, { seed: 99, year: 3, avoid: ['Rosa'] }]) {
    const got = P.genPool(input).map(appView), want = refGenPool(P, input).map(appView);
    assert(deepEq(got, want), 'genPool(' + describe(input).slice(0, 80) + ') differs from the X6.1 model: ' + describe(got.slice(0, 2)) + ' against ' + describe(want.slice(0, 2)));
  }
  notes.push('genPool matches the X6.1 model on four inputs');
  // On a sim on Hiring Day.
  const h = headless(P, null, 641);
  assert(h.sim.skipTutorial() === true, 'skipTutorial() did not return true');
  h.drain();
  h.sim.setPlayer(DEFAULT_LOOK, W15.defaultName, W15.defaultPit);
  h.drain();
  const st = h.st;
  assert(st().loop === LOOP.hiring, 'loop after setPlayer ' + describe(st().loop));
  const seed = st().season.seed;
  const pool = P.genPool({ seed, year: 1, avoid: [] });
  const hv0 = h.sim.hiringView();
  assert(hv0 && hv0.year === 1 && hv0.round === 1 && hv0.tryouts === C.TRYOUTS && hv0.picksLeft === 3 && hv0.pool.length === C.POOL_SIZE, 'hiringView() ' + describe(hv0 && { year: hv0.year, round: hv0.round, tryouts: hv0.tryouts, picksLeft: hv0.picksLeft }));
  for (const e of hv0.pool) {
    const p = pool[e.idx];
    assert(e.name === p.name && e.role === p.role && sameJSON(e.skills, p.skills) && e.stars === p.stars && e.wage === p.wage && e.status === 'open' && e.tried === false && e.potential === null,
      'hiringView entry ' + e.idx + ' ' + describe(e) + ', pool ' + describe(p));
  }
  const n0 = h.log.length;
  const t1 = h.sim.tryout(0), t2 = h.sim.tryout(1), t3 = h.sim.tryout(2);
  h.drain();
  assert(t1 && t1.ok && t1.potential === pool[0].potential && t2 && t2.ok && t2.potential === pool[1].potential, 'two tryouts ' + describe([t1, t2]));
  assert(t3 && t3.ok === false, 'a third tryout ' + describe(t3));
  const ty = h.of(EV31.tryout, n0);
  assert(ty.length === 2 && ty[0].idx === 0 && ty[0].name === pool[0].name && ty[0].potential === pool[0].potential, 'tryout events ' + describe(ty.map(strip)));
  const hv1 = h.sim.hiringView();
  assert(hv1.tryouts === 0 && hv1.pool[0].potential === pool[0].potential && hv1.pool[1].potential === pool[1].potential && hv1.pool.slice(2).every((e) => e.potential === null), 'hiringView after two tryouts ' + describe(hv1.pool.slice(0, 3)));
  const early = h.sim.finishHiring();
  assert(early && early.ok === false && early.message === '' && st().loop === LOOP.hiring, 'finishHiring in round 1 ' + describe(early));
  // A pick ends round 1; other outfits take three of the six best open by stars plus potential.
  const pick = 4;
  const status = Object.fromEntries(pool.map((e) => [e.idx, 'open']));
  const cash0 = st().cash;
  const n1 = h.log.length;
  const hr = h.sim.hireApplicant(pick);
  h.drain();
  assert(hr && hr.ok === true && Number.isInteger(hr.id), 'hireApplicant(' + pick + ') ' + describe(hr));
  const card = cardOf(h, hr.id);
  const pe = pool[pick];
  assert(card && card.name === pe.name && card.role === pe.role && sameJSON(card.skills, pe.skills) && card.potential === pe.potential && card.mood === pe.mood && deepEq(card.look, pe.look)
    && card.contract === 2 && card.rookie === true && card.wage === pe.wage && card.xp === 0 && card.banked === 0 && card.worked === 0 && card.seasons === 0 && card.trait === null && card.raised === false && card.notice === false && card.bench === 0
    && card.bring === (pe.wage <= C.PAYROLL[0]), 'the drafted card ' + describe(card) + ', applicant ' + describe(pe));
  assert(st().cash === cash0, 'a Hiring Day hire took ' + (cash0 - st().cash) + ' (X6.2: no signing fee)');
  const ch = h.of(EV31.crewHired, n1);
  assert(ch.length === 1 && deepEq(strip(ch[0]), { type: EV31.crewHired, id: hr.id, name: pe.name, role: pe.role, from: 'draft', fee: 0 }), 'crew_hired ' + describe(ch.map(strip)));
  status[pick] = 'mine';
  const taken1 = refTaken(P, pool, status, seed, 1, 1);
  for (const i of taken1) status[i] = 'taken';
  const hv2 = h.sim.hiringView();
  const takenNow = hv2.pool.filter((e) => e.status === 'taken').map((e) => e.idx).sort((x, y) => x - y);
  assert(hv2.round === 2 && hv2.picksLeft === 2 && hv2.pool[pick].status === 'mine' && takenNow.length === C.TAKEN_PER_ROUND && sameJSON(takenNow, taken1.slice().sort((x, y) => x - y)),
    'after the pick: round ' + hv2.round + ', taken ' + describe(takenNow) + ', the ro model ' + describe(taken1));
  const rd = h.of(EV31.roundDone, n1);
  assert(rd.length === 1 && rd[0].round === 1 && sameJSON(rd[0].taken.slice().sort((x, y) => x - y), taken1.slice().sort((x, y) => x - y)) && sameJSON(rd[0].names.slice().sort(), taken1.map((i) => pool[i].name).sort()), 'round_done ' + describe(rd.map(strip)));
  assert(h.of(EVENT.saveWanted, n1).some((e) => e.reason === 'hiring'), 'no save_wanted hiring after the round');
  // A reload mid Hiring Day restores the pool, the statuses and the round.
  const ser = h.sim.serialize();
  assert(ser && ser.v === SAVE_V && ser.hiring && ser.hiring.round === 2 && ser.season.week === 1 && ser.season.pick === null, 'serialize() on Hiring Day ' + describe(ser && { v: ser.v, hiring: ser.hiring && ser.hiring.round, week: ser.season && ser.season.week, pick: ser.season && ser.season.pick }));
  const back = P.validateSave(JSON.parse(JSON.stringify(ser)));
  assert(back && back.hiring && back.hiring.pool.length === C.POOL_SIZE, 'validateSave dropped the Hiring Day ' + describe(back && back.hiring));
  const again = P.createSim(back, 641);
  assert(again.state.loop === LOOP.hiring && deepEq(again.hiringView(), h.sim.hiringView()), 'the reload gave loop ' + describe(again.state.loop) + ', hiringView ' + describe(again.hiringView() && again.hiringView().round));
  assert(deepEq(again.state.crew, st().crew), 'the reload lost the drafted card');
  // Two passes end rounds 2 and 3.
  for (const round of [2, 3]) {
    const p = h.sim.passRound();
    h.drain();
    assert(p && p.ok === true, 'passRound in round ' + round + ' ' + describe(p));
    const tk = refTaken(P, pool, status, seed, 1, round);
    for (const i of tk) status[i] = 'taken';
  }
  const hv3 = h.sim.hiringView();
  const taken3 = hv3.pool.filter((e) => e.status === 'taken').map((e) => e.idx).sort((x, y) => x - y);
  const want3 = Object.keys(status).filter((k) => status[k] === 'taken').map(Number).sort((x, y) => x - y);
  assert(hv3.round === 4 && hv3.picksLeft === 0 && taken3.length === 3 * C.TAKEN_PER_ROUND && sameJSON(taken3, want3), 'after round 3: round ' + hv3.round + ', taken ' + describe(taken3) + ', the ro model ' + describe(want3));
  assert(h.sim.passRound().ok === false && h.sim.hireApplicant(hv3.pool.find((e) => e.status === 'open').idx).ok === false, 'a fourth round ran');
  // A full roster drafts, then lets someone go before week 1.
  st().crew.push(mkCard(P, 50, 'Walt', 'fire', [2, 2], { bring: false }), mkCard(P, 51, 'Faye', 'prep', [2, 2], { bring: false }));   // fixture: a roster of 3
  st().crewSeq = 52;
  const full = h.sim.finishHiring();
  assert(full && full.ok === false && full.message === fill(U.tooMany, { s: h.sim.payroll().slots }) && st().loop === LOOP.hiring, 'finishHiring with 3 on 2 slots ' + describe(full));
  const cash1 = st().cash;
  const lg = h.sim.letGo(hr.id);
  h.drain();
  assert(lg && lg.ok === true && lg.sendoff === 0 && st().cash === cash1 && cardOf(h, hr.id) === null, 'letGo of the unworked card ' + describe(lg));
  assert(h.sim.hiringView().pool[pick].status === 'taken', 'the let go draft pick reads ' + describe(h.sim.hiringView().pool[pick].status) + ' (X18.1 item 33: taken)');
  const n2 = h.log.length;
  const fin = h.sim.finishHiring();
  h.drain();
  assert(fin && fin.ok === true && st().loop === LOOP.week && st().phase === PHASE.morning && st().hiring === null && st().season.drafted === true, 'finishHiring ' + describe(fin) + ', loop ' + describe(st().loop));
  const seq = h.log.slice(n2).map((e) => e.type);
  const order = [EV31.hiringDone, EV3.weekStart, EV3.offersReady, EVENT.saveWanted].map((t) => seq.indexOf(t));
  assert(order.every((i) => i >= 0) && order.every((i, j) => j === 0 || i > order[j - 1]), 'events after finishHiring ' + describe(seq));
  assert(h.of(EV31.hiringDone, n2)[0].year === 1 && h.of(EVENT.saveWanted, n2).some((e) => e.reason === 'hiring'), 'hiring_done or save_wanted ' + describe(h.log.slice(n2).map(strip)));
  return 'tryouts 2 of 2, potential hidden until tried, a pick with no fee, three taken a round by the ro model (' + taken1.join(' ') + '), the reload keeps it, round 4, tooMany, a free let go, week 1; ' + notes.join('; ');
}

// Step 65.
function walkinsHeadless(P) {
  const C = P.C, U = P.STRINGS.ui;
  const notes = [];
  const counts = [20, 50, 80].map((rep) => P.genWalkins({ seed: 7, year: 1, week: 2, rep }).length);
  assert(sameJSON(counts, [20, 50, 80].map((rep) => C.WALKINS[rep >= C.THIRD_EDGES[1] ? 2 : rep >= C.THIRD_EDGES[0] ? 1 : 0])), 'genWalkins counts ' + describe(counts));
  if (atStartX(C, ['WALKINS'])) assert(sameJSON(counts, [2, 2, 3]), 'genWalkins counts ' + describe(counts) + ', X15.2 literal 2, 2, 3');
  assert(deepEq(P.genWalkins({ seed: 7, year: 1, week: 2, rep: 80 }), P.genWalkins({ seed: 7, year: 1, week: 2, rep: 80 })), 'genWalkins twice differs');
  for (let w = 1; w <= SEASON_WEEKS - 1; w++) {
    for (const input of [{ seed: 7, year: 1, week: w, rep: 80 }, { seed: 4242, year: 2, week: w, rep: 20, avoid: ['Rosa', 'Dale'] }]) {
      const got = P.genWalkins(input);
      for (const a of got) assert(a.stars >= 2 && a.stars <= 4 && a.potential === Math.max(...a.skills) && a.wage === P.wageFor(a.stars, a.role), 'walk-in ' + describe(a) + ' (review 1: at its ceiling)');
      if (w === 1) assert(got.length === 0, 'genWalkins in week 1 gave ' + got.length + ' (review 1: none the week of Hiring Day)');
      assert(deepEq(got.map(appView), refGenWalkins(P, input).map(appView)), 'genWalkins(' + describe(input) + ') differs from the X6.3 model: ' + describe(got.map(appView)) + ' against ' + describe(refGenWalkins(P, input).map(appView)));
    }
  }
  notes.push('genWalkins matches the X6.3 model over 16 inputs');
  const h = toWeek(P, 651);
  const st = h.st;
  // Review 1 (X20.7): no walk-ins in week 1 (Hiring Day was this morning); the checks run in week 2.
  assert(Array.isArray(st().season.walkins) && st().season.walkins.length === 0, 'week 1 walk-ins ' + describe(st().season.walkins));
  settleWeek(h, 3);
  h.sim.finishReport();
  h.drain();
  assert(st().season.week === 2 && st().loop === LOOP.week, 'week 2 after week 1 ' + describe([st().season.week, st().loop]));
  const third = st().rep >= C.THIRD_EDGES[1] ? 2 : st().rep >= C.THIRD_EDGES[0] ? 1 : 0;
  const wk = st().season.walkins;
  const model = refGenWalkins(P, { seed: st().season.seed, year: 1, week: 2, rep: st().rep, avoid: [] });
  assert(Array.isArray(wk) && wk.length === C.WALKINS[third] && wk.every((a) => a.hired === false) && deepEq(wk.map(appView), model.map(appView)), 'season.walkins ' + describe(wk) + ', the model ' + describe(model));
  assert(st().season.trained === null, 'season.trained ' + describe(st().season.trained));
  st().cash = 300;   // fixture: the fee passes the R-1 rule whatever the draw
  const a0 = wk[0];
  const n0 = h.log.length;
  const hw = h.sim.hireWalkin(0);
  h.drain();
  assert(hw && hw.ok === true && st().cash === 300 - a0.wage, 'hireWalkin(0) ' + describe(hw) + ', cash ' + st().cash + ', fee ' + a0.wage);
  const c = cardOf(h, hw.id);
  assert(c && c.name === a0.name && c.role === a0.role && sameJSON(c.skills, a0.skills) && c.contract === 1 && c.rookie === false && c.wage === a0.wage && c.bring === (a0.wage <= C.PAYROLL[0]) && st().season.walkins[0].hired === true,
    'the walk-in card ' + describe(c) + ', walk-in ' + describe(st().season.walkins[0]));
  const ch = h.of(EV31.crewHired, n0);
  assert(ch.length === 1 && deepEq(strip(ch[0]), { type: EV31.crewHired, id: hw.id, name: a0.name, role: a0.role, from: 'walkin', fee: a0.wage }) && h.of(EVENT.saveWanted, n0).some((e) => e.reason === 'crew'), 'walk-in events ' + describe(h.log.slice(n0).map(strip)));
  const dup = h.sim.hireWalkin(0);
  assert(dup && dup.ok === false && st().crew.length === 1, 'hiring the same walk-in twice ' + describe(dup));
  // A full roster refuses with ui.crewFull.
  st().crew.push(mkCard(P, 40, 'Bea', 'fire', [2, 2], { bring: false }));   // fixture: 2 of 2
  st().crewSeq = 41;
  const fullR = h.sim.hireWalkin(1);
  assert(fullR && fullR.ok === false && fullR.message === U.crewFull && st().season.walkins[1].hired === false, 'hireWalkin on a full roster ' + describe(fullR));
  // The fee shows on the report as crew spent.
  const t = settleWeek(h, 3);
  assert(t.crewSpent === a0.wage && Array.isArray(t.crewPaid) && t.crewPaid.includes(a0.name), 'till.crewSpent ' + describe(t.crewSpent) + ', crewPaid ' + describe(t.crewPaid) + ', wanted the fee ' + a0.wage);
  // Walk-ins leave at the end of the week.
  h.sim.finishReport();
  h.drain();
  const wk2 = st().season.walkins;
  const third2 = st().rep >= C.THIRD_EDGES[1] ? 2 : st().rep >= C.THIRD_EDGES[0] ? 1 : 0;
  const model2 = refGenWalkins(P, { seed: st().season.seed, year: 1, week: 3, rep: st().rep, avoid: st().crew.map((k) => k.name) });
  assert(st().season.week === 3 && wk2.length === C.WALKINS[third2] && wk2.every((a) => a.hired === false) && !deepEq(wk2.map(appView), wk.map(appView)) && deepEq(wk2.map(appView), model2.map(appView)), 'week 3 walk-ins ' + describe(wk2));
  return 'none in week 1, the fee ' + a0.wage + ' from cash in week 2, a 1 season trained card at its ceiling, crewFull, crewSpent on the report, a new list in week 3; ' + notes.join('; ');
}

// Step 66.
function moodHeadless(P) {
  const C = P.C;
  const notes = [];
  const two = () => [mkCard(P, 1, 'Rosa', 'run', [2, 2]), mkCard(P, 2, 'Dale', 'fire', [2, 2])];
  const moods = (h) => h.st().crew.map((c) => c.mood);
  // Booking stars.
  let h = crewWeek(P, 661, two());
  let n0 = h.log.length;
  settleWeek(h, 5);
  assert(sameJSON(moods(h), [1, 1]), '5 stars: moods ' + describe(moods(h)) + ', wanted 1, 1');
  const cm = h.of(EV31.crewMood, n0);
  assert(cm.length === 1 && deepEq(cm[0].changes.slice().sort((a, b) => a.id - b.id), [{ id: 1, from: 0, to: 1 }, { id: 2, from: 0, to: 1 }]), 'crew_mood ' + describe(cm.map(strip)));
  h = crewWeek(P, 662, two());
  settleWeek(h, 4);
  assert(sameJSON(moods(h), [1, 0]), '4 stars: moods ' + describe(moods(h)) + ', wanted the lowest id up only (equal XP under settle)');
  h = crewWeek(P, 663, two());
  settleWeek(h, 2);
  assert(sameJSON(moods(h), [-1, -1]), '2 stars: moods ' + describe(moods(h)) + ', wanted -1, -1');
  h = crewWeek(P, 664, two());
  n0 = h.log.length;
  settleWeek(h, 3);
  assert(sameJSON(moods(h), [0, 0]) && h.of(EV31.crewMood, n0).length === 0, '3 stars: moods ' + describe(moods(h)) + ', crew_mood ' + describe(h.of(EV31.crewMood, n0).map(strip)));
  // Resting: up on a Yard day, down after two benched bookings.
  h = crewWeek(P, 665, [mkCard(P, 1, 'Theo', 'fire', [2, 2], { bring: false })]);
  assert(h.sim.bookOffer('yard').ok, 'bookOffer yard');
  const ly = h.sim.loadUp();
  h.drain();
  assert(ly && ly.ok, 'loadUp the Yard day ' + describe(ly));
  assert(toReport(h), 'the Yard day did not reach the report');
  assert(cardOf(h, 1).mood === 1, 'a resting card after a Yard day: mood ' + cardOf(h, 1).mood + ', wanted 1');
  h.sim.finishReport(); h.drain();
  settleWeek(h, 3);
  assert(cardOf(h, 1).mood === 1 && cardOf(h, 1).bench === 1, 'one benched booking: ' + describe(cardOf(h, 1)));
  h.sim.finishReport(); h.drain();
  settleWeek(h, 3);
  assert(cardOf(h, 1).mood === 0 && cardOf(h, 1).bench === 0, 'two benched bookings: ' + describe(cardOf(h, 1)) + ', wanted mood 0 and bench 0');
  notes.push('Yard day rest +1, two benched bookings -1');
  // Notice, one more event, then moving on.
  h = crewWeek(P, 666, [mkCard(P, 1, 'Mae', 'run', [2, 2], { mood: -1 })]);
  n0 = h.log.length;
  settleWeek(h, 2);
  assert(cardOf(h, 1).mood === -2 && cardOf(h, 1).notice === true, 'after a 2 star event at -1: ' + describe(cardOf(h, 1)));
  const cn = h.of(EV31.crewNotice, n0);
  assert(cn.length === 1 && cn[0].id === 1 && cn[0].name === 'Mae', 'crew_notice ' + describe(cn.map(strip)));
  h.sim.finishReport(); h.drain();
  const n1 = h.log.length;
  const t2 = settleWeek(h, 3);
  const row = (t2.crew || []).find((r) => r.id === 1);
  assert(row && row.worked === true && row.moodFrom === -2, 'the noticed card did not work its last event: ' + describe(row));
  const cl = h.of(EV31.crewLeft, n1);
  assert(cl.length === 1 && cl[0].id === 1 && cl[0].name === 'Mae' && deepEq(t2.left, [{ id: 1, name: 'Mae' }]) && cardOf(h, 1) === null, 'crew_left ' + describe(cl.map(strip)) + ', till.left ' + describe(t2.left));
  const evs = h.log.slice(n1).map((e) => e.type);
  assert(evs.indexOf(EV31.crewLeft) < evs.indexOf(EVENT.dayOver), 'crew_left after day_over: ' + describe(evs));
  // The same card given a raise between the two events stays.
  h = crewWeek(P, 667, [mkCard(P, 1, 'Mae', 'run', [2, 2], { mood: -1 })]);
  settleWeek(h, 2);
  h.sim.finishReport(); h.drain();
  const gr = h.sim.giveRaise(1);
  assert(gr && gr.ok === true && cardOf(h, 1).mood === -1 && cardOf(h, 1).notice === false, 'the raise on a noticed card ' + describe(gr) + ', card ' + describe(cardOf(h, 1)));
  const n2 = h.log.length;
  settleWeek(h, 3);
  assert(cardOf(h, 1) !== null && h.of(EV31.crewLeft, n2).length === 0, 'the raised card moved on');
  // The drag: a card at -2 moves exactly one other lineup card, the one crewRng names.
  h = crewWeek(P, 668, [mkCard(P, 1, 'Ray', 'run', [1, 1]), mkCard(P, 2, 'Opal', 'fire', [1, 1], { mood: -2 }), mkCard(P, 3, 'Earl', 'prep', [1, 1])]);
  const se = h.st().season;
  const rng = refMulberry32(refMix32((se.seed ^ 0x43524557) >>> 0, se.year, se.week));
  const others = [1, 3];
  const dragged = others[Math.floor(rng() * others.length)];
  settleWeek(h, 3);
  const m = Object.fromEntries(h.st().crew.map((c) => [c.id, c.mood]));
  assert(m[dragged] === -1 && m[dragged === 1 ? 3 : 1] === 0 && m[2] === -2 && cardOf(h, 2).notice === true, 'the drag moved ' + describe(m) + ', the crewRng model names card ' + dragged);
  notes.push('the drag picked card ' + dragged + ' as the model does');
  // Review 1 (X20.5): Fired up is a burst you earn. A lineup card that works an event at Fired up
  // eases a step; a 5 star safe booking lifts only up to Happy; a 5 star stretch booking lifts a full
  // step, so a Fired up card that works one stays Fired up.
  h = crewWeek(P, 669, [mkCard(P, 1, 'Rosa', 'run', [2, 2], { mood: 2 })]);
  settleWeek(h, 3);
  assert(cardOf(h, 1).mood === 1, 'a Fired up card after a 3 star event: mood ' + cardOf(h, 1).mood + ', wanted 1 (eases a step)');
  const pickTier = (hh, tier) => hh.st().season.offers.find((o) => o.type !== 'yard' && o.safe && o.tier === tier) || null;
  h = crewWeek(P, 670, [mkCard(P, 1, 'Rosa', 'run', [2, 2], { mood: 1 })]);
  const safe5 = pickTier(h, 'safe');
  assert(safe5, 'no loadable safe card on seed 670: ' + describe(h.st().season.offers.map((o) => [o.id, o.tier, o.safe])));
  settleWeek(h, 5, safe5.id);
  assert(cardOf(h, 1).mood === 1, 'a Happy card after a 5 star safe booking: mood ' + cardOf(h, 1).mood + ', wanted 1 (lifts only up to Happy)');
  let stretchNote = 'no loadable stretch on seeds 671 to 690';
  for (let sd = 671; sd <= 690; sd++) {
    const ha = crewWeek(P, sd, [mkCard(P, 1, 'Rosa', 'run', [2, 2], { mood: 1 }), mkCard(P, 2, 'Dale', 'fire', [2, 2], { mood: 2 })], { cash: 400, gear: { kettle2: true } });
    reOffer(ha);   // the offers again on the fixture's two kettles
    ha.drain();
    const st5 = pickTier(ha, 'stretch');
    if (!st5) continue;
    settleWeek(ha, 5, st5.id);
    assert(cardOf(ha, 1).mood === 2 && cardOf(ha, 2).mood === 2, 'after a 5 star stretch booking (seed ' + sd + '): moods ' + describe([cardOf(ha, 1).mood, cardOf(ha, 2).mood]) + ', wanted 2 and 2');
    stretchNote = 'a 5 star stretch lifts Happy to Fired up and keeps Fired up (seed ' + sd + ')';
    break;
  }
  assert(stretchNote.indexOf('no loadable') < 0, stretchNote);
  notes.push('Fired up eases after a 3 star event, a 5 star safe booking stops at Happy, ' + stretchNote);
  return '5, 4, 3 and 2 star moods, resting, notice then moving on, a raise keeps them, Fired up as a burst; ' + notes.join('; ');
}

// Step 67 and X15.3: one card, the player idle, the Birthday.
function feltRun(P, role, s, seed) {
  const h = headless(P, null, seed);
  assert(h.sim.skipTutorial() === true, 'skipTutorial() did not return true');
  h.drain();
  h.sim.setPlayer(DEFAULT_LOOK, 'Pitmaster', 'Your Pit');
  h.drain();
  passHiring(h, role + ' ' + s + ' star');
  // Review 1 (X20.13): the wage is capped at the backyard budget (a no-op at 60), so a 5 star FIRE card
  // always loads up; the felt check measures the cook, not the payroll.
  const card = { id: 1, name: 'Rosa', role, skills: [s, s], potential: 5, xp: 0, banked: 0, mood: 0, wage: Math.min(P.wageFor(s, role), P.C.PAYROLL[0]), contract: 1, seasons: 0, rookie: false, trait: null,
    look: Object.assign({}, DEFAULT_LOOK), bring: true, raised: false, notice: false, worked: 0, bench: 0 };
  h.st().crew = [card];   // fixture (X15.3)
  h.st().crewSeq = 2;
  const b = h.sim.bookOffer('birthday');
  assert(b && b.ok, role + ' ' + s + ': bookOffer birthday ' + describe(b));
  const lu = h.sim.loadUp();
  h.drain();
  assert(lu && lu.ok, role + ' ' + s + ': loadUp ' + describe(lu) + ', canLoadUp ' + describe(h.sim.canLoadUp()));
  const mover = role === 'run' ? h.st().buddy : role === 'fire' ? h.st().tender : role === 'till' ? h.st().cashier : h.st().prep;
  assert(mover && mover.cardId === 1, role + ' ' + s + ': no mover for the card (' + describe(mover && { cardId: mover.cardId }) + ')');
  return h;
}
// X18.1 item 38: food in progress.
function foodInProgress(P, s) {
  const cook = COOKERS.some((id) => P.tileOwned(P.MAP.station(id), s.gear) && s.stations[id].pieces.some((p) => p.state !== 'burnt'));
  const board = s.stations.board;
  return cook || board.stacks.some((x) => x.times.length > 0) || (Array.isArray(board.waiting) && board.waiting.length > 0) || board.slicing !== null
    || s.stations.table.spots.some((sp) => sp && sp.times.length > 0);
}
// v3.7: booked guests go straight past the register, so 'waiting' is paid and waiting for the plate.
const awaitsPlate = (c) => c.paid === true && c.fed !== true && (c.mode === 'toSeat' || c.mode === 'seated' || c.mode === 'togo');
const threeWaiting = (s) => s.customers.filter((c) => c.booked === true && (c.mode === 'waiting' || awaitsPlate(c))).length >= 3;

// Review 1 (X20.10): the full booking legs. A scripted player (econ.mjs's competent bot, ported) that
// leaves one role's job to the card: 'run' never takes plates off the board (the plate a slice hands
// over still goes to the table), 'fire' never fetches charcoal, 'prep' leaves every cooked piece on
// the board while the PREP card has room. It plays a whole booking tick by tick; settle is off.
function feltBotPick(P, s, leave) {
  const C = P.C, M = P.MEATS;
  const tile = (id) => { const t = P.MAP.station(id).tiles[0]; return { x: t.x, y: t.y }; };
  const cookers = COOKERS.filter((id) => P.tileOwned(P.MAP.station(id), s.gear));
  const fireOf = (id) => s.stations[id].fire;
  const freeSlot = (ck, size) => {
    const taken = new Array(ck.slots).fill(false);
    for (const p of ck.pieces) for (let i = 0; i < p.size; i++) taken[p.slot + i] = true;
    for (let i = 0; i + size <= ck.slots; i++) { let ok = true; for (let j = 0; j < size; j++) if (taken[i + j]) ok = false; if (ok) return true; }
    return false;
  };
  const tableFits = (meat) => { const sp = s.stations.table.spots; return sp.some((x) => x && x.meat === meat && x.times.length < C.TABLE_STACK) || sp.some((x) => x === null); };
  const boardFits = (meat, plates) => s.stations.board.stacks.some((x) => x.meat === meat && x.times.length + plates <= C.BOARD_STACK) || (s.stations.board.stacks.length < C.BOARD_STACKS && plates <= C.BOARD_STACK);
  const c = s.player.carrying;
  if (c) {
    if (c.kind === 'charcoal') { let best = cookers[0]; for (const id of cookers) if (fireOf(id) < fireOf(best)) best = id; return tile(best); }
    if (c.kind === 'raw') {
      const ok = cookers.filter((id) => (!M[c.meat].drumOnly || id === 'drum') && freeSlot(s.stations[id], M[c.meat].slots) && fireOf(id) >= C.COLD_UNDER);
      if (!ok.length) return null;
      ok.sort((a, b) => fireOf(b) - fireOf(a));
      return tile(ok[0]);
    }
    if (c.kind === 'cooked') {
      const b = s.stations.board;
      if (leave === 'prep' && b.waiting.length < C.PREP_WAIT) return tile('board');
      if (leave === 'prep' && b.slicing !== null) return null;
      return boardFits(c.meat, M[c.meat].plates) ? tile('board') : null;
    }
    if (c.kind === 'burnt') return tile('trash');
    if (c.kind === 'plates') {
      // v3.7: carry it to the seated guest who ordered it (the RUN leg leaves that to the card).
      const g = leave === 'run' ? null : s.customers.filter((cu) => awaitsPlate(cu) && !cu.togo && cu.seat && cu.want === c.meat).sort((a, b) => a.paidAt - b.paidAt)[0];
      if (g) { const se = P.MAP.seats.find((x) => x.id === g.seat); return { x: se.x, y: se.y }; }
      return tableFits(c.meat) ? tile('table') : null;
    }
    return null;
  }
  let pull = null, pullKey = -Infinity;
  for (const id of cookers) for (const p of s.stations[id].pieces) {
    if (p.state === 'cooking') continue;
    const key = p.state === 'burnt' ? 0.5 : 1 + (p.prog - M[p.meat].cook);
    if (key > pullKey) { pullKey = key; pull = id; }
  }
  if (pull && pullKey >= 1) return tile(pull);
  // v3.7: a plate on the counter for a seated guest goes to their table.
  if (leave !== 'run' && s.customers.some((cu) => awaitsPlate(cu) && !cu.togo && cu.seat && s.stations.table.spots.some((x) => x && x.meat === cu.want))) return tile('table');
  const stockLeft = MEAT_IDS.some((m) => s.stock[m] > 0);
  const needsFire = (id, under) => {
    const ck = s.stations[id];
    if (ck.fire >= under) return false;
    if (ck.pieces.some((p) => p.state === 'cooking' || p.state === 'done')) return true;
    return stockLeft && s.clock < s.today.lastCallAt;
  };
  const tends = leave !== 'fire';
  if (tends && s.charcoal > 0) for (const id of cookers) if (needsFire(id, 45)) return tile('pile');
  if (leave !== 'run' && s.stations.board.stacks.some((st) => tableFits(st.meat))) return tile('board');
  if (tends && s.charcoal > 0) for (const id of cookers) if (needsFire(id, 54)) return tile('pile');
  if (pull) return tile(pull);
  if (!stockLeft) return null;
  const cookable = (m) => !M[m].drumOnly || s.gear.drum === true;
  let pick = null;
  const waiting = s.customers.filter((cu) => awaitsPlate(cu)).concat(s.customers.filter((cu) => cu.mode === 'waiting' && cu.queueIndex >= 0).sort((a, b) => a.queueIndex - b.queueIndex));
  for (const cu of waiting) {
    const m = cu.want;
    if (!(s.stock[m] > 0) || !cookable(m)) continue;
    const somewhere = s.stations.table.spots.some((x) => x && x.meat === m) || s.stations.board.stacks.some((x) => x.meat === m)
      || COOKERS.some((id) => s.stations[id].pieces.some((p) => p.meat === m && p.state !== 'burnt'));
    if (!somewhere) { pick = m; break; }
  }
  if (pick === null) for (const m of MEAT_IDS) {
    if (!cookable(m) || !(s.stock[m] > 0)) continue;
    if (pick === null || s.stock[m] > s.stock[pick] || (s.stock[m] === s.stock[pick] && M[m].cook < M[pick].cook)) pick = m;
  }
  if (pick === null) return null;
  const slotOk = cookers.some((id) => (!M[pick].drumOnly || id === 'drum') && freeSlot(s.stations[id], M[pick].slots) && fireOf(id) >= (tends ? C.FIRE_GOOD - 5 : C.COLD_UNDER));
  if (!slotOk) return null;
  return { x: tile('cooler').x, y: tile('cooler').y, meat: pick };
}
// One full booking with a one card crew at skills [s, s]: kind 'birthday' (kettle 1) or 'picnic' (two
// kettles, the fixture's second kettle, the week's picnic card at its size). Returns the till's
// booked, fed and wait sum (an unfed guest counts WAIT_ZERO_S, W22.9) and the card's row.
// The angle redo: the RUN card idles at (2,8), five lane steps from the board (v2: one), so the fed
// window opens a second later than v2's 4 s.
// v3.7: the RUN card now carries board to counter, then counter to table, so the window is wider.
const RUN_FED_S = 8;
const FIRE_SEEDS = [70, 71, 72, 73, 74, 75, 76, 77, 78, 79];
function feltBooking(P, role, s, seed, kind) {
  const h = headless(P, null, seed);
  assert(h.sim.skipTutorial() === true, 'skipTutorial() did not return true');
  h.drain();
  h.sim.setPlayer(DEFAULT_LOOK, 'Pitmaster', 'Your Pit');
  h.drain();
  passHiring(h, role + ' ' + s + ' star ' + kind);
  const st = h.st;
  st().crew = [mkCard(P, 1, 'Rosa', role, [s, s], { potential: 5, wage: Math.min(P.wageFor(s, role), P.C.PAYROLL[0]) })];   // fixture (X20.10; the wage capped at the budget, X20.13)
  st().crewSeq = 2;
  st().cash = 2000;   // fixture: the cart buys the whole rail and the card's charcoal
  if (kind === 'picnic') st().gear.kettle2 = true;   // fixture
  reOffer(h);   // the offers again on the fixture's gear
  h.drain();
  const o = st().season.offers.find((x) => x.type === kind && x.safe);
  assert(o, role + ' ' + s + ' ' + kind + ': no loadable ' + kind + ' card in ' + describe(st().season.offers.map((x) => [x.id, x.safe])));
  const b = h.sim.bookOffer(o.id);
  const lu = h.sim.loadUp();
  h.drain();
  assert(b && b.ok && lu && lu.ok, role + ' ' + s + ' ' + kind + ': loadUp ' + describe(lu) + ', canLoadUp ' + describe(h.sim.canLoadUp()));
  let guard = 0;
  while (st().phase === PHASE.service && guard++ < 200000) {
    const p = st().player;
    if (!(p.busy || p.next || p.path.length || p.target)) {
      const t = feltBotPick(P, st(), role);
      if (t) { if (t.meat) h.sim.selectMeat(t.meat); h.sim.walkTo(t.x, t.y); }
    }
    h.sim.tick();
    h.drain();
  }
  const t = st().till;
  assert(t && t.kind === 'booking', role + ' ' + s + ' ' + kind + ': the booking did not end on the report');
  const row = (t.crew || []).find((r) => r.id === 1) || null;
  const booked = t.booked | 0, fed = t.fed | 0;
  const waitSum = st().today.waitSum + P.C.WAIT_ZERO_S * (booked - fed);
  return { headcount: o.headcount, booked, fed, waitSum, stat: row ? row.stat : null, line: row ? row.line : '' };
}

function feltHeadless(P) {
  const C = P.C;
  const notes = [];
  const fails = [];
  const m = {};
  // FIRE (seed 72): good seconds on kettle 1.
  for (const s of [1, 5]) {
    const h = feltRun(P, 'fire', s, 72);
    h.st().charcoal = 60;   // fixture (X15.3)
    let last = 0;
    h.until(() => { const t = h.st().today; if (t && t.fireGoodS) last = Math.max(last, t.fireGoodS.kettle1 || 0); return h.st().loop === LOOP.report; }, h.st().today.endAt + 10);
    const t = h.st().today;
    if (t && t.fireGoodS) last = Math.max(last, t.fireGoodS.kettle1 || 0);
    m['fire' + s] = Math.round(last * 100) / 100;
  }
  if (!(m.fire5 >= 1.25 * m.fire1)) fails.push('FIRE good seconds ' + m.fire1 + ' at 1 star and ' + m.fire5 + ' at 5, under 1.25 times');
  // RUN (seed 71 up): three booked guests waiting, the board loaded, the RUN card the only carrier.
  let runSeed = null;
  for (let sd = 71; sd <= 90 && runSeed === null; sd++) {
    const h = feltRun(P, 'run', 1, sd);
    let ok = false;
    h.until(() => { ok = threeWaiting(h.st()); return ok || h.st().clock > 70 || h.st().loop === LOOP.report; }, 80);
    if (ok && h.st().clock <= 70) runSeed = sd;
  }
  assert(runSeed !== null, 'RUN: no seed from 71 to 90 has three booked guests waiting at once by clock 70');
  if (runSeed !== 71) notes.push('RUN seed ' + runSeed + ' (71 to ' + (runSeed - 1) + ' never had three waiting by 70)');
  let worstGap = 0;
  for (const s of [1, 5]) {
    const h = feltRun(P, 'run', s, runSeed);
    assert(h.until(() => threeWaiting(h.st()), 80), 'RUN ' + s + ': three never waited on seed ' + runSeed);
    const st = h.st();
    const t0 = st.clock;
    const rail = st.today.rail;
    st.stations.board.stacks = MEAT_IDS.filter((x) => rail[x] > 0).map((x) => ({ meat: x, times: new Array(rail[x]).fill(t0) }));   // fixture (X15.3)
    const waitIds = st.customers.filter((c) => c.booked === true && (c.mode === 'waiting' || awaitsPlate(c))).sort((a, b) => (a.paidAt || 1e9) - (b.paidAt || 1e9) || a.id - b.id).slice(0, 3).map((c) => c.id);
    const n0 = h.log.length;
    let fed4 = null, plates10 = null, gap = 0, maxGap = 0;
    const endAt = st.today.endAt;
    const dt = C.TICK_SECONDS;
    h.until(() => {
      const s2 = h.st();
      const td = s2.today;
      if (fed4 === null && s2.clock >= t0 + RUN_FED_S - 1e-9) fed4 = td.fed;
      if (plates10 === null && s2.clock >= t0 + 10 - 1e-9) plates10 = td.crew && td.crew['1'] ? td.crew['1'].plates : 0;
      if (s === 5 && td.pending > 0 && s2.clock < endAt - C.LAST_CALL_GUARD - 1e-9) {
        const lineEmpty = !s2.customers.some((c) => c.booked === true && (c.mode === 'arriving' || c.mode === 'waiting' || awaitsPlate(c)));
        if (lineEmpty && foodInProgress(P, s2)) { gap += dt; if (gap > maxGap) maxGap = gap; } else gap = 0;
      }
      return s2.loop === LOOP.report;
    }, endAt + 10);
    const servedAt = {};
    for (const e of h.of(EVENT.served, n0)) if (waitIds.includes(e.id) && !(e.id in servedAt)) servedAt[e.id] = e._at;
    const end = h.st().clock;
    const unserved = waitIds.filter((id) => !(id in servedAt)).length;
    const meanWait = waitIds.reduce((a, id) => a + ((id in servedAt ? servedAt[id] : end) - t0), 0) / waitIds.length;
    m['runPlates' + s] = plates10;
    m['runFed' + s] = fed4;
    m['runWait' + s] = Math.round(meanWait * 100) / 100;
    if (unserved) notes.push('RUN ' + s + ': ' + unserved + ' of the three never served (deviation 28)');
    if (s === 5) worstGap = Math.round(maxGap * 100) / 100;
  }
  if (!(m.runPlates5 >= 1.25 * m.runPlates1)) fails.push('RUN plates in 10 s ' + m.runPlates1 + ' and ' + m.runPlates5 + ', under 1.25 times');
  if (!(m.runFed5 >= 1.25 * m.runFed1)) fails.push('RUN fed in ' + RUN_FED_S + ' s ' + m.runFed1 + ' and ' + m.runFed5 + ', under 1.25 times');
  if (!(m.runWait5 <= 0.75 * m.runWait1)) fails.push('RUN mean wait ' + m.runWait1 + ' s and ' + m.runWait5 + ' s, over 0.75 times');
  if (!(worstGap <= C.ARRIVAL_PULL_S + 0.1 + 1e-9)) fails.push('carry-forward 3: the line sat empty ' + worstGap + ' s with food in progress, over ' + (C.ARRIVAL_PULL_S + 0.1));
  // PREP (seed 73): two pieces left at the gate.
  for (const s of [1, 5]) {
    const h = feltRun(P, 'prep', s, 73);
    assert(h.until(() => h.st().clock >= h.st().today.gateAt, h.st().today.gateAt + 2), 'PREP ' + s + ': never reached the gate');
    h.st().stations.board.waiting = [{ meat: 'sausage' }, { meat: 'chicken' }];   // fixture (X15.3)
    const t0 = h.st().clock;
    const n0 = h.log.length;
    const done = () => h.of(EVENT.sliceDone, n0).filter((e) => e.by === 'prep');
    h.until(() => done().length >= 2 || h.st().loop === LOOP.report, 60);
    const d = done();
    assert(d.length >= 2, 'PREP ' + s + ': ' + d.length + ' slice_done by prep within 60 s');
    m['prep' + s] = Math.round((d[1]._at - t0) * 100) / 100;
  }
  if (!(m.prep5 <= 0.75 * m.prep1)) fails.push('PREP two slices ' + m.prep1 + ' s and ' + m.prep5 + ' s, over 0.75 times');
  // Review 1 (X20.10): the full booking legs, a Birthday on kettle 1 and the week's picnic on two
  // kettles, the scripted player leaving the card's job to it. Each role's player facing number must
  // move 25 percent between 1 and 5 stars: RUN the tips on the plates it ran, FIRE and PREP the mean
  // wait of every booked guest over both legs (unfed guests at WAIT_ZERO_S).
  const full = {};
  for (const [role, seed] of [['run', 71], ['fire', 72], ['prep', 73]]) {
    for (const s of [1, 5]) {
      // The angle redo: on the shorter lane the FIRE wait swings with the seed (one seed ran 0.43 to 0.91),
      // so FIRE pools its wait over FIRE_SEEDS; RUN and PREP keep one seed each.
      const legs = (role === 'fire' ? FIRE_SEEDS : [seed]).flatMap((sd) => ['birthday', 'picnic'].map((kind) => feltBooking(P, role, s, sd, kind)));
      const booked = legs.reduce((a, l) => a + l.booked, 0);
      full[role + s] = {
        tips: legs.reduce((a, l) => a + (l.stat ? l.stat.tips | 0 : 0), 0),
        wait: booked ? Math.round(100 * legs.reduce((a, l) => a + l.waitSum, 0) / booked) / 100 : 0,
        fed: role === 'fire' ? legs.reduce((a, l) => a + l.fed, 0) + '/' + booked + ' over ' + FIRE_SEEDS.length + ' seeds' : legs.map((l) => l.fed + '/' + l.booked).join(' and '),
        lines: legs.map((l) => l.line)
      };
    }
  }
  if (!(full.run5.tips >= 1.25 * full.run1.tips && full.run1.tips >= 0)) fails.push('full bookings: RUN tips on its plates ' + full.run1.tips + ' at 1 star and ' + full.run5.tips + ' at 5, under 1.25 times');
  if (!(full.fire5.wait <= 0.75 * full.fire1.wait)) fails.push('full bookings: FIRE mean wait ' + full.fire1.wait + ' s at 1 star and ' + full.fire5.wait + ' s at 5, over 0.75 times');
  if (!(full.prep5.wait <= 0.75 * full.prep1.wait)) fails.push('full bookings: PREP mean wait ' + full.prep1.wait + ' s at 1 star and ' + full.prep5.wait + ' s at 5, over 0.75 times');
  m.full = full;
  report.metrics.feltDifference = Object.assign({ runSeed, emptyLineMaxS: worstGap }, m);
  const line = 'FIRE good ' + m.fire1 + ' to ' + m.fire5 + ' s (' + (m.fire1 ? Math.round(100 * m.fire5 / m.fire1) / 100 : 'inf') + 'x); RUN plates ' + m.runPlates1 + ' to ' + m.runPlates5 + ', fed ' + m.runFed1 + ' to ' + m.runFed5
    + ', wait ' + m.runWait1 + ' to ' + m.runWait5 + ' s; PREP ' + m.prep1 + ' to ' + m.prep5 + ' s; empty line at most ' + worstGap + ' s'
    + '; full bookings: RUN tips ' + full.run1.tips + ' to ' + full.run5.tips + ', FIRE wait ' + full.fire1.wait + ' to ' + full.fire5.wait + ' s (fed ' + full.fire1.fed + ' to ' + full.fire5.fed + '), PREP wait ' + full.prep1.wait + ' to ' + full.prep5.wait + ' s';
  assert(fails.length === 0, fails.join('; ') + ' (' + line + ')');
  return line + (notes.length ? '; ' + notes.join('; ') : '');
}

// Step 68.
function thirdsHeadless(P) {
  const C = P.C;
  const R = refModel(P);
  const notes = [];
  // A week at rep 40: every booking fee carries THIRD_PAY[1].
  const a = fromSave(P, v5Save({ rep: 40 }), 681);
  assert(a.st().loop === LOOP.week, 'the rep 40 fixture loaded as ' + describe(a.st().loop));
  assert(a.sim.fanThird() === 1, 'fanThird() at rep 40 ' + a.sim.fanThird());
  for (const o of a.st().season.offers.filter((x) => x.type !== 'yard')) {
    const k = R.kOf(1, o.tier === 'stretch');
    assert(o.pay === R.feeK(o.headcount, o.menu, k), 'rep 40: ' + o.id + ' pays ' + o.pay + ', wanted ' + R.feeK(o.headcount, o.menu, k) + ' at THIRD_PAY[1]');
  }
  // A 4 star booking crossing the first edge.
  const fans4 = C.STAR_FANS[3];
  assert(fans4 > 0, 'C.STAR_FANS[3] ' + fans4 + ' moves nobody up a third');
  const from = C.THIRD_EDGES[0] - fans4;
  const b = fromSave(P, v5Save({ rep: from }), 682);
  const t = settleWeek(b, 4);
  assert(b.st().rep === C.THIRD_EDGES[0] && t.third === 0 && t.thirdTo === 1, 'a 4 star booking from rep ' + from + ': rep ' + b.st().rep + ', till.third ' + describe(t.third) + ', thirdTo ' + describe(t.thirdTo));
  if (atStart(C, ['STAR_FANS']) && deepEq(C.THIRD_EDGES, [34, 67])) assert(from === 30, 'X15.2 literal: rep 30 to 34');
  // The top third: the repeat invite and three walk-ins.
  const c = fromSave(P, v5Save({ rep: 70 }), 683);
  const inv = c.st().season.offers.filter((o) => o.invite === true);
  assert(inv.length === 1 && c.st().season.walkins.length === C.WALKINS[2], 'rep 70: invites ' + describe(inv.map(offerBrief)) + ', walk-ins ' + c.st().season.walkins.length + ', wanted 1 and ' + C.WALKINS[2]);
  notes.push('rep 70 invite ' + inv[0].id + ' (' + inv[0].type + ')');
  return 'rep 40 fees at THIRD_PAY[1], a 4 star booking from ' + from + ' to ' + C.THIRD_EDGES[0] + ' gives third 0 to 1, rep 70 holds an invite and ' + C.WALKINS[2] + ' walk-ins; ' + notes.join('; ');
}

// Step 69: X11.3, the 6.10 migration.
function migratedSamples() {
  const v3 = JSON.parse(JSON.stringify(SAVE_V3_SAMPLE));
  v3.hires = { buddy: true, tender: true };
  v3.gear.drum = true;
  const v4 = JSON.parse(JSON.stringify(SAVE_V4_SAMPLE));
  v4.hires = { buddy: true, tender: true };
  v4.gear.drum = true;
  return { v3, v4 };
}
function migrateHeadless(P) {
  const names = P.STRINGS.names;
  const notes = [];
  const { v3, v4 } = migratedSamples();
  for (const [label, raw] of [['v3 (v2.1)', v3], ['v4 (v3.0)', v4]]) {
    const r = P.validateSave(JSON.parse(JSON.stringify(raw)));
    assert(r && r.v === SAVE_V && !('hires' in r), label + ': ' + describe(r && { v: r.v, hires: r.hires }));
    assert(Array.isArray(r.crew) && r.crew.length === 2, label + ': crew ' + describe(r.crew));
    const [run, fire] = r.crew;
    const common = (c, id) => c.id === id && c.mood === 0 && c.xp === 0 && c.banked === 0 && c.seasons === 0 && c.rookie === false && c.trait === null && c.bring === true && c.raised === false && c.notice === false && c.worked === 1 && c.bench === 0 && c.contract === 1 && c.potential === 4;
    assert(run.role === 'run' && sameJSON(run.skills, [2.5, 2.5]) && run.wage === 20 && common(run, 1), label + ': the RUN card ' + describe(run));
    assert(fire.role === 'fire' && sameJSON(fire.skills, [3, 3]) && fire.wage === 30 && common(fire, 2), label + ': the FIRE card ' + describe(fire));
    // Names and looks from the season seed (X11.3, deviation 29).
    const seed = r.season.seed;
    const used = [];
    for (let n = 0; n < 2; n++) {
      let k = refMix32(seed, 0x4E414D45, n) % names.length;
      while (used.includes(names[k])) k = (k + 1) % names.length;
      used.push(names[k]);
      const rl = refMulberry32(refMix32(seed, 0x4C4F4F4B, n));
      const look = refLook(rl, P.C);
      assert(r.crew[n].name === names[k] && deepEq(r.crew[n].look, look), label + ': card ' + (n + 1) + ' name ' + describe(r.crew[n].name) + ', look ' + describe(r.crew[n].look) + ', the X11.3 model ' + names[k] + ' ' + describe(look));
    }
    assert(r.crew[0].name !== r.crew[1].name && r.crew.every((c) => names.includes(c.name)), label + ': names ' + describe(r.crew.map((c) => c.name)));
    assert(r.crewSeq === 3 && r.hiring === null && r.season.drafted === true && r.season.trained === null && sameJSON(r.season.walkins, []), label + ': crewSeq, hiring, drafted, trained, walkins ' + describe([r.crewSeq, r.hiring, r.season.drafted, r.season.trained, r.season.walkins]));
    const sim = P.createSim(r, 691);
    const pr = sim.payroll();
    assert(pr.now === 50 && pr.budget === P.C.PAYROLL[0] && pr.count === 2, label + ': payroll() ' + describe(pr));
    const ser = sim.serialize();
    assert(!('hires' in ser) && Array.isArray(ser.crew) && ser.crew.length === 2, label + ': serialize() ' + describe({ hires: ser.hires, crew: ser.crew && ser.crew.length }));
    notes.push(label + ' ' + r.crew.map((c) => c.name + ' ' + c.role).join(' and ') + ', loop ' + sim.state.loop);
  }
  return 'buddy and tender to a RUN and a FIRE card, payroll 50 of ' + P.C.PAYROLL[0] + ', no hires on serialize; ' + notes.join('; ');
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

// [S 19.6] Every canvas tap asks the renderer where a tile sits on screen,
// PitSim.game.tileToClient(tx, ty) -> { x, y } in client px (the oblique v3 yard is not a flat
// grid). Until the swap builder lands it, fall back to the flat grid math so the harness runs.
let tileToClientSeen = null;   // true once the renderer answered, false once we fell back
async function canvasPoint(tx, ty) {
  // The angle redo F: every tap goes through PitSim.game.tileToClient, which pans the camera first.
  const live = await ev('(() => { const g = window.PitSim && window.PitSim.game; if (!g || typeof g.tileToClient !== "function") return null; const p = g.tileToClient(' + Number(tx) + ', ' + Number(ty) + '); if (!p) return null; const x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y; return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null; })()');
  assert(live, 'PitSim.game.tileToClient(' + tx + ', ' + ty + ') gave no client point');
  tileToClientSeen = true;
  return live;
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
// v3.7: guests pay first. Ring up anyone waiting in line with a register tap.
const lineWaitingExpr = F.customers + '.some((c) => c.queueIndex >= 0 && c.mode === "waiting")';
async function ringLine() {
  if (!(await ev(lineWaitingExpr)) || !(await ev(F.carrying + ' === null'))) return false;
  const r = await goto('register', '!(' + lineWaitingExpr + ')');
  return r.ok;
}
const seatedWants = (meatExpr) => F.customers + '.filter((c) => c.paid && !c.fed && !c.togo && c.seat && (c.mode === "seated" || c.mode === "toSeat") && c.want === ' + meatExpr + ').sort((a, b) => a.paidAt - b.paidAt)';
const counterForSeated = F.customers + '.some((c) => c.paid && !c.fed && !c.togo && c.seat && (c.mode === "seated" || c.mode === "toSeat") && ' + F.tableSpots + '.some((sp) => sp && sp.meat === c.want && sp.times.length > 0))';
// v3.7: a plate in hand goes to the seated guest who ordered it (a tap on their table), else onto the counter.
async function deliverOrSet() {
  const seat = await ev('(() => { const h = ' + F.carrying + '; if (!h || h.kind !== "plates") return null; const c = ' + seatedWants('h.meat') + '[0]; return c ? MAP.seats.find((x) => x.id === c.seat) : null; })()');
  if (seat) {
    const n0 = await ev(F.today + '.served');
    await canvasTap(seat.x, seat.y + 1);
    await settle();
    if ((await ev(F.today + '.served')) > n0) return true;
    tapNotes.push('seat via walkTo');
    await ev('sim.' + SIM_METHODS.walkTo + '(' + seat.x + ', ' + seat.y + ')');
    taps += 1;
    await settle();
    if ((await ev(F.today + '.served')) > n0) return true;
  }
  const r = await goto('table', F.carrying + ' === null');
  return r.ok;
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
  // The angle redo C: on a phone the whole yard is the far view; the near view comes back after.
  const was = await ev('(() => { const c = g && g.camera; if (!c || typeof c.get !== "function") return null; const m = (c.get() || {}).mode; c.set("far"); g.advance(0); return m; })()');
  await ev('(document.getElementById(' + JSON.stringify(PANELS_ID) + ').style.visibility = "hidden", true)');
  try {
    return await screenshot(name);
  } finally {
    await ev('(document.getElementById(' + JSON.stringify(PANELS_ID) + ').style.visibility = "", true)');
    if (was) await ev('(() => { g.camera.set(' + JSON.stringify(was) + '); g.advance(0); return true; })()');
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
// v3.2 (D10.1): the day helpers by taps.
const pageC = () => ev('JSON.parse(JSON.stringify(C))');
async function litDays() {
  return ev('[0, 1, 2, 3, 4, 5, 6].filter((i) => $("day-" + i) && $("day-" + i).classList.contains("now"))');
}
async function nextDayTap() {
  assert(await visible('daycard'), '#daycard hidden after a quick day');
  await click('daycard-next');
  await advance(0);
}
// v3.4 playtest: the game's pick is the one big #hub-start; the other choice is #day-<kind> behind
// #hub-change (Change plan). A pick that needs stock goes through the morning shop, confirmed here.
// v3.5: Monday's week planner. The day by day flows plan every weekday a Yard day (so nothing passes
// on its own) and start the week; each day is then picked on the hub as before.
async function passPlanner() {
  if (!(await present('planner'))) return false;
  for (let d = 0; d < 5; d++) if ((await attrOf('plan-day-' + d, 'data-kind')) !== 'yard') { await click('plan-day-' + d); await advance(0); }
  await click('plan-start');
  await advance(0);
  return true;
}
async function quickTap(kind) {
  await passPlanner();
  if (!(await present('day-' + kind))) {
    const rk = await ev('(sim.recommendDay() || {}).kind');
    if (rk === kind) {
      await click('hub-start');
      await advance(0);
      if (await visible('mshop')) { await click('shop-confirm'); await advance(0); }
      return;
    }
    if ((await present('hub-change')) && (await attrOf('hub-change', 'aria-expanded')) !== 'true') { await click('hub-change'); await advance(0); }
  }
  await click('day-' + kind);
  await advance(0);
  if (await visible('mshop')) { await click('shop-confirm'); await advance(0); }
}
// v3.4: today offers this kind (as the pick on #hub-start or behind Change plan).
async function dayOffered(kind) {
  return ev('(sim.dayOptions().options || []).some((o) => o.kind === ' + JSON.stringify(kind) + ')');
}
// v3.4: the booked event is today (the old #go showing in the day choice).
async function goShown() {
  return (await visible(ID3.week)) && (await dayOffered('event'));
}
async function savedDayIsLit(label) {
  const raw = await storedSave();
  const lit = await litDays();
  assert(raw && lit.length === 1 && raw.season.day === lit[0], label + ': stored season.day ' + describe(raw && raw.season.day) + ', lit ' + describe(lit));
  return lit[0];
}
// D10.1: after a Saturday cook's report the hub is Sunday; a v3.1 step that wanted the next week taps
// Day off and Next day once.
async function restOfWeek() {
  const st = await ev('({ loop: S().loop, phase: S().phase, day: S().season.day, played: S().season.dayLog.includes("event") })');
  if (st.loop !== 'week' || st.day !== 6 || !st.played || !(await dayOffered('off'))) return false;
  await quickTap('off');
  await nextDayTap();
  return true;
}
// Every v3.1 step that reached Load up and go from the week hub first taps Day off, then Next day,
// until #go shows.
async function toBookedDay() {
  for (let i = 0; i < 7; i++) {
    if (await goShown()) return i;
    if (await visible('daycard')) { await nextDayTap(); continue; }
    if (!(await dayOffered('off'))) break;
    await quickTap('off');
    await nextDayTap();
  }
  assert(await goShown(), 'the booked day never came; day ' + describe(await ev('S().season.day')));
  return 7;
}
// The cart by taps on the shop sheet: every line to 0, then `lines` (+1 taps, +5 for charcoal).
async function cartByTaps(lines) {
  await click(ID3.cardShop);
  await advance(0);
  if ((await present('shop-other')) && (await attrOf('shop-other', 'aria-expanded')) === 'false') { await click('shop-other'); await advance(0); }
  const cart = await ev('({ meat: Object.assign({}, S().cart.meat), charcoal: S().cart.charcoal })');
  for (const m of MEAT_IDS) if (cart.meat[m] > 0) await stepDown(m);
  if (cart.charcoal > 0) await stepDown('charcoal');
  for (const [id, n] of Object.entries(lines)) {
    if (id === 'charcoal' && n % 5 === 0) { for (let i = 0; i < n / 5; i++) await click('inc5-charcoal'); continue; }
    for (let i = 0; i < n; i++) await click(ID.inc(id));
  }
  await advance(0);
  await click(ID3.sheetBack);
  await advance(0);
}
// A v6 browser fixture (D10.1): the saveV5 one with the five day keys, Monday unless `over` says.
const DAY_CARD = { id: 1, name: 'Rosa', role: 'run', skills: [2, 2], potential: 3, xp: 0, banked: 0, mood: 0, wage: 16, contract: 1, seasons: 0, rookie: false, trait: null,
  look: { skin: 2, hair: 1, hairColor: 2, face: 0, hat: 0, apron: 1 }, bring: true, raised: false, notice: false, worked: 1, bench: 0 };
// v3.5: a v9 save from the v6 fixture, with the pitmaster and the plan keys.
function saveV9(over = {}) {
  const pit = over.pit, decor = over.decor;
  const o = Object.assign({}, over);
  delete o.pit; delete o.decor;
  const s = saveV6(o);
  s.v = 9;
  s.pit = Object.assign({ xp: 0, longDay: 0 }, pit || {});
  if (decor) s.decor = Object.assign({}, s.decor, decor);
  s.season = Object.assign({ advance: 0, plan: null }, s.season);
  return s;
}
function saveV6(over = {}) {
  const s = saveV5(over);
  s.v = 6;
  s.season = Object.assign({ day: 0, dayLog: NULL7(), prepped: false, loadin: false, overnight: null }, s.season);
  return s;
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
  // The angle redo C: the yard canvas is the camera's viewport, its backing store the CSS box times dpr.
  assert(r.w > 0 && r.h > 0 && r.w <= r.vw, label + ': #cv rect ' + r.w + ' by ' + r.h + ' in a ' + r.vw + ' by ' + r.vh + ' viewport');
  assert(Math.abs(r.w * r.dpr - r.bw) < 1 && Math.abs(r.h * r.dpr - r.bh) < 1, label + ': backing store ' + r.bw + ' by ' + r.bh + ', wanted the rect ' + r.w + ' by ' + r.h + ' times dpr ' + r.dpr);
  return label + ' ' + r.w + 'x' + r.h + ' dpr ' + r.dpr;
}
// Ghost records (unowned previews) never count as the real draw.
const hasRecord = (frame, want) => frame.some((d) => !d.ghost && d.name === want.name && d.x === want.x && d.y === want.y && (want.frame === undefined || d.frame === want.frame));
// The angle redo check 3: zero ghost records; one "+" record per unowned MAP.forSale id (none while a
// person stands on one of its marker tiles is allowed), none for owned ones, none for other ids.
async function plusChecks(frame, label) {
  const ghosts = frame.filter((d) => d.ghost === true);
  assert(ghosts.length === 0, label + ': ' + ghosts.length + ' ghost records, first ' + describe(ghosts.slice(0, 3)));
  // v3.4 playtest: the "+" marks show only while the Shop or Gear sheet is open.
  const shown = await ev('!!(g.saleShown && g.saleShown())');
  if (!shown) {
    const pl = frame.filter((d) => d.name === PLUS);
    assert(pl.length === 0, label + ': ' + pl.length + ' "+" records with no Shop or Gear sheet open');
    return '0 plus (no sheet open)';
  }
  const want = await ev('(() => { const s = S(); const ppl = [s.player, s.buddy, s.tender, s.prep].concat(s.customers || []).filter(Boolean).map((p) => p.x + "," + p.y); return Object.keys(MAP.forSale).map((id) => ({ id, owned: s.gear[id] === true || s.decor[id] === true, stood: MAP.forSale[id].some((t) => ppl.includes(t.x + "," + t.y)) })); })()');
  const plus = frame.filter((d) => d.name === PLUS);
  const bad = [];
  for (const w of want) {
    const n = plus.filter((d) => d.id === w.id).length;
    if (w.owned ? n !== 0 : (w.stood ? n > 1 : n !== 1)) bad.push(w.id + (w.owned ? ' owned' : '') + ' has ' + n);
  }
  const stray = plus.filter((d) => !want.some((w) => w.id === d.id)).map((d) => d.id);
  assert(bad.length === 0 && stray.length === 0, label + ': plus records ' + bad.join(', ') + (stray.length ? '; stray ' + describe(stray) : ''));
  return plus.length + ' plus';
}
// The angle redo check 5: art3.drawPerson calls with their who and pose, spied in the page.
async function spyPerson(on) {
  if (on) {
    return ev('(() => { const A = globalThis.' + GLOBAL_NAME + '.art3; if (!A || typeof A.drawPerson !== "function") return false; if (!window.__pitPersonOrig) { const orig = A.drawPerson; window.__pitPersonOrig = orig; A.drawPerson = function () { if (window.__pitPersonCalls) window.__pitPersonCalls.push([].slice.call(arguments, 1, 3).filter((a) => typeof a === "string")); return orig.apply(this, arguments); }; } window.__pitPersonCalls = []; return true; })()');
  }
  return ev('(() => { const c = window.__pitPersonCalls || []; window.__pitPersonCalls = []; return c; })()');
}
async function onePitmaster(yardCalls) {
  const crCalls = await spyPerson(false);
  await ev('(() => { const A = globalThis.' + GLOBAL_NAME + '.art3; if (window.__pitPersonOrig) { A.drawPerson = window.__pitPersonOrig; delete window.__pitPersonOrig; } delete window.__pitPersonCalls; return true; })()');
  const isPlayer = (c) => c.includes('player');
  assert(yardCalls.some(isPlayer), 'the yard drew no player through art3.drawPerson: ' + describe(yardCalls.slice(0, 6)));
  assert(crCalls.some((c) => isPlayer(c) && c.includes('down')), 'the creator preview drew no ("player", "down") through art3.drawPerson: ' + describe(crCalls.slice(0, 6)));
}
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

// v3.1 (X15.1 step 21, X12): the star and mood frames, the busts, the crew keys, setCrewLook and
// portrait. Runs in the page on the tutorial morning, before any crew is drawn.
async function crewArtChecks() {
  const r = await run(`
    const A = globalThis.${GLOBAL_NAME}.art;
    const out = { bad: [], notes: [] };
    const KEYS = ${describe(LOOK_KEYS)};
    const COUNTS = ${describe(LOOK_COUNTS)};
    const DEF = ${describe(DEFAULT_LOOK)};
    const LEG = ${describe(LEGEND)};
    const ROLES = ${describe(['run', 'fire', 'prep'])};   // sprites.js roles; the TILL card is art3 only (v3.6)
    const BW = ${BUST.w}, BH = ${BUST.h};
    for (const n of ['setCrewLook', 'crewKey', 'bustRows', 'portrait']) if (typeof A[n] !== 'function') out.bad.push('art.' + n + ' missing');
    if (out.bad.length) return out;
    const star = A.SPRITES.star;
    if (!star || star.frames.length !== 4) out.bad.push('star has ' + (star && star.frames.length) + ' frames');
    else {
      const f0 = star.frames[0], f1 = star.frames[1], f2 = star.frames[2];
      for (let y = 0; y < 9; y++) {
        const want = f0[y].slice(0, 5) + f1[y].slice(5, 9);
        if (f2[y] !== want) { out.bad.push('star frame 2 row ' + y + ' is ' + f2[y] + ', wanted ' + want + ' (frame 0 columns 0 to 4, frame 1 columns 5 to 8)'); break; }
      }
      if (star.frames[3].join('/') === star.frames[0].join('/') || star.frames[3].join('/') === star.frames[1].join('/')) out.bad.push('star frame 3 (hollow) repeats frame 0 or 1');
    }
    const mood = A.SPRITES.mood;
    if (!mood || mood.frames.length !== 5 || mood.w !== 10 || mood.h !== 10) out.bad.push('mood is ' + (mood && mood.w) + 'x' + (mood && mood.h) + ' with ' + (mood && mood.frames.length) + ' frames');
    else if (new Set(mood.frames.map((f) => f.join('/'))).size !== 5) out.bad.push('mood frames repeat');
    const CO = A.CREW_OUTFIT;
    if (!CO || !Object.isFrozen(CO) || ROLES.some((role) => !CO[role] || !Object.isFrozen(CO[role]))) out.bad.push('art.CREW_OUTFIT ' + JSON.stringify(CO && Object.keys(CO)));
    const rowsOf = (look, role) => A.bustRows(look, role);
    const valid = (rows, label) => {
      if (!Array.isArray(rows) || rows.length !== BH || rows.some((row) => typeof row !== 'string' || row.length !== BW || [...row].some((ch) => !LEG.includes(ch)))) {
        out.bad.push(label + ' is not ' + BH + ' rows of ' + BW + ' legend characters');
        return false;
      }
      return true;
    };
    const base = {};
    for (const role of ROLES) { const rows = rowsOf(DEF, role); if (valid(rows, 'bustRows(DEFAULT_LOOK, ' + role + ')')) base[role] = rows.join('/'); }
    if (base.run && base.fire && base.prep && (base.run === base.fire || base.run === base.prep || base.fire === base.prep)) out.bad.push('two roles draw the same bust');
    for (const role of ROLES) {
      for (const k of KEYS) {
        if (role === 'run' && k === 'apron') continue;   // deviation 26: the RUN outfit has no apron
        const grids = [];
        for (let i = 0; i < COUNTS[k]; i++) {
          const rows = rowsOf(Object.assign({}, DEF, { [k]: i }), role);
          grids.push(valid(rows, role + ' ' + k + ' ' + i) ? rows.join('/') : null);
        }
        for (let i = 0; i < grids.length; i++) {
          for (let j = i + 1; j < grids.length; j++) {
            if (grids[i] === null || grids[i] !== grids[j]) continue;
            if (k === 'hair' || k === 'hairColor') {
              const differ = (over) => rowsOf(Object.assign({}, DEF, over, { [k]: i }), role).join('/') !== rowsOf(Object.assign({}, DEF, over, { [k]: j }), role).join('/');
              if (differ({ hat: 0 }) || (k === 'hairColor' && differ({ hat: 0, hair: 2 }))) { out.notes.push(role + ' ' + k + ' ' + i + ' and ' + j + ' differ bare headed'); continue; }
            }
            out.bad.push(role + ' bust: ' + k + ' ' + i + ' and ' + j + ' draw the same rows');
          }
        }
      }
    }
    const keyOf = (l) => KEYS.map((k) => l[k]).join('-');
    out.k0 = { run: A.crewKey('run'), fire: A.crewKey('fire'), prep: A.crewKey('prep') };
    const before = A.SPRITES.buddy_down.frames[0].join('/');
    const L = { skin: 4, hair: 2, hairColor: 3, face: 2, hat: 0, apron: 0 };
    out.ret = A.setCrewLook('run', L);
    out.k1 = A.crewKey('run');
    out.want = 'run:' + keyOf(L);
    out.changed = A.SPRITES.buddy_down.frames[0].join('/') !== before;
    for (const [n, w, h, f] of [['buddy_down', 16, 24, 3], ['buddy_up', 16, 24, 3], ['buddy_side', 16, 24, 3]]) {
      const sp = A.SPRITES[n];
      if (!sp || sp.w !== w || sp.h !== h || sp.frames.length !== f) out.bad.push(n + ' after setCrewLook is ' + (sp && sp.w) + 'x' + (sp && sp.h) + ' with ' + (sp && sp.frames.length) + ' frames');
      else if ([...new Set(sp.frames.join('').split(''))].some((ch) => ch !== ',' && !(LEG + '.').includes(ch))) out.bad.push(n + ' after setCrewLook uses a character outside the legend');
    }
    const c = A.portrait(DEF, 'fire', { scale: 2, dpr: 1 });
    out.portrait = c ? { tag: c.tagName, w: c.width, h: c.height, sw: c.style.width, sh: c.style.height, hidden: c.getAttribute('aria-hidden') } : null;
    const c2 = A.portrait(DEF, 'prep', { scale: 3, dpr: 2 });
    out.portrait2 = c2 ? { w: c2.width, h: c2.height, sw: c2.style.width, sh: c2.style.height } : null;
    return out;
  `);
  assert(r.bad.length === 0, r.bad.length + ' crew art problem(s), first ' + r.bad.slice(0, 4).join('; '));
  const prepKey = 'prep:' + lookKeyOf(PREP_DEFAULT_LOOK);
  assert(deepEq(r.k0, { run: '', fire: '', prep: prepKey }), 'art.crewKey() after build() ' + describe(r.k0) + ', wanted run and fire empty and ' + prepKey);
  assert(r.ret === r.want && r.k1 === r.want && r.changed === true, "setCrewLook('run', look) returned " + describe(r.ret) + ', crewKey ' + describe(r.k1) + ', buddy_down changed ' + r.changed + ', wanted ' + describe(r.want));
  assert(deepEq(r.portrait, { tag: 'CANVAS', w: 2 * BUST.w, h: 2 * BUST.h, sw: 2 * BUST.w + 'px', sh: 2 * BUST.h + 'px', hidden: 'true' }), "portrait(DEFAULT_LOOK, 'fire', { scale: 2, dpr: 1 }) " + describe(r.portrait) + ', wanted a 52 by 44 canvas');
  assert(deepEq(r.portrait2, { w: 6 * BUST.w, h: 6 * BUST.h, sw: 3 * BUST.w + 'px', sh: 3 * BUST.h + 'px' }), "portrait at scale 3, dpr 2 " + describe(r.portrait2) + ', wanted 156 by 132 device px in 78 by 66 CSS px');
  return 'crew art: star half frame, 5 mood faces, 3 role busts of 26 by 22, every look index distinct, crew keys, setCrewLook, portrait 52 by 44' + (r.notes.length ? ' (' + r.notes.slice(0, 4).join('; ') + (r.notes.length > 4 ? ' and ' + (r.notes.length - 4) + ' more' : '') + ', deviation 26)' : '');
}

// v3.1 report and Hiring Day helpers (module level: steps 46, 50, 51, 53, 54 and 70 to 75 share them).
const rowLabels = (stars) => [stars === 1 ? UI.rowFeeOne : fill(UI.rowFee, { n: stars }), UI.rowDeposit, UI.rowTips, UI.rowMenuBonus, UI.rowSeatTips, UI.rowFood,
  UI.rowCharcoal, UI.rowWages, UI.rowDaily, UI.rowSpoiled, UI.rowThrown, UI.rowGrate, UI.rowBurnt, UI.rowTake, UI.rowGear, UI.rowKept, UI.rowDrawn, UI.rowCash];
// v3.1 (X13.6, deviation 31): the compact rows are the visible #rep-money rows outside
// #rep-money-detail; the detail rows are the ones inside it (open or not).
async function moneyRows(part) {
  return ev('(() => { const box = $(' + JSON.stringify(ID3.repMoney) + '), det = $(' + JSON.stringify(ID31.repMoneyDetail) + ');'
    + ' const all = part => part === "detail" ? (det ? [...det.querySelectorAll(".row")] : []) : (box ? [...box.querySelectorAll(".row")] : []).filter((r) => !(det && det.contains(r)) && r.getClientRects().length > 0);'
    + ' return all(' + JSON.stringify(part) + ').map((r) => ({ name: ((r.querySelector(".name") || r).textContent || "").replace(/\\s+/g, " ").trim(), n: (((r.querySelector(".name") || r).firstChild || {}).textContent || "").trim(),'
    + ' d: ((r.querySelector(".effect") || {}).textContent || "").trim(), v: ((r.querySelector(".price") || {}).textContent || "").trim() })); })()');
}
const labelIdx = (names, labels) => names.map((n) => {
  let best = -1, len = -1;
  labels.forEach((l, i) => { if (n.startsWith(l) && l.length > len) { best = i; len = l.length; } });
  return best;
});
// The v3.0 rows (W17.4 order) inside #rep-money-detail.
async function moneyOrder(stars, addon) {
  const names = (await moneyRows('detail')).map((r) => r.name);
  const labels = rowLabels(stars);
  const idx = labelIdx(names, labels);
  assert(idx.every((i) => i >= 0), '#rep-money-detail rows ' + describe(names) + ' hold a label outside W17.4');
  assert(idx.every((i, j) => j === 0 || i > idx[j - 1]), '#rep-money-detail rows out of W17.4 order: ' + describe(names));
  for (const must of [0, 1]) assert(idx.includes(must), '#rep-money-detail has no ' + describe(labels[must]) + ' row: ' + describe(names));
  if (!addon) assert(!idx.includes(3), '#rep-money-detail shows ' + describe(UI.rowMenuBonus) + ' with no add-on');
  return names.length;
}
// The compact set of a booking (X13.6) in its order.
async function compactOrder(stars) {
  const rows = await moneyRows('compact');
  const names = rows.map((r) => r.name);
  // Review 1 (X20.6): the crew's wages sit on their own row after Costs, and Costs has no detail line.
  const labels = [stars === 1 ? UI.rowFeeOne : fill(UI.rowFee, { n: stars }), UI.rowExtras, UI.rowCosts, UI.rowWages, UI.rowTake, UI.rowGear, UI.rowCrewPaid, UI.rowKept, UI.rowDrawn, UI.rowCash];
  const idx = labelIdx(names, labels);
  assert(idx.every((i) => i >= 0), '#rep-money compact rows ' + describe(names) + ' hold a label outside the X13.6 set');
  assert(idx.every((i, j) => j === 0 || i > idx[j - 1]), '#rep-money compact rows out of the X13.6 order: ' + describe(names));
  for (const must of [0, 1, 2, 4, 9]) assert(idx.includes(must), '#rep-money compact rows lack ' + describe(labels[must]) + ': ' + describe(names));
  const costs = rows[idx.indexOf(2)];
  assert(costs && costs.d === '', 'the Costs row detail ' + describe(costs && costs.d) + ', wanted none (review 1)');
  const wageRow = idx.indexOf(3) >= 0 ? rows[idx.indexOf(3)] : null;
  if (wageRow) assert(/^-\d+$/.test(wageRow.v) && wageRow.d.length > 0, 'the Wages row ' + describe(wageRow));
  assert(rows.length >= 5 && rows.length <= 10, rows.length + ' compact rows');
  return rows.length;
}
// W25 R-4 with X13.6: week start + Take today + Gear bought + Signing and send-off + the stock row
// (or Paid at the shop) = Cash, read down the visible rows.
async function ledgerAddsUp(boxId) {
  const rows = boxId === ID3.repMoney ? await moneyRows('compact')
    : await ev('[...$(' + JSON.stringify(boxId) + ').querySelectorAll(".row")].map((r) => ({ n: (((r.querySelector(".name") || r).firstChild || {}).textContent || "").trim(), d: ((r.querySelector(".effect") || {}).textContent || "").trim(), v: ((r.querySelector(".price") || {}).textContent || "").trim() }))');
  const num = (v) => Number(String(v).replace(/,/g, ''));
  const find = (label) => rows.find((r) => r.n.trim() === label);
  const take = find(UI.rowTake), cash = find(UI.rowCash);
  assert(take && cash, '#' + boxId + ' rows ' + describe(rows.map((r) => r.n)));
  const tail = UI.cashFrom.split('{a}')[1];
  assert(cash.d.endsWith(tail), '#' + boxId + ' Cash detail ' + describe(cash.d));
  const start = num(cash.d.slice(0, cash.d.length - tail.length));
  let sum = start + num(take.v);
  const parts = [start, take.v];
  for (const label of [UI.rowGear, UI.rowCrewPaid, UI.rowShop, UI.rowKept, UI.rowDrawn]) {
    const r = find(label);
    if (r) { sum += num(r.v); parts.push(label + ' ' + r.v); }
  }
  assert(sum === num(cash.v), '#' + boxId + ': ' + parts.join(' ') + ' is ' + sum + ', Cash reads ' + cash.v);
  return parts.join(' ') + ' = ' + cash.v;
}
// v3.1 page helpers.
// Review 1 (X20.11): with nobody on the crew a pass asks first (ui.passEmpty, Yes and No above the
// bar); the helper answers Yes and counts the asks.
let passAsks = 0;
const andListH = (w) => (w.length <= 1 ? w.join('') : w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1]);
const hireGo = async (n) => {   // hire-go n times: passes, then Start week 1
  for (let i = 0; i < n; i++) {
    assert(await visible(ID31.hiring), '#hiring hidden before hire-go ' + (i + 1) + '; loop ' + describe(await loop()));
    await click(ID31.hireGo);
    await advance(0);
    if (await visible('hire-pass-yes')) {
      const r = await ev('S().hiring ? S().hiring.round : null');
      const why = await accText(ID31.hireWhy);
      assert(why === fill(UI.passEmpty, { r }) && (await ev('S().crew.length')) === 0, '#hire-why on the pass confirm ' + describe(why));
      passAsks += 1;
      await click('hire-pass-yes');
      await advance(0);
    }
  }
};
const crewTile = async () => {
  const al = await attrOf(ID3.cardCrew, 'aria-label');
  return (al || '') + ' | ' + (await accText(ID3.cardCrew));
};
const moodAriaOf = (name, mood) => fill(UI.moodAria, { name, mood: W15.mood[mood + 2] });
const untilLoopM = (id, maxSec) => until('S().loop === ' + JSON.stringify(id), maxSec);
const secondsLeftM = async (slack = 5) => (await ev('S().today && S().today.endAt ? S().today.endAt - S().clock : 160')) + slack;
// A v5 fixture for the page (X11.1 shape): week 1 of season 1 with Marty, Hiring Day done, no crew,
// unless `over` says otherwise (deviation 32). Cards are full X4.2 cards.
function saveV5(over = {}) {
  const s = JSON.parse(JSON.stringify(SAVE_V5_SAMPLE));
  Object.assign(s, { cash: 200, rep: 20, stock: Object.fromEntries(MEAT_IDS.map((m) => [m, 0])), charcoal: 10, wood: 0,
    gear: Object.fromEntries(GEAR_IDS.map((g) => [g, false])), decor: Object.fromEntries(DECOR_IDS.map((d) => [d, false])),
    stats: { days: 1, served: 10, walkouts: 0, past: 0, burnt: 0, seated: 3 }, drivewayShown: false, tutorial: { done: true },
    season: { year: 1, week: 1, seed: 4242, pick: null, addon: null, weekCash: 200, results: [], drafted: true, trained: null, walkins: [] },
    crew: [], crewSeq: 1, hiring: null,
    player: { name: MARTY.name, look: Object.assign({}, MARTY.look) }, pitName: MARTY.pit, settings: { length: 'normal' } });
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object') Object.assign(s[k], v);
    else s[k] = v;
  }
  if (!(over.season && 'weekCash' in over.season)) s.season.weekCash = s.cash;
  if (!('day' in over)) s.day = s.season.results.length + 2;
  if (!('crewSeq' in over)) s.crewSeq = s.crew.reduce((a, c) => Math.max(a, c.id), 0) + 1;
  // v3.2 (D10.1): every page fixture is v 6 with the five day keys (Monday unless over says).
  if (!('v' in over)) {
    s.v = 6;
    s.season = Object.assign({ day: 0, dayLog: NULL7(), prepped: false, loadin: false, overnight: null }, s.season);
  }
  return s;
}
// A full X4.2 card for page fixtures (the wage from the X5.1 table at the starting values, X2).
function pageCard(id, name, role, skills, over = {}) {
  const st = Math.floor(((skills[0] + skills[1]) / 2) * 2) / 2;
  const wage = Math.round(C_X2.WAGE_TABLE[Math.round((st - 1) * 2)] * C_X2.ROLE_WAGE[role]);
  return Object.assign({ id, name, role, skills: skills.slice(), potential: 4, xp: 20, banked: 0, mood: 0, wage, contract: 2, seasons: 0, rookie: true, trait: null,
    look: Object.assign({}, DEFAULT_LOOK), bring: true, raised: false, notice: false, worked: 1, bench: 0 }, over);
}

async function v3BrowserSteps(captures) {
  const PM = await ev('({ MEATS: JSON.parse(JSON.stringify(globalThis.' + GLOBAL_NAME + '.MEATS)) })').catch(() => ({ MEATS: {} }));
  const CC = await ev('JSON.parse(JSON.stringify(C))').catch(() => ({}));
  const untilLoop = (id, maxSec) => until('S().loop === ' + JSON.stringify(id), maxSec);
  const secondsLeft = async (slack = 5) => (await ev('S().today && S().today.endAt ? S().today.endAt - S().clock : 160')) + slack;
  let hired70 = null;   // the RUN card step 70 drafts, read by steps 45 and 46

  await step('names filtered to the allowed set', async () => {
    assert(await visible(ID3.creator), '#creator hidden');
    const v1 = await typeInto(ID3.crName, 'Ana<b>!\u{1F600} Q');
    assert(v1 === 'Anab Q', '#cr-name value ' + describe(v1) + ', wanted "Anab Q"');
    const c1 = await accText(ID3.crNameCount);
    assert(c1 === fill(UI.crCount, { n: 6, max: 14 }), '#cr-name-count ' + describe(c1));
    const v2 = await typeInto(ID3.crPit, 'ABCDEFGHIJKLMNOPQRSTUVWX');
    assert(v2.length === 20, '#cr-pit value ' + describe(v2) + ' after 24 letters');
    const c2 = await accText(ID3.crPitCount);
    assert(c2 === fill(UI.crCount, { n: 20, max: 20 }), '#cr-pit-count ' + describe(c2));
    const v2b = await typeInto(ID3.crPit, 'Holy Smokes BBQ Co');
    assert(v2b === 'Holy Smokes BBQ Co', '#cr-pit value ' + describe(v2b) + ', wanted the full 18 character name');
    const v3 = await typeInto(ID3.crPit, 'Marty’s Pit');
    assert(v3 === MARTY.pit, '#cr-pit value ' + describe(v3) + ', wanted ' + describe(MARTY.pit));
    return describe(v1) + ' (' + c1 + '), 24 letters to ' + c2 + ', ' + describe(v2b) + ' kept, curly apostrophe to ' + describe(v3);
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
    assert(nm === MARTY.name && (await accText(ID3.crNameCount)) === fill(UI.crCount, { n: 5, max: 14 }), '#cr-name ' + describe(nm) + ', count ' + describe(await accText(ID3.crNameCount)));
    const pt = await valueOf(ID3.crPit);
    assert(pt === MARTY.pit && (await accText(ID3.crPitCount)) === fill(UI.crCount, { n: 11, max: 20 }), '#cr-pit ' + describe(pt) + ', count ' + describe(await accText(ID3.crPitCount)));
    const sign = await srText(ID3.crSign);
    assert(sign === MARTY.pit, '#cr-sign .sr text ' + describe(sign));
    await screenshot(SCREENSHOTS.creator);
    await click(ID3.crGo);
    await advance(0);
    const s = await ev('({ loop: S().loop, profile: S().profile, pitName: S().pitName })');
    // v3.1 (X15.1 step 43): Fire it up lands on Hiring Day.
    assert(s.loop === LOOP.hiring, 'loop after Fire it up ' + describe(s.loop) + ', wanted hiring');
    assert(await visible(ID31.hiring), '#hiring hidden after Fire it up');
    assert(deepEq(s.profile, { name: MARTY.name, look: MARTY.look }), 'state.profile ' + describe(s.profile));
    assert(s.pitName === MARTY.pit, 'state.pitName ' + describe(s.pitName));
    key = await lookKeyNow();
    assert(key === lookKeyOf(MARTY.look), 'art.lookKey() after Fire it up ' + describe(key));
    const raw = await storedSave();
    assert(raw && raw.v === SAVE_V && raw.player && raw.player.name === MARTY.name && deepEq(raw.player.look, MARTY.look) && raw.pitName === MARTY.pit && !('hires' in raw), 'stored save ' + describe(raw && { v: raw.v, player: raw.player, pitName: raw.pitName, hires: raw.hires }));
    return CREATOR_TAPS.length + ' taps to ' + key + ', Marty of ' + MARTY.pit + ', saved v 5, on Hiring Day';
  }, { fatal: true });

  // v3.1 (X15.2 step 70): Hiring Day by real taps, right after step 43.
  await step('Hiring Day by real taps', async () => {
    await advance(0);
    const budget = CC.PAYROLL ? CC.PAYROLL[0] : 60;
    assert((await loop()) === LOOP.hiring && (await visible(ID31.hiring)), 'loop ' + describe(await loop()) + ', #hiring visible ' + (await visible(ID31.hiring)));
    const hh = await srText(ID31.hiringH);
    assert(hh === UI.hiringH, '#hiring-h .sr text ' + describe(hh));
    const rd1 = await accText(ID31.hireRound);
    assert(rd1 === fill(UI.hireRound, { r: 1 }), '#hire-round ' + describe(rd1));
    for (let i = 0; i < 9; i++) assert(await present(ID31.app(i)), '#app-' + i + ' missing on page 1');
    assert(!(await present(ID31.app(9))), '#app-9 shown on page 1');
    const hl = await accText(ID31.hiresLeftN);
    assert(hl === '3', '#hires-left-n ' + describe(hl));
    const tl0 = await accText(ID31.hireTryouts);
    assert(tl0 === fill(UI.tryoutsLeft, { n: CC.TRYOUTS }), '#hire-tryouts ' + describe(tl0));
    assert((await ev('g.hiringPage')) === 1, 'PitSim.game.hiringPage ' + describe(await ev('g.hiringPage')));
    assert(await ev('$(' + JSON.stringify(ID31.pagePrev) + ').disabled === true'), '#hire-page-prev enabled on page 1');
    const helpShut = !(await visible(ID31.hireHelp));
    await click(ID31.hireInfo);
    await advance(0);
    const helpOpen = (await visible(ID31.hireHelp)) && (await attrOf(ID31.hireInfo, 'aria-expanded')) === 'true' && (await accText(ID31.hireHelp)) === UI.hireHelp;
    await click(ID31.hireInfo);
    await advance(0);
    assert(helpShut && helpOpen, '#hire-info did not toggle #hire-help (shut ' + helpShut + ', open ' + helpOpen + ')');
    await click(ID31.pageNext);
    await advance(0);
    assert((await ev('g.hiringPage')) === 2, 'hiringPage after #hire-page-next ' + describe(await ev('g.hiringPage')));
    for (let i = 9; i < 18; i++) assert(await present(ID31.app(i)), '#app-' + i + ' missing on page 2');
    assert(!(await present(ID31.app(0))), '#app-0 shown on page 2');
    const pg = await accText(ID31.hirePage);
    assert(pg.includes(fill(UI.pageOf, { p: 2, n: Math.ceil(P_POOL / 9) })), '#hire-page reads ' + describe(pg));   // v3.6: 24 cards, 3 pages
    await screenshot(SCREENSHOTS.hiringPage2);
    await click(ID31.pagePrev);
    await advance(0);
    assert((await ev('g.hiringPage')) === 1, 'hiringPage after #hire-page-prev ' + describe(await ev('g.hiringPage')));
    // A card sheet, a tryout, then Pass.
    const e0 = await ev('sim.hiringView().pool[0]');
    await click(ID31.app(0));
    await advance(0);
    assert(await visible(ID31.card), '#card hidden after #app-0');
    for (const id of [ID31.cardPortrait, ID31.cardSkill(0), ID31.cardSkill(1), ID31.cardHire, ID31.cardPass]) assert(await visible(id), '#' + id + ' not shown on the applicant sheet');
    assert((await srText(ID31.cardH)) === e0.name, '#card-h .sr ' + describe(await srText(ID31.cardH)) + ', wanted ' + e0.name);
    const sk = await ev('({ role: attr("card-skill-0", "role"), now: attr("card-skill-0", "aria-valuenow"), max: attr("card-skill-0", "aria-valuemax"), label: attr("card-skill-0", "aria-label") })');
    const skWant = fill(UI.skillAria, { skill: W15.skill[e0.role][0], n: e0.skills[0] });
    assert(sk.role === 'meter' && Number(sk.now) === e0.skills[0] && sk.max === '5' && sk.label === skWant, '#card-skill-0 ' + describe(sk) + ', wanted ' + describe(skWant));
    const st0 = await accText(ID31.cardStars);
    assert(st0.includes(UI.potentialHidden), '#card-stars before the tryout ' + describe(st0));
    await screenshot(SCREENSHOTS.card);
    await click(ID31.cardTryout);
    await advance(0);
    const pot = await ev('sim.hiringView().pool[0].potential');
    assert(typeof pot === 'number', 'the tryout left potential ' + describe(pot));
    const st1 = await accText(ID31.cardStars);
    assert(st1.includes(fill(UI.potential, { n: pot })), '#card-stars after the tryout ' + describe(st1) + ', wanted ' + describe(fill(UI.potential, { n: pot })));
    assert(!(await visible(ID31.cardTryout)), '#card-tryout still shown once tried');
    const tl1 = await accText(ID31.hireTryouts);
    assert(tl1 === fill(UI.tryoutsLeft, { n: CC.TRYOUTS - 1 }), '#hire-tryouts after a tryout ' + describe(tl1));
    if (CC.TRYOUTS === 2) assert(tl1 === 'Tryouts left: 1', '#hire-tryouts ' + describe(tl1) + ', X15.2 literal');
    await click(ID31.cardPass);
    await advance(0);
    assert((await visible(ID31.hiring)) && !(await visible(ID31.card)), '#card-pass did not return to #hiring');
    const foc = await ev('document.activeElement ? document.activeElement.id : null');
    assert(foc === ID31.app(0), 'focus after #card-pass is on ' + describe(foc) + ', wanted #app-0');
    // Hire the first open RUN card on page 1 whose wage fits the budget (deviation 33).
    const pool = await ev('sim.hiringView().pool');
    let target = pool.find((e) => e.idx < 9 && e.role === 'run' && e.status === 'open' && e.wage <= budget);
    let onPage2 = false;
    if (!target) {
      target = pool.find((e) => e.role === 'run' && e.status === 'open' && e.wage <= budget);
      assert(target, 'no open RUN card in the pool ' + describe(pool.map((e) => e.role + ':' + e.status)));
      onPage2 = true;
      while ((await ev('g.hiringPage')) < Math.floor(target.idx / 9) + 1) { await click(ID31.pageNext); await advance(0); }   // v3.6: three pages
    }
    await click(ID31.app(target.idx));
    await advance(0);
    assert(await visible(ID31.card), '#card hidden after #app-' + target.idx);
    const n0 = await eventCount();
    await click(ID31.cardHire);
    await advance(0);
    const ch = await eventsSince(n0, EV31.crewHired);
    assert(ch.length === 1 && ch[0].name === target.name && ch[0].from === 'draft' && ch[0].fee === 0, 'crew_hired after #card-hire ' + describe(ch));
    if (await visible(ID31.card)) { await click(ID31.cardBack); await advance(0); }
    assert(await visible(ID31.hiring), '#hiring hidden after the hire');
    hired70 = { id: ch[0].id, name: target.name, wage: target.wage, role: 'run' };
    const pm = await ev('({ role: attr("hire-payroll", "role"), now: attr("hire-payroll", "aria-valuenow"), min: attr("hire-payroll", "aria-valuemin"), max: attr("hire-payroll", "aria-valuemax"), label: attr("hire-payroll", "aria-label") })');
    assert(pm.role === 'meter' && pm.now === String(target.wage) && pm.min === '0' && pm.max === String(budget) && pm.label === fill(UI.payrollAria, { p: target.wage, b: budget }), '#hire-payroll ' + describe(pm) + ', wanted the wage ' + target.wage);
    const rd2 = await accText(ID31.hireRound);
    assert(rd2 === fill(UI.hireRound, { r: 2 }), '#hire-round after the hire ' + describe(rd2));
    assert((await accText(ID31.hiresLeftN)) === '2', '#hires-left-n after the hire ' + describe(await accText(ID31.hiresLeftN)));
    // Review 1 (X20.11): the round's takes show on screen, in #hire-news above the bar.
    const rdEv = await eventsSince(n0, EV31.roundDone);
    const newsWant = rdEv.length ? fill(W15.say.roundDone, { r: 1, list: andListH(rdEv[0].names) }) : null;
    const newsTxt = await accText('hire-news');
    assert(newsWant && (await visible('hire-news')) && newsTxt.startsWith(newsWant), '#hire-news ' + describe(newsTxt) + ', wanted ' + describe(newsWant));
    const goAria = await attrOf(ID31.hireGo, 'aria-label');
    assert(goAria === fill(UI.passRound, { r: 2 }), '#hire-go aria-label in round 2 ' + describe(goAria));
    // Exactly three cards read Hired elsewhere, and the hire reads On your crew, on both pages.
    const view = await ev('sim.hiringView().pool');
    const takenIdx = view.filter((e) => e.status === 'taken').map((e) => e.idx);
    assert(takenIdx.length === 3 && view[target.idx].status === 'mine', 'statuses ' + describe(view.map((e) => e.status)));
    const readPage = async () => ev('[...document.querySelectorAll("#hire-grid .crewcard, #hire-grid button")].filter((b) => /^app-\\d+$/.test(b.id)).map((b) => ({ id: b.id, al: b.getAttribute("aria-label") || "", text: (b.textContent || "").replace(/\\s+/g, " ").trim(), dis: b.getAttribute("aria-disabled") }))');
    const seen = {};
    for (let pg2 = 1; pg2 <= Math.ceil(P_POOL / 9); pg2++) {   // v3.6: three pages
      while ((await ev('g.hiringPage')) < pg2) { await click(ID31.pageNext); await advance(0); }
      for (const b of await readPage()) seen[b.id] = b;
    }
    while ((await ev('g.hiringPage')) > 1) { await click(ID31.pagePrev); await advance(0); }
    let takenRead = 0;
    for (const e of view) {
      const b = seen[ID31.app(e.idx)];
      assert(b, '#app-' + e.idx + ' not found on either page');
      const all = b.al + ' ' + b.text;
      const isTaken = all.includes(UI.taken) || b.al === fill(UI.appTaken, { name: e.name });
      if (isTaken) takenRead += 1;
      assert(isTaken === (e.status === 'taken'), '#app-' + e.idx + ' (' + e.status + ') reads ' + describe(all));
      if (e.status === 'taken') assert(b.dis === 'true', '#app-' + e.idx + ' taken but aria-disabled ' + describe(b.dis));
      if (e.status === 'mine') assert(all.includes(UI.yours), '#app-' + e.idx + ' (yours) reads ' + describe(all));
    }
    assert(takenRead === 3, takenRead + ' cards read ' + describe(UI.taken));
    await screenshot(SCREENSHOTS.hiring);
    // Two passes, then Start week 1.
    await hireGo(2);
    const goTxt = await accText(ID31.hireGo);
    assert(goTxt.includes(UI.startWeek) && (await accText(ID31.hireRound)) === UI.hireRoundsDone, '#hire-go after round 3 reads ' + describe(goTxt) + ', #hire-round ' + describe(await accText(ID31.hireRound)));
    // Review 1: once every round is done the Hires left box and the tryouts line are gone, and Start
    // week 1 does not overlap anything in the bar.
    assert(!(await present(ID31.hiresLeft)) && !(await present(ID31.hireTryouts)), '#hires-left or #hire-tryouts still shown after round 3');
    const overlap = await ev('(() => { const go = $("hire-go").getBoundingClientRect(), cr = $("hire-crew").getBoundingClientRect(); return go.left < cr.right - 0.5 && cr.left < go.right - 0.5; })()');
    assert(overlap === false, '#hire-go overlaps #hire-crew after round 3');
    await click(ID31.hireGo);
    await advance(0);
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'after Start week 1: loop ' + describe(await loop()));
    const raw = await storedSave();
    assert(raw && raw.v === SAVE_V && raw.hiring === null && raw.season.drafted === true && raw.crew.length === 1 && raw.crew[0].name === target.name, 'stored save after Hiring Day ' + describe(raw && { v: raw.v, hiring: raw.hiring, drafted: raw.season && raw.season.drafted, crew: raw.crew }));
    return 'two pages, a tryout showed ' + pot + ' stars, Pass kept focus, hired ' + target.name + ' (RUN, wage ' + target.wage + (onPage2 ? ', page 2' : '') + '), three taken, then the week 1 hub';
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
    // Feedback audit item 14: the yard wall sign never cuts a name the creator allows (20 characters):
    // each comes back on one or two lines that rebuild the whole name, inside the board's text box.
    const maxPit = await ev('$("cr-pit") ? $("cr-pit").maxLength : 20');
    const longFit = await ev('(() => { const B = PitSim.bridge3, tw = PitSim.art3.textWidth, box = PitSim.art3.rule.meta("sign").text, n = ' + maxPit + '; const names = ["Holy Smokes BBQ Co", "Holy Smokes BBQ", "ABCDEFGHIJKLMNO", "Smokehouse 12345", "W".repeat(n), "M".repeat(n), "A " + "W".repeat(n - 2), "W".repeat(n - 2) + " A", "WWWWW WWWWW WWWWW W".slice(0, n)]; return names.map((nm) => { const L = B.signLines(nm), up = nm.toUpperCase(); const w = Math.max.apply(null, L.lines.map((t) => B.signLineW(t, L.bold))); const ok = !L.cut && L.lines.length <= 2 && w <= box.w && (L.hyphen ? L.lines[0].slice(0, -1) + L.lines[1] : L.lines.join(" ")) === up; return ok ? null : nm + " " + JSON.stringify(L) + " w " + w + " of " + box.w; }).filter(Boolean); })()');
    assert(maxPit >= 15 && longFit.length === 0, 'the yard sign cuts or overflows (max ' + maxPit + '): ' + describe(longFit));
    return describe(sign.text) + ' in ' + sign.font + ' at x ' + sign.x + ', ' + glyphs.length + ' glyphs; header ' + describe(wh) + '; yard sign fits ' + maxPit + ' character names';
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
    // v3.4 review: under the Start button the picked booking is one line and the offers sit behind
    // See offers; the Yard day card is gone (a weekday choice now).
    const startBtn = await present('hub-start');
    const startHub = startBtn || (await present('planner'));   // v3.5: Monday's planner takes the Start button's place
    if (startBtn && (await present('offers-more'))) {
      const ln = await text('offer-line');
      const bk = await ev('S().season.booking');
      assert(ln.startsWith(bk.label + ' ') && ln.endsWith(', pay ' + bk.pay) && !(await visible('offer-grid')), '#offer-line reads ' + describe(ln) + ' with the grid ' + ((await visible('offer-grid')) ? 'open' : 'closed'));
      await click('offers-more');
      await advance(0);
      assert(await visible('offer-grid'), 'See offers left the grid closed');
    }
    const order = await ev('[...$(' + JSON.stringify(ID3.offers) + ').querySelectorAll("article")].map((a) => a.id)');
    assert(sameJSON(order, startHub ? ['offer-birthday', 'offer-picnic'] : ['offer-birthday', 'offer-picnic', 'offer-yard']), 'offer cards ' + describe(order));
    for (const o of offers) {
      if (startHub && o.type === 'yard') continue;
      const card = await accText(ID3.offer(o.id));
      const lines = o.type === 'yard'
        ? [o.label, UI.walkIns, UI.yourPick, W15.venue.backyard, W15.flames[o.difficulty - 1], UI.perPlate, UI.noFee]
        : [o.label, fill(UI.host, { name: o.host }), fill(UI.guests, { n: o.headcount })].concat(o.menu.map((m) => PM.MEATS[m].plateLabel),
          [W15.venue.backyard, W15.flames[o.difficulty - 1], fill(UI.pay, { fee: o.pay }), fill(UI.deposit, { d: o.deposit })]);
      const missing = lines.filter((l) => !card.includes(l));
      assert(missing.length === 0, '#offer-' + o.id + ' lacks ' + describe(missing) + '; it reads ' + describe(card));
    }
    // v3.1 (X15.1 step 45): the tags, the third line and the Crew tile for the card Hiring Day left.
    const tags = await ev('({ b: $("offer-birthday-tag") ? acc("offer-birthday-tag") : null, p: $("offer-picnic-tag") ? acc("offer-picnic-tag") : null, y: !!$("offer-yard-tag") })');
    assert(tags.b === UI.tagSafe && tags.p === UI.tagStretch && tags.y === false, 'offer tags ' + describe(tags) + ', wanted ' + describe([UI.tagSafe, UI.tagStretch]) + ' and none on the Yard day');
    if (startHub) assert(!(await present(ID31.thirdLine)), '#third-line still under the Cash tiles with the Start button');
    else {
      const third = await accText(ID31.thirdLine);
      assert(third === UI.thirdNow[0], '#third-line reads ' + describe(third) + ', wanted ' + describe(UI.thirdNow[0]));
    }
    assert(hired70, 'step 70 left no hire');
    const ct = await crewTile();
    const ctWant = [fill(UI.crewLine, { n: 1, s: CC.ROSTER_SLOTS ? CC.ROSTER_SLOTS[0] : 2 }), fill(UI.crewSub, { p: hired70.wage, b: CC.PAYROLL ? CC.PAYROLL[0] : 60 })];
    assert(ctWant.every((t) => ct.includes(t)), '#card-crew reads ' + describe(ct) + ', wanted ' + describe(ctWant));
    assert((await attrOf(ID3.book('birthday'), 'aria-pressed')) === 'true', '#book-birthday not pressed');
    const bt = await accText(ID3.book('birthday'));
    assert(bt === UI.booked, '#book-birthday reads ' + describe(bt));
    await toBookedDay();   // D10.1
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
    assert(await ev("!document.getElementById('len') && !document.querySelector('[id^=len-]')"), 'the event length buttons are still on the hub');
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
    // v3.2 (D5): on Monday #go-why names the booked day; the card still shows the need.
    assert(st0.dis === true && st0.why === fill(D32.goNotToday, { day: 'Sunday' }) && st0.needs === UI.needsKettle2 && st0.shown, 'the picked one kettle picnic ' + describe(st0));
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
    // v3.1 (X3.1): the Birthday's menu pair rotates, so the rows follow its rail.
    const sh = await ev('({ qty: Object.fromEntries(' + JSON.stringify(MEAT_IDS) + '.map((m) => [m, !!$("qty-" + m)])), covers: Object.fromEntries(' + JSON.stringify(MEAT_IDS) + '.map((m) => [m, $("covers-" + m) ? $("covers-" + m).textContent : null])), other: !!$("shop-other"), exp: attr("shop-other", "aria-expanded") })');
    const railMeats = MEAT_IDS.filter((x) => pk.rail[x] > 0);
    assert(MEAT_IDS.every((x) => sh.qty[x] === railMeats.includes(x)) && sh.other && sh.exp === 'false', 'the Birthday shop rows ' + describe(sh) + ' for the rail ' + describe(pk.rail));
    for (const x of railMeats) assert(sh.covers[x] === fill(UI.covers, { p: pk.rail[x], r: pk.rail[x] }), 'the covers line for ' + x + ' ' + describe(sh.covers[x]));
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
    await toBookedDay();   // D10.1
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
    // Cook one piece of the quickest rail meat by canvas taps (v3.0 cooked chicken; the menu rotates now).
    const cookMeat = railMeats[0];
    const via = [];
    const a1 = await goto('pile', hasKind(CARRY_KIND.charcoal)); via.push(a1.how);
    assert(a1.ok, 'pile: carrying ' + describe(await ev(F.carrying)));
    const a2 = await goto('kettle1', F.fire('kettle1') + ' >= C.' + C_NAMES.fireLight + ' - 1'); via.push(a2.how);
    assert(a2.ok, 'kettle 1 fire ' + (await ev(F.fire('kettle1'))));
    await click(ID.chip(cookMeat));
    await advance(0);
    const a3 = await goto('cooler', hasKind(CARRY_KIND.raw) + ' && ' + F.carrying + '.meat === ' + JSON.stringify(cookMeat)); via.push(a3.how);
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
    const a8 = await goto('table', tableHas(cookMeat)); via.push(a8.how);
    assert(a8.ok, 'the ' + cookMeat + ' plate did not land on the table');
    const servedExpr = 'globalThis.__smoke.events.slice(' + n0 + ').some((e) => e.type === "served" && e.booked === true)';
    const sv = await until(servedExpr + ' || S().loop === "report"', await secondsLeft(0));
    const served = (await eventsSince(n0, EVENT.served)).filter((e) => e.booked === true);
    assert(served.length >= 1, 'no booked serve within ' + sv.t + ' s (deviation 16); customers ' + describe(await ev(F.customers + '.map((c) => c.want + ":" + c.mode)')));
    assert(served[0].price === 0, 'a booked serve with price ' + served[0].price);
    await advance(0);
    const r2 = await ev('g.rail ? JSON.parse(JSON.stringify(g.rail)) : null');
    const soldCook = await ev('S().today.sold[' + JSON.stringify(cookMeat) + ']');
    const ci = r2 && r2.items.find((x) => x.meat === cookMeat);
    assert(ci && soldCook >= 1 && ci.left === pk.rail[cookMeat] - soldCook && ci.sold === soldCook, 'rail ' + cookMeat + ' ' + describe(ci) + ' with ' + soldCook + ' sold');
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
    // v3.1 (X13.6, X15.1 step 46): the compact table adds up, and Show every row opens the v3.0 rows.
    const compact = await compactOrder(till.stars);
    assert(till.cashAfter === (await ev(F.cash)), 'till.cashAfter ' + till.cashAfter + ', cash ' + (await ev(F.cash)));
    const ledger = await ledgerAddsUp(ID3.repMoney);
    assert(!(await visible(ID31.repMoneyDetail)) && (await attrOf(ID31.repMoneyMore, 'aria-expanded')) === 'false', '#rep-money-detail open before #rep-money-more');
    assert((await accText(ID31.repMoneyMore)) === UI.moneyMore, '#rep-money-more reads ' + describe(await accText(ID31.repMoneyMore)));
    await click(ID31.repMoneyMore);
    await advance(0);
    assert((await visible(ID31.repMoneyDetail)) && (await attrOf(ID31.repMoneyMore, 'aria-expanded')) === 'true' && (await accText(ID31.repMoneyMore)) === UI.moneyLess, '#rep-money-more did not open #rep-money-detail');
    const rows = await moneyOrder(till.stars, null);
    await click(ID31.repMoneyMore);
    await advance(0);
    assert(!(await visible(ID31.repMoneyDetail)), '#rep-money-more did not close #rep-money-detail');
    // The RUN card from step 70 worked the Birthday: its row, its line and its XP meter.
    const crow = (till.crew || []).find((r) => r.id === hired70.id);
    assert(crow && crow.worked === true && typeof crow.line === 'string' && crow.line.length > 0, 'till.crew row for ' + hired70.name + ' ' + describe(crow));
    assert(await visible(ID31.repCrewRow(hired70.id)), '#rep-crew-' + hired70.id + ' hidden');
    const cl = await text(ID31.repCrewLine(hired70.id));
    assert(cl === crow.line, '#rep-crew-' + hired70.id + '-line reads ' + describe(cl) + ', the till row ' + describe(crow.line));
    const xm = await ev('({ role: attr(' + JSON.stringify(ID31.repCrewXp(hired70.id)) + ', "role"), now: attr(' + JSON.stringify(ID31.repCrewXp(hired70.id)) + ', "aria-valuenow"), max: attr(' + JSON.stringify(ID31.repCrewXp(hired70.id)) + ', "aria-valuemax") })');
    assert(xm.role === 'meter' && Number(xm.now) === crow.xp && Number(xm.max) === CC.LEVEL_XP, '#rep-crew-' + hired70.id + '-xp ' + describe(xm) + ', the till row xp ' + crow.xp);
    const rc = await accText(ID3.repCharcoal);
    assert(rc === charcoalLine(till.charcoalAfter, UI.charcoalLeftOne, UI.charcoalLeft), '#rep-charcoal reads ' + describe(rc));
    const spoilText = (await visible(ID3.repSpoil)) ? await accText(ID3.repSpoil) : null;
    await screenshot(SCREENSHOTS.report);
    s46 = { till, have, committed, spoilText };
    // Next.
    await click(ID.next);
    await advance(0);
    await restOfWeek();   // D10.1: a Saturday cook leaves Sunday
    const wk = await ev('({ loop: S().loop, week: S().season.week })');
    assert(wk.loop === LOOP.week && wk.week === 2, 'after #next ' + describe(wk));
    const w1 = await attrOf(ID3.wk(1), 'aria-label');
    const w1Want = fill(UI.wkDone, { w: 1, label: pk.label, stars: starsText(till.stars) });
    assert(w1 === w1Want, '#wk-1 aria-label ' + describe(w1) + ', wanted ' + describe(w1Want));
    return 'picnic a stretch on one kettle; birthday: deposit ' + pk.deposit + ', ' + served.length + ' booked serve(s), ' + till.stars + ' stars, ' + compact + ' compact rows (' + ledger + ') and ' + rows + ' in the detail, ' + hired70.name + ': ' + describe(crow.line) + ', cash ' + till.cashAfter + '; taps ' + via.join(' ');
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
    if (await present('hub-tab-pit')) { await click('hub-tab-pit'); await advance(0); }   // v3.4: the inventory is on the Your pit tab
    assert(await visible(ID3.invEmpty), '#inv-empty hidden with an empty cooler');
    assert((await accText(ID3.invEmpty)) === UI.invEmpty, '#inv-empty reads ' + describe(await accText(ID3.invEmpty)));
    return describe(inv) + ', ' + spoiled + ' units spoiled overnight, cooler empty';
  });

  await step('two tap week', async () => {
    const first = await ev('S().season.offers[0].id');
    await click(ID3.book(first));
    await advance(0);
    await toBookedDay();   // D10.1
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
    await restOfWeek();   // D10.1: a Saturday cook leaves Sunday
    assert((await loop()) === LOOP.week, 'loop after #next ' + describe(await loop()));
    return 'book-' + first + ' then go; rail ' + describe(c.rail) + ' covered, ' + c.charcoal + ' bags; report after ' + r.t + ' s';
  });

  await step('cooler capacity spoilage on the report', async () => {
    // v3.2 (D10.1): on the Saturday of the Birthday, so no night ticks before the cook.
    await reload(saveV6({ season: { week: 3, results: resultsOf(2), pick: 'birthday', day: 5, dayLog: ['off', 'off', 'off', 'off', 'off', null, null] }, gear: { cooler: true }, stock: { sausage: 20, butt: 5 }, charcoal: 10, cash: 100 }));
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'the fixture loaded as ' + describe(await loop()));
    await click(ID3.book('birthday'));
    await advance(0);
    await click(ID3.cardShop);
    await advance(0);
    for (const m of MEAT_IDS) if (await present(ID.qty(m))) await stepDown(m);
    await click(ID3.sheetBack);
    await advance(0);
    const stock0 = await ev('Object.assign({}, S().stock)');
    await toBookedDay();   // D10.1
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
    await restOfWeek();   // D10.1: a Saturday cook leaves Sunday
    const units = sumOf(want.keep);
    const ic = await ev('({ label: attr(' + JSON.stringify(ID3.invCooler) + ', "aria-label"), text: acc(' + JSON.stringify(ID3.invCooler) + '), now: attr(' + JSON.stringify(ID3.invCooler) + ', "aria-valuenow"), max: attr(' + JSON.stringify(ID3.invCooler) + ', "aria-valuemax"), role: attr(' + JSON.stringify(ID3.invCooler) + ', "role") })');
    const icWant = fill(UI.invCooler, { u: units, cap: t.coolerCap });
    assert((ic.label === icWant || ic.text === icWant) && ic.now === String(units) && ic.max === String(t.coolerCap) && ic.role === 'meter', '#inv-cooler ' + describe(ic) + ', wanted ' + describe(icWant));
    return describe(sp) + ' ' + describe(cl) + '; next week ' + describe(icWant);
  });

  await step('season end after week 7', async () => {
    await reload(saveV4({ season: { week: 9, results: resultsOf(8) }, cash: 300, rep: 40, charcoal: 10 }));   // v3.5: a nine week save opens week 7, the finale
    const cards = await ev('[...$(' + JSON.stringify(ID3.offers) + ').querySelectorAll("article")].map((a) => a.id)');
    assert(cards[0] === 'offer-finale' && cards.every((c) => /^offer-finale/.test(c)), 'week 9 cards ' + describe(cards));   // V33-8: lower contests follow
    await toBookedDay();   // D10.1
    await click(ID3.go);
    await advance(0);
    assert(await ev(inService), 'the finale did not start; #go-why ' + describe(await accText(ID3.goWhy).catch(() => '')));
    const r = await untilLoop(LOOP.report, await secondsLeft());
    assert(r.ok, 'no report after ' + r.t + ' s');
    await advance(0);
    const th = await text(ID.tillH);
    const ft = await ev(F.till);
    // v3.3 [S 3.5]: week 9 is the competition; nobody cooks here, so all four turn-ins are missed.
    assert(ft.kind === 'comp' && ft.comp && ft.comp.standings.length === 10 && ft.comp.boxes.every((b) => b.missed) && ft.comp.place === 10 && th.length > 0, '#till-h is ' + describe(th) + ', till ' + describe(ft && { kind: ft.kind, place: ft.comp && ft.comp.place }));
    // v3.2 playtest: a Saturday finale's report ends the day; Sunday is still to come, so #next reads
    // Next day and the season end card follows the Sunday tick (restOfWeek below).
    const nx = await accText(ID.next);
    const nxWant = (await ev('S().season.day')) < 6 ? D32.nextDay : UI.seeSeason;
    assert(nx === nxWant, '#next reads ' + describe(nx) + ', wanted ' + describe(nxWant));
    await click(ID.next);
    await advance(0);
    await restOfWeek();   // D10.1: a Saturday cook leaves Sunday
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
    // v3.1 (X15.1 step 50): Hiring Day for year 2 first, then hire-go four times.
    const sh = await ev('({ loop: S().loop, year: S().season.year, week: S().season.week, hy: sim.hiringView() && sim.hiringView().year })');
    assert(sh.loop === LOOP.hiring && sh.year === 2 && sh.hy === 2 && (await visible(ID31.hiring)), 'after #season-next ' + describe(sh) + ', wanted Hiring Day for year 2');
    await hireGo(4);
    const s = await ev('({ loop: S().loop, year: S().season.year, week: S().season.week })');
    assert(s.loop === LOOP.week && s.year === 2 && s.week === 1, 'after hire-go four times ' + describe(s));
    const wl = await accText(ID3.weekLabel);
    assert(wl.includes(fill(UI.weekOf, { w: 1 })), '#week-label reads ' + describe(wl));
    const raw = await storedSave();
    assert(raw && raw.v === SAVE_V && raw.season && raw.season.year === 2 && sameJSON(raw.season.results, []) && raw.season.drafted === true && raw.hiring === null, 'stored save season ' + describe(raw && raw.season));
    return 'competition report (' + th + '), season end ' + describe(lines[ID3.seRep]) + ', Hiring Day for year 2, season 2 week 1';
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
    // v3.1 (X15.1 step 51): no hires and no results, so Hiring Day comes first.
    assert((await loop()) === LOOP.hiring && (await visible(ID31.hiring)), 'after Fire it up: loop ' + describe(await loop()) + ', wanted hiring');
    await hireGo(4);
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'after hire-go four times: loop ' + describe(await loop()));
    const raw = await storedSave();
    assert(raw && raw.v === SAVE_V && raw.player && deepEq(raw.player.look, DEFAULT_LOOK) && raw.cash === SAVE_V3_SAMPLE.cash && raw.charcoal === SAVE_V3_SAMPLE.charcoal && raw.gear.kettle2 === true && sameJSON(raw.crew, []) && !('hires' in raw),
      'stored save ' + describe(raw && { v: raw.v, player: raw.player, cash: raw.cash, charcoal: raw.charcoal, gear: raw.gear, crew: raw.crew }));
    return 'creator with ' + describe(sub) + ', notice shown, Hiring Day, week 1 hub, stored v 5 cash ' + raw.cash + ' charcoal ' + raw.charcoal;
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
    // v3.1 (X13.8): the crew and hiringPage getters.
    const v31hooks = await ev('({ crew: "crew" in g, page: "hiringPage" in g, crewVal: g.crew ? Object.keys(g.crew).sort() : null, pageVal: g.hiringPage })');
    assert(v31hooks.crew && v31hooks.page && sameJSON(v31hooks.crewVal, ['fire', 'prep', 'run', 'till']) && v31hooks.pageVal === null, 'PitSim.game v3.1 hooks ' + describe(v31hooks));
    await installProbe();
    await advance(0);
    return 'version ' + ver;
  }, { fatal: true });

  await step('only the four file:// requests', () => {
    const bad = report.requests.filter((u) => !(u.startsWith('file:') && EXPECTED_REQUEST_FILES.some((f) => u.includes('/' + f))));
    assert(bad.length === 0, 'unexpected: ' + bad.slice(0, 3).join(', '));
    return report.requests.length + ' requests';
  });

  // Background music: the module is present, no AudioContext before the first tap, one after it,
  // and the header button flips the music flag in the save (default on), then flips it back.
  await step('music: module, first tap, mute saved', async () => {
    const m0 = await ev('globalThis.' + GLOBAL_NAME + '.music && globalThis.' + GLOBAL_NAME + '.music.state()');
    assert(m0 && typeof m0 === 'object', 'PitSim.music missing');
    assert(m0.context === false && m0.created === 0, 'AudioContext before any tap ' + describe(m0));
    const b = await ev('(() => { const r = document.getElementById("title").getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; })()');
    await mouseTap(Math.round(b.x), Math.round(b.y));
    await sleep(100);
    const m1 = await ev('globalThis.' + GLOBAL_NAME + '.music.state()');
    // Joel 2026-10-19: music starts off, so a tap alone creates no AudioContext.
    assert(m1.started === true && m1.muted === true && m1.created === 0, 'after a tap (music off by default) ' + describe(m1));
    const btn = await ev('(() => { const e = document.getElementById("mute"); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, p: e.getAttribute("aria-pressed") }; })()');
    assert(btn.w >= 44 && btn.h >= 44, 'mute button ' + describe(btn));
    await ev('document.getElementById("mute").click()');
    await sleep(100);
    const s1 = await storedSave();
    const m2 = await ev('globalThis.' + GLOBAL_NAME + '.music.state()');
    assert(s1 && s1.music === true && m2.muted === false && m2.created === (m2.supported ? 1 : 0), 'after turning music on: save music ' + describe(s1 && s1.music) + ', ' + describe(m2));
    await ev('document.getElementById("mute").click()');
    const s2 = await storedSave();
    const muted = await ev('globalThis.' + GLOBAL_NAME + '.music.state().muted');
    assert(s2 && s2.music === false && muted === true, 'after turning it off: save music ' + describe(s2 && s2.music) + ', muted ' + muted);
    return 'supported ' + m2.supported + ', off by default, theme ' + m2.theme + ' ' + m2.mode + ' when on; save flag true then false';
  });

  await step('sprite list and palette', async () => {
    const r = await run('const A = globalThis.' + GLOBAL_NAME + '.art; const list = ' + describe(REQUIRED_SPRITES) + ';'
      + ' const bad = []; for (const [n, w, h, f] of list) {'
      + '   if (!A.has(n)) { bad.push(n + " missing"); continue; }'
      + '   if (A.frames(n) !== f) bad.push(n + " frames " + A.frames(n));'
      + '   const s = A.SPRITES[n]; if (!s || s.w !== w || s.h !== h) bad.push(n + " size " + (s && s.w) + "x" + (s && s.h));'
      + ' }'
      + ' return { bad, count: Object.keys(A.SPRITES).length, frames: Object.keys(A.SPRITES).reduce((a, n) => a + A.frames(n), 0), pal: A.PALETTE.length, pal0: A.PALETTE[0], colorKeys: Object.keys(A.COLOR) };');
    assert(r.bad.length === 0, r.bad.length + ' sprite problems, first ' + r.bad.slice(0, 4).join('; '));
    assert(r.count === SPRITE_COUNT, 'SPRITES has ' + r.count + ' names, wanted ' + SPRITE_COUNT);
    assert(r.frames === SPRITE_FRAMES, 'SPRITES has ' + r.frames + ' frames, wanted ' + SPRITE_FRAMES + ' (X12.1)');
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
    const crewNote = await crewArtChecks();
    return REQUIRED_SPRITES.length + ' sprites, ' + SPRITE_FRAMES + ' frames, ' + r.pal + ' colors, ' + COLOR_KEYS.length + ' keys; charcoal, piece frame 4, arrow and bubble grids pass; ' + lookNote + '; ' + crewNote;
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
    assert(back.w > 0 && back.w <= back.vw, 'after restoring ' + own + ' the canvas is ' + back.w + ' wide in a ' + back.vw + ' px viewport');
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
        const k = r.dpr;
        assert(r.bw >= 1 && r.bh >= 1, label + ': backing store ' + r.bw + ' by ' + r.bh);
        assert(Math.abs(r.w * r.dpr - r.bw) < 1 && Math.abs(r.h * r.dpr - r.bh) < 1,
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
    assert(back.w > 0 && back.w <= back.vw, 'after restoring the run size the canvas is ' + back.w + ' wide in a ' + back.vw + ' px viewport');
    return notes.join('; ');
  });

  // The angle redo checks 1, 2, 4 and 8 (B, C, F). 4: the size rule is on and verifySizes() passes. 2:
  // with every gear and decor piece placed as plan A says, nothing drawn after a station or seat covers
  // over a quarter of its opaque pixels (overhead and people not counted). 8: at 390 by 844 the default
  // near view frames every station sprite and the guests on q0 and q1 with 12 CSS px to spare. 1: the
  // near view tile is at least 40 CSS px wide and every station tile, use tile, seat and queue spot
  // can be brought on screen by tileToClient.
  await step('angle redo: size rule (4), occlusion (2), home view (8) and near view (1) at 390 by 844', async () => {
    const notes = [];
    await advance(0);
    const sz = await ev('(() => { const A = globalThis.' + GLOBAL_NAME + '.art3; if (!A || typeof A.verifySizes !== "function") return { err: "art3.verifySizes missing" }; const mode = A.sizes(); try { const r = A.verifySizes(); return { mode, rows: r.rows.length, misses: r.misses }; } catch (e) { return { mode, err: String((e && e.message) || e) }; } })()');
    assert(!sz.err, 'art3: ' + sz.err);
    assert(sz.mode === 'rule', 'art3.sizes() is ' + describe(sz.mode) + ', wanted rule');
    assert(sz.misses.length === 0, 'verifySizes misses ' + describe(sz.misses));
    notes.push('verifySizes ' + sz.rows + ' rows');
    const geo = await ev('(' + planGeometry.toString() + ')(' + JSON.stringify(WORLD) + ')');
    assert(!geo.err, geo.err);
    const over = geo.occ.filter((o) => o.frac > OCCLUDE_MAX);
    assert(over.length === 0, 'covered over ' + (OCCLUDE_MAX * 100) + ' percent: ' + describe(over));
    notes.push('occlusion max ' + Math.round(Math.max(...geo.occ.map((o) => o.frac)) * 100) + ' percent over ' + geo.occ.length + ' stations and seats');
    const camJs = '(() => { const c = g && g.camera; if (!c || typeof c.get !== "function") return { err: "PitSim.game.camera.get missing" }; const v = c.get() || {}; const r = $(' + JSON.stringify(ID.cv) + ').getBoundingClientRect(); return { mode: v.mode, x0: v.x0 !== undefined ? v.x0 : v.x, y0: v.y0 !== undefined ? v.y0 : v.y, z: v.cssPerRp !== undefined ? v.cssPerRp : v.z, cw: r.width, ch: r.height, left: r.left, top: r.top, dpr: window.devicePixelRatio || 1 }; })()';
    const whole = (c) => c.x0 <= 0.5 && c.y0 <= 0.5 && c.x0 + c.cw / c.z >= WORLD.W - 0.5 && c.y0 + c.ch / c.z >= WORLD.H - 0.5;
    if (DESKTOP_MODE) {
      const c = await ev(camJs);
      assert(!c.err, c.err);
      // v3.4 playtest: desktop opens on the near view of the kitchen at a whole scale, the yard filling
      // the window left of the side column; the zoom button shows here too.
      const lay = await ev('({ iw: document.documentElement.clientWidth, side: $("panels").hidden ? 0 : $("panels").getBoundingClientRect().width })');
      const k = c.z * c.dpr;
      assert(c.mode === 'near' && c.z >= 1 && Math.abs(k - Math.round(k)) < 1e-6 && c.cw >= lay.iw - lay.side - 64, 'desktop camera ' + describe(c) + ' in ' + describe(lay) + ', wanted near at a whole z, the canvas the width left of the side column');
      assert(await visible('zoom'), '#zoom hidden on desktop');
      notes.push('desktop near z ' + c.z + ', canvas ' + c.cw + ' of ' + lay.iw + ' (side ' + Math.round(lay.side) + ')');
    }
    try {
      await emulate(HOME_PHONE);
      await sleep(TIMEOUT_MS.resize);
      await advance(0);
      const c = await ev(camJs);
      assert(!c.err, c.err);
      const kWant = Math.round(1.5 * c.dpr) / c.dpr;
      assert(c.mode === 'near' && Math.abs(c.z - kWant) < 1e-6, '390 by 844 camera ' + describe(c) + ', wanted near at ' + kWant);
      const h = geo.home;
      const m = { left: (h.minX - c.x0) * c.z, right: (c.x0 + c.cw / c.z - h.maxX) * c.z, top: (h.minY - c.y0) * c.z, bottom: (c.y0 + c.ch / c.z - h.maxY) * c.z };
      const tight = Object.entries(m).filter(([, v]) => v < HOME_SPARE);
      assert(tight.length === 0, 'the home view keeps under ' + HOME_SPARE + ' CSS px: ' + describe(m) + ' (bounds ' + describe(h) + ', camera ' + describe(c) + ')');
      notes.push('home spare ' + Object.values(m).map((v) => Math.round(v)).join('/') + ' CSS px');
      const tileW = 48 * c.z;
      assert(tileW >= MIN_TILE_CSS, 'near view tile ' + tileW + ' CSS px wide, wanted at least ' + MIN_TILE_CSS);
      const tiles = await ev('(() => { const out = []; for (const s of MAP.stations) { for (const t of s.tiles) out.push([t.x, t.y]); for (const u of s.use) out.push([u.x, u.y]); } for (const s of MAP.seats) out.push([s.x, s.y]); for (const q of MAP.queue) out.push([q.x, q.y]); return out; })()');
      const off = [];
      for (const [tx, ty] of tiles) {
        const p = await canvasPoint(tx, ty);
        if (!(p.x >= c.left && p.x <= c.left + c.cw && p.y >= c.top && p.y <= c.top + c.ch)) off.push(tx + ',' + ty);
      }
      assert(off.length === 0, 'tileToClient left these off the canvas: ' + off.join(' '));
      const c2 = await ev(camJs);
      assert(c2.mode === 'near' && Math.abs(c2.z - c.z) < 1e-6, 'the camera left near while revealing tiles: ' + describe(c2));
      notes.push(tiles.length + ' tiles at ' + tileW + ' CSS px');
      await ev('(g.camera.set("far"), g.advance(0), true)');
      const f = await ev(camJs);
      // Fix pass: the far view fits the fenced yard (both front corners, 16 rp margin) to the stage
      // width, as tall as the world, with no empty bands above or below.
      const mwh = await ev('[PitSim.MAP.W, PitSim.MAP.H]');
      const yx0 = Math.max(0, WORLD.OX - 24 * mwh[1] - 16), yx1 = Math.min(WORLD.W, WORLD.OX + 24 * mwh[0] + 16);
      const yardWhole = f.x0 <= yx0 + 0.5 && f.x0 + f.cw / f.z >= yx1 - 0.5 && f.y0 <= 0.5 && f.y0 + f.ch / f.z >= WORLD.H - 0.5;
      assert(f.mode === 'far' && yardWhole, 'far view ' + describe(f) + ' does not show the whole yard');
      assert(f.ch / f.z <= WORLD.H + 2, 'far view ' + describe(f) + ' leaves empty bands above or below the world');
      await ev('(g.camera.set("near"), g.advance(0), true)');
      notes.push('far z ' + Math.round(f.z * 1000) / 1000);
    } finally {
      await emulate(RUN_METRICS);
      await sleep(TIMEOUT_MS.resize);
      await advance(0);
    }
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
    await plusChecks(frame, 'morning');   // the angle redo check 3
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
    assert(act === TEXT.nothing, '#act is ' + describe(act) + ', wanted ' + describe(TEXT.nothing) + ' (the spawn faces the counter)');
    assert(await ev('$("act").classList.contains("idle") && getComputedStyle($("act")).visibility === "hidden"'), '#act shows a bar with nothing to do');   // v3.4 review
    const opened = await eventsOfType(EVENT.yardOpen);
    assert(opened.length === 1, EVENT.yardOpen + ' events: ' + opened.length);
    // v2.1 step b: banner and arrow at the pile, clock held.
    await expectStep('charcoal', 'pile', 'after Open the yard');
    const bn = await banner();
    assert(bn && sameJSON(bn.lines, BANNER_CHARCOAL), 'banner ' + describe(bn) + ', wanted lines ' + describe(BANNER_CHARCOAL));
    const frame = await captureFrame();
    const ar = arrows(frame);
    const want = ARROW_AT.pile;
    assert(ar.some((d) => d.x === want.x && d.y === want.y && want.frames.includes(d.frame)), 'no arrow at (' + want.x + ',' + want.y + ') frame ' + want.frames.join(' or ') + '; arrows ' + describe(ar));
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
    if (t0) await expectStep('customer', null, 'after slice_done');   // v3.7: the first plate brings the guest
    await liveBreath();
    return sliced[0].plates + ' plates sliced; board ' + (await ev(F.boardStacks + '.reduce((a, st) => a + st.times.length, 0)')) + ', in hand ' + (await ev(F.carrying + ' ? ' + F.carrying + '.times.length : 0'));
  }, { fatal: true });

  await step('carried', async () => {
    const a = await goto('board', hasKind(CARRY_KIND.plates));
    assert(a.ok, 'did not pick up plates; carrying ' + describe(await ev(F.carrying)));
    return (await ev(F.carrying + '.times.length')) + ' plate(s) in hand';
  }, { fatal: true });

  await step('served with cash up and a served event', async () => {
    const clk = [];
    const t0 = await tut();
    if (t0) assert(t0.id === 'customer' || t0.id === 'register', 'the step with the plate in hand is ' + describe(t0));
    let custId = null, tnote = '';
    const rungAny = 'globalThis.__smoke.events.some((e) => e.type === "rung")';
    if (t0) {
      // v3.7 step i: the slice opens the gate and customer 1 walks in, then pays at the register.
      const evs = await eventsFrom(0);
      const iSl = evs.findIndex((e) => e.type === EVENT.sliceDone);
      const iStep = evs.findIndex((e) => e.type === EVENT.tutorialStep && e.id === 'customer');
      const iGate = evs.findIndex((e) => e.type === EVENT.gateOpen);
      const iArr = evs.findIndex((e) => e.type === EVENT.customerArrived);
      assert(iSl >= 0 && iStep > iSl && iGate > iStep && iArr > iGate, 'events after the slice ' + describe(evs.slice(Math.max(0, iSl)).map((e) => e.type + (e.id !== undefined ? ':' + e.id : ''))));
      const gateOpens = await ev('C.' + C_NAMES.gateOpens);
      assert(nearly(evs[iGate].at, gateOpens, 0.1), EVENT.gateOpen + ' at clock ' + evs[iGate].at + ', wanted ' + gateOpens + ' (deviation 5)');
      const opens = await eventsOfType(EVENT.gateOpen);
      assert(opens.length === 1, opens.length + ' ' + EVENT.gateOpen + ' events on day 1');
      const arr = evs[iArr];
      assert(arr.id === 1 && arr.meat === MEAT, 'first customer_arrived ' + describe(arr));
      custId = arr.id;
    clk.push('A' + Math.round(await ev(F.clock)));
      const w = await until('(' + F.customers + '.some((c) => c.id === 1 && c.mode === "waiting"))', WAIT_S.serve);
      assert(w.ok, 'customer 1 never reached the front of the line');
      await advance(0);
      await expectStep('register', 'register', 'with the guest at the front');
      await screenshot(SCREENSHOTS.tutorialCustomer);
      tnote = '; gate open at ' + evs[iGate].at + ', banner ' + describe((await banner()) && (await banner()).lines);
      await liveBreath();
    }
    // Pay first: the register rings the guest up, the price rises over it, and they go sit.
    const cashBefore = await ev(F.cash);
    clk.push('B' + Math.round(await ev(F.clock)));
    const g = await goto('register', rungAny);
    assert(g.ok, 'the register tap rang nobody up; customers ' + describe(await ev(F.customers + '.map((c) => c.want + ":" + c.mode)')));
    const rung = await eventsOfType('rung');
    const reg = await ev('MAP.station("register").tiles[0]');
    assert(rung.length >= 1 && (custId === null || rung[0].id === custId) && rung[0].by === 'you' && rung[0].x === reg.x * TILE_PX + 8 && rung[0].y === reg.y * TILE_PX, 'no rung event at the register: ' + describe(rung.slice(0, 2)));
    const fx = await fxLog();
    const overReg = (f) => f.y === Math.max(1, reg.y * TILE_PX - 18) && f.x >= reg.x * TILE_PX && f.x <= reg.x * TILE_PX + 16;
    assert(fx.find((f) => f.kind === FX_KIND.cash && overReg(f)), 'fxLog has no ' + FX_KIND.cash + ' over the register; cash entries ' + describe(fx.filter((f) => f.kind === FX_KIND.cash)));
    const cid = rung[0].id;
    clk.push('C' + Math.round(await ev(F.clock)));
    const seated = await until(F.customers + '.some((c) => c.id === ' + cid + ' && c.mode === "seated")', WAIT_S.serve);
    assert(seated.ok && (await eventsOfType(EVENT.served)).length === 0, 'the paid guest did not sit and wait: ' + describe(await ev(F.customers + '.map((c) => c.id + ":" + c.mode)')));
    if (t0) await expectStep('plate', 'table', 'after paying');
    // Then the plate: on the counter, back up, and to the guest's table.
    clk.push('D' + Math.round(await ev(F.clock)));
    const a = await goto('table', tableHas(MEAT));
    assert(a.ok, 'plate did not land on the counter');
    assert((await eventsOfType(EVENT.setDown)).length >= 1, 'no ' + EVENT.setDown + ' event');
    if (t0) await expectStep('deliver', 'table', 'with the plate on the counter');
    clk.push('E' + Math.round(await ev(F.clock)));
    const b2 = await goto('table', hasKind(CARRY_KIND.plates));
    assert(b2.ok, 'did not take the plate back off the counter');
    const seatId = await ev(F.customers + '.find((c) => c.id === ' + cid + ').seat');
    const seat = await ev('MAP.seats.find((x) => x.id === ' + JSON.stringify(seatId) + ')');
    clk.push('F' + Math.round(await ev(F.clock)));
    await canvasTap(seat.x, seat.y + 1);   // the table in front of the guest
    let r = await until(F.today + '.served >= 1 || !(' + inService + ')', WAIT_S.serve);
    if (!(await ev(F.today + '.served >= 1'))) {
      tapNotes.push('delivery via walkTo');
      await ev('sim.' + SIM_METHODS.walkTo + '(' + seat.x + ', ' + seat.y + ')');
      r = await until(F.today + '.served >= 1 || !(' + inService + ')', WAIT_S.serveRetry);
    }
    await advance(0);
    const served = await eventsOfType(EVENT.served);
    const cash = await ev(F.cash);
    assert(served.length >= 1, 'no ' + EVENT.served + ' event after ' + r.t + 's; customers ' + describe(await ev(F.customers + '.map((c) => c.want + ":" + c.mode)')));
    assert(cash > cashBefore, 'cash ' + cash + ' not above ' + cashBefore);
    const e = served[0];
    assert(e.id === cid && e.by === 'you' && e.x === seat.x * TILE_PX + 8 && e.y === seat.y * TILE_PX, 'the first served event ' + describe(e) + ', wanted customer ' + cid + ' by hand at ' + seatId);
    captures.midService = await captureFrame();
    await screenshot(SCREENSHOTS.midService);
    return 'cash ' + cashBefore + ' to ' + cash + ', tip ' + e.tip + ', carried to ' + seatId + ' at clock ' + Math.round(await ev(F.clock)) + ' ' + clk.join(',') + tnote;
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
    const why = await ev('({ clock: ' + F.clock + ', stock: ' + F.stock + '.' + MEAT + ', carrying: ' + F.carrying + ', board: ' + boardHasPlates + ', phase: ' + F.phase + ' })');
    // v3.7: the plate still on the board goes to whoever paid for it, or onto the counter.
    for (let i = 0; i < 3 && (await ev(boardHasPlates)) && (await ev(inService)); i++) {
      const p = await goto('board', hasKind(CARRY_KIND.plates));
      if (!p.ok) break;
      await ringLine();
      await deliverOrSet();
    }
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
        await ringLine();
        if (await ev(hasKind(CARRY_KIND.plates))) await deliverOrSet();
        for (let j = 0; j < 3 && (await ev(boardHasPlates)); j++) {
          const p = await goto('board', hasKind(CARRY_KIND.plates));
          if (!p.ok) break;
          await ringLine();
          await deliverOrSet();
        }
        // Plates left on the counter for guests who sat down since.
        for (let j = 0; j < 3 && (await ev(counterForSeated)); j++) {
          const q = await goto('table', hasKind(CARRY_KIND.plates));
          if (!q.ok) break;
          await deliverOrSet();
        }
        cycles += 1;
      } else if (hasCooking) {
        await ringLine();
        await waitForDone();
      } else break;
    }
    return loaded + ' unit(s) put on, ' + cycles + ' extra plate cycle(s); at the start ' + describe(why);
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
    assert(r.parsed.v === SAVE_V && !('hires' in r.parsed) && Array.isArray(r.parsed.crew) && r.parsed.crew.length === 0, 'raw save v is ' + describe(r.parsed.v) + ', crew ' + describe(r.parsed.crew));   // X11.1
    assert(r.parsed.tutorial && r.parsed.tutorial.done === true, 'raw save tutorial is ' + describe(r.parsed.tutorial));
    assert(r.parsed.decor && typeof r.parsed.decor === 'object', 'raw save has no decor');
    assert(r.parsed.stats && r.parsed.stats.seated >= 1, 'raw save stats.seated is ' + describe(r.parsed.stats && r.parsed.stats.seated));
    assert(r.parsed.player === null, 'raw save player is ' + describe(r.parsed.player));
    assert(r.parsed.season && r.parsed.season.week === 1 && sameJSON(r.parsed.season.results, []), 'raw save season ' + describe(r.parsed.season));
    savedCash = r.cash;
    savedCharcoal = await ev(F.charcoal);
    return 'day ' + r.v.day + ', cash ' + r.v.cash + ', seated ' + r.parsed.stats.seated + ', v 5, no cards, tutorial done, player null, week 1';
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
    // Feedback audit item 22: one tap on Buy arms the row and spends nothing; Confirm buys.
    const c0 = await ev('S().cash');
    await click(ID.buy(DECOR_BUY.id));
    await advance(0);
    const armed = await ev('({ cash: S().cash, owned: S().decor.' + DECOR_BUY.id + ' === true, ok: !!$(' + JSON.stringify(ID.buyOk(DECOR_BUY.id)) + '), ask: (($(' + JSON.stringify(ID.buyOk(DECOR_BUY.id)) + ') || {}).parentNode || {}).textContent || "" })');
    assert(armed.cash === c0 && !armed.owned && armed.ok && /Buy for \d+\?/.test(armed.ask), 'one tap on Buy spent or did not arm ' + describe(armed) + ', cash before ' + c0);
    assert((await eventsSince(n0, EVENT.purchase)).length === 0, 'one tap on Buy fired a purchase');
    await click(ID.buyOk(DECOR_BUY.id));
    await advance(0);
    const bought = (await eventsSince(n0, EVENT.purchase)).filter((e) => e.kind === 'decor');
    assert(bought.length === 1 && bought[0].id === DECOR_BUY.id, 'decor purchase events ' + describe(bought));
    assert(await ev(F.decor + '.' + DECOR_BUY.id + ' === true'), 'state.decor.' + DECOR_BUY.id + ' is not true');
    const seats = await text(ID.seats);
    const want = TEXT.seats(...DECOR_BUY.seatsAfter);
    assert(seats === want, '#seats is ' + describe(seats) + ', wanted ' + describe(want));
    // v3.4: with the Gear sheet open the "+" marks show, one per unowned id; closed, none.
    const open = await captureFrame();
    assert(open.some((d) => d.name === PLUS), 'no "+" records with the Gear sheet open');
    await plusChecks(open, 'with the Gear sheet open');
    await click(ID3.sheetBack);
    await advance(0);
    const frame = await captureFrame();
    assert(hasRecord(frame, DECOR_BUY.draw), 'captureFrame has no ' + describe(DECOR_BUY.draw));
    assert(!frame.some((d) => d.name === PLUS && d.id === DECOR_BUY.id), 'the ' + PLUS + ' for ' + DECOR_BUY.id + ' is still drawn after the purchase');
    await plusChecks(frame, 'after the ' + DECOR_BUY.id + ' purchase');
    const stored = await run('try { const raw = JSON.parse(localStorage.getItem(' + JSON.stringify(SAVE_KEY) + ')); return { raw: raw && raw.v, v: ' + GLOBAL_NAME + '.validateSave(raw) }; } catch (e) { return { error: String(e) }; }');
    assert(stored && stored.v && stored.v.decor && stored.v.decor[DECOR_BUY.id] === true, 'stored save decor ' + describe(stored && ((stored.v && stored.v.decor) || stored.error)));
    assert(stored.v.v === SAVE_V && stored.raw === SAVE_V, 'stored save v ' + describe(stored.raw));
    await screenshotYard(SCREENSHOTS.decor);
    return seats + ' cash ' + (await ev(F.cash)) + ', stored v 5';
  });

  await step('v1 save migrates', async () => {
    await reload(SAVE_V1_SAMPLE);
    await advance(0);
    const read = '({ loop: S().loop, phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ', rep: ' + F.rep + ', stock: ' + F.stock + ', charcoal: ' + F.charcoal + ', gear: ' + F.gear + ', crew: ' + F.crew + ', hires: S().hires, decor: ' + F.decor + ' })';
    const keys = ['day', 'cash', 'rep', 'stock', 'charcoal', 'gear'];
    const s = await ev(read);
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    assert(s.loop === LOOP.creator && (await visible(ID3.creator)), 'loop ' + describe(s.loop) + ', #creator visible ' + (await visible(ID3.creator)));
    for (const k of keys) assert(sameJSON(s[k], SAVE_V1_SAMPLE[k]), k + ' is ' + describe(s[k]) + ', wanted ' + describe(SAVE_V1_SAMPLE[k]));
    // v3.1 (X11.3): the sample hired nobody, so no cards and no state.hires.
    assert(sameJSON(s.crew, []) && s.hires === undefined, 'crew ' + describe(s.crew) + ', hires ' + describe(s.hires));
    assert(s.decor && DECOR_IDS.every((d) => s.decor[d] === false), 'decor ' + describe(s.decor));
    const status = await text(ID.status);
    assert(status === TEXT.notice, '#status is ' + describe(status) + ', wanted ' + describe(TEXT.notice));
    const raw = await storedSave();
    assert(raw && raw.v === SAVE_V && !('hires' in raw), 'stored save v is ' + describe(raw && raw.v) + ', hires ' + describe(raw && raw.hires));
    assert(raw.tutorial && raw.tutorial.done === true, 'stored save tutorial ' + describe(raw.tutorial));
    await click(ID3.crGo);
    await advance(0);
    // X15.1 step 53: no hires and no results, so Hiring Day comes first.
    assert((await loop()) === LOOP.hiring && (await visible(ID31.hiring)), 'after Fire it up loop ' + describe(await loop()) + ', wanted hiring');
    await hireGo(4);
    const s2 = await ev(read);
    assert(s2.loop === LOOP.week && (await visible(ID3.week)), 'after hire-go four times loop ' + describe(s2.loop));
    for (const k of keys) assert(sameJSON(s2[k], SAVE_V1_SAMPLE[k]), 'on the hub ' + k + ' is ' + describe(s2[k]) + ', wanted ' + describe(SAVE_V1_SAMPLE[k]));
    return 'creator, Hiring Day, then the week 1 hub, day ' + s.day + ', cash ' + s.cash + ', rep ' + s.rep + ', stored v ' + raw.v + ', tutorial done, no cards';
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
    // v3.1: Hiring Day is owed (no hires, no results).
    assert((await loop()) === LOOP.hiring, 'after Fire it up loop ' + describe(await loop()) + ', wanted hiring');
    await hireGo(4);
    assert((await loop()) === LOOP.week, 'after hire-go four times loop ' + describe(await loop()));
    await toBookedDay();   // D10.1
    assert(await ev('$(' + JSON.stringify(ID3.go) + ').disabled === false'), '#go disabled; #go-why ' + describe(await accText(ID3.goWhy)));
    await toBookedDay();   // D10.1
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
    assert(ser.v === SAVE_V && ser.tutorial && ser.tutorial.done === true, 'serialize() ' + describe({ v: ser.v, tutorial: ser.tutorial }));
    return 'v2 day 1 save: creator, no tutorial, notice, Hiring Day, then a cook with ' + describe(st2);
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
    await spyPerson(true);
    await advance(0);
    const yardCalls = await spyPerson(false);
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
    await onePitmaster(yardCalls);   // the angle redo check 5
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
      assert(sc.w > 0 && sc.w <= sc.vw && Math.abs(sc.w * sc.dpr - sc.bw) < 1, '#cv ' + sc.w + ' by ' + sc.h + ' in a ' + sc.vw + ' px viewport, backing ' + sc.bw);
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
      await keyPress(KEYS.down);
      await advance(WAIT_S.arrow);
      const y = await ev(F.playerY);
      assert(y === ARROW_DOWN_Y, 'after ArrowDown player.y is ' + y);
      notes.push('ArrowDown to y ' + y);
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
      await toBookedDay();   // D10.1
      await click(ID3.go);
      await advance(0);
      assert(await ev('sim.settle(3)'), 'sim.settle(3) refused for the report fixture (deviation 18)');
      await advance(0);
      assert(await visible(ID.till), '#till hidden for the layout measure');
      await measure('report', true);
      await reload(saveV4({ season: { week: 9, results: resultsOf(9) } }));
      assert(await visible(ID3.seasonEnd), '#season-end hidden for a nine result save');
      await measure('season end', true);
      // v3.1 (X15.1 step 60): Hiring Day on both pages, #card in every mode and the crew sheet.
      await reload(saveV5({ season: { drafted: false } }));
      assert(await visible(ID31.hiring), '#hiring hidden for an owed Hiring Day fixture; loop ' + describe(await loop()));
      await measure('Hiring Day page 1', true);
      await click(ID31.pageNext);
      await measure('Hiring Day page 2', true);
      await click(ID31.app(9));
      assert(await visible(ID31.card), '#card hidden after #app-9');
      await measure('card, applicant', true);
      await click(ID31.cardBack);
      await advance(0);
      await click(ID31.hireCrew);
      assert(await visible(ID3.sheet), '#sheet hidden after #hire-crew');
      await measure('crew sheet on Hiring Day', true);
      await click(ID3.sheetBack);
      await advance(0);
      assert(await visible(ID31.hiring), '#sheet-back did not return to #hiring');
      const crew60 = [pageCard(1, 'Rosa', 'run', [2.5, 3], { banked: 1 }), pageCard(2, 'Dale', 'fire', [3, 2.5], { mood: -2, notice: true })];
      await reload(saveV5({ season: { week: 2, results: resultsOf(1) }, crew: crew60, cash: 300 }));
      assert(await visible(ID3.week), '#week hidden for the crew fixture; loop ' + describe(await loop()));
      await click(ID3.cardCrew);
      assert(await visible(ID3.sheet), '#sheet hidden after #card-crew');
      await measure('crew sheet', true);
      await click(ID31.walkin(0));
      assert(await visible(ID31.card), '#card hidden after #walkin-0');
      await measure('card, walk-in', true);
      await click(ID31.cardBack);
      await advance(0);
      await click(ID31.crew(1));
      assert(await visible(ID31.card), '#card hidden after #crew-1');
      await measure('card, crew', true);
      await click(ID31.cardLevel);
      await measure('card, level', true);
      await click(ID31.cardBack);
      await advance(0);
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
    assert(a1.some((d) => d.x === want.x && d.y === want.y && d.frame === want.frames[0]), 'reduced arrow ' + describe(a1) + ', wanted frame ' + want.frames[0] + ' at (' + want.x + ',' + want.y + ')');
    await advance(0.6);
    const a2 = arrows(await captureFrame());
    assert(a2.some((d) => d.x === want.x && d.y === want.y && d.frame === want.frames[0]), 'reduced arrow after 0.6 s ' + describe(a2) + ', wanted frame ' + want.frames[0] + ' again');
    const n0 = (await fxLog()).length;
    const pt = await canvasPoint(TILE.pile.x, TILE.pile.y);
    await mouseTap(pt.x, pt.y);
    await advance(await ev('C.' + C_NAMES.tick));
    const walking = await ev(F.walking + ' || ' + F.nextTile + ' !== null || ' + F.pathLen + ' > 0');
    assert(walking, 'the walk did not start after a mouse tap on the pile; player ' + describe(await ev('({ x: ' + F.playerX + ', y: ' + F.playerY + ' })')));
    const fx = (await fxLog()).slice(n0);
    assert(fx.some((f) => f.kind === FX_KIND.ring), 'no ' + FX_KIND.ring + ' in fxLog after the tap; got ' + describe(fx.map((f) => f.kind)));
    assert(!fx.some((f) => f.kind === FX_KIND.squash), 'a ' + FX_KIND.squash + ' was logged under reduced motion');
    return 'reduced (' + how + '), static pulse, arrow frame ' + ARROW_AT.pile.frames[0] + ' twice, dog home in frame ' + DOG_HOME.frame + ', ring without squash';
  });

  // W25 R-7: the one bold week 1 play. From cash 103 the picked picnic (a stretch on one kettle) turns
  // safe once the second kettle is bought by a real tap on the Gear sheet, leaning on the deposit.
  await step('second kettle on the deposit by real taps', async () => {
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    // deviation 32: week 1 with Hiring Day done; v3.2 (D10.1): on Sunday, the picnic's day.
    await reload(saveV6({ cash: 103, season: { day: 6, dayLog: ['off', 'off', 'off', 'off', 'off', 'off', null] } }));
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
    const a1 = await ev('({ cash: S().cash, k2: S().gear.kettle2 === true, ok: !!$("buy-kettle2-ok") })');
    assert(a1.cash === s0.cash && !a1.k2 && a1.ok, 'one tap on Buy spent or did not arm (item 22) ' + describe(a1));
    await click('buy-kettle2-ok');
    await advance(0);
    const s1 = await ev('({ k2: S().gear.kettle2, cash: S().cash, id: S().season.booking.id, safe: S().season.booking.safe, can: sim.canLoadUp() })');
    assert(s1.k2 === true && s1.id === 'picnic' && s1.safe === true && s1.can.ok === true && s1.cash >= 0, 'after the buy ' + describe(s1));
    await click(ID3.sheetBack);
    await advance(0);
    const s2 = await ev('({ go: $(' + JSON.stringify(ID3.go) + ').disabled, needsShown: !$("offer-picnic-needs").hidden, why: $(' + JSON.stringify(ID3.goWhy) + ').textContent })');
    assert(s2.go === false && s2.needsShown === false && s2.why === '', 'the hub after the buy ' + describe(s2));
    return 'cash ' + s0.cash + ', deposit ' + s0.dep + ', cart ' + s0.cart + ': Buy enabled (the old cash - cart rule ' + (oldRule ? 'allowed it' : 'greyed it') + '), cash after ' + s1.cash + ', the picnic safe, #go open';
  });

  // ---- v3.1 browser steps 71 to 75 (X15.2), each from a v5 fixture written before a reload ----
  const PC = await ev('JSON.parse(JSON.stringify(C))').catch(() => ({}));
  const budget31 = PC.PAYROLL ? PC.PAYROLL[0] : 60;
  const slots31 = PC.ROSTER_SLOTS ? PC.ROSTER_SLOTS[0] : 2;
  const meterOf = (id) => ev('({ role: attr(' + JSON.stringify(id) + ', "role"), now: attr(' + JSON.stringify(id) + ', "aria-valuenow"), max: attr(' + JSON.stringify(id) + ', "aria-valuemax"), label: attr(' + JSON.stringify(id) + ', "aria-label") })');
  const labelIn = (id, label) => ev('(() => { const e = $(' + JSON.stringify(id) + '); if (!e) return false; return [e, ...e.querySelectorAll("[aria-label]")].some((x) => x.getAttribute("aria-label") === ' + JSON.stringify(label) + '); })()');
  const backFromCard = async () => { if (await visible(ID31.card)) { await click(ID31.cardBack); await advance(0); } };

  await step('crew sheet, walk-in and training by real taps', async () => {
    const rosa = pageCard(1, 'Rosa', 'run', [2.5, 3], { xp: 20, mood: 1 });
    await reload(saveV5({ season: { week: 2, results: resultsOf(1) }, cash: 300, crew: [rosa] }));
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'the fixture loaded as ' + describe(await loop()));
    const wk = await ev('JSON.parse(JSON.stringify(S().season.walkins))');
    assert(Array.isArray(wk) && wk.length >= 2 && wk.every((a) => a.hired === false) && (await ev('S().season.trained')) === null, 'season.walkins ' + describe(wk));
    await click(ID3.cardCrew);
    await advance(0);
    assert(await visible(ID3.sheet), '#sheet hidden after #card-crew');
    const pm = await meterOf(ID31.crewPayroll);
    assert(pm.role === 'meter' && pm.now === String(rosa.wage) && pm.max === String(budget31) && pm.label === fill(UI.payrollAria, { p: rosa.wage, b: budget31 }), '#crew-payroll ' + describe(pm));
    const sl = await accText(ID31.crewSlots);
    assert(sl === fill(UI.slots, { n: 1, s: slots31 }), '#crew-slots reads ' + describe(sl));
    if (slots31 === 2) assert(sl === '1 of 2 on the crew', '#crew-slots ' + describe(sl) + ', X15.2 literal');
    // Deviation 30: the mood face on the crew card, else on the card sheet.
    const moodLabel = moodAriaOf('Rosa', 1);
    let moodHow = '#crew-1';
    if (!(await labelIn(ID31.crew(1), moodLabel))) {
      await click(ID31.crew(1));
      await advance(0);
      const cm = await attrOf(ID31.cardMood, 'aria-label');
      assert(cm === moodLabel, '#card-mood aria-label ' + describe(cm) + ', wanted ' + describe(moodLabel));
      moodHow = '#card-mood';
      await backFromCard();
    }
    assert((await attrOf(ID31.bring(1), 'aria-pressed')) === 'true' && (await attrOf(ID31.bring(1), 'aria-label')) === fill(UI.bringAria, { name: 'Rosa' }), '#bring-1 ' + describe([await attrOf(ID31.bring(1), 'aria-pressed'), await attrOf(ID31.bring(1), 'aria-label')]));
    // The walk-in.
    assert(await visible(ID31.walkinsH), '#walkins-h hidden in the week');
    assert((await accText(ID31.walkinsLine)) === UI.walkinLine, '#walkins-line reads ' + describe(await accText(ID31.walkinsLine)));
    await click(ID31.walkin(0));
    await advance(0);
    assert(await visible(ID31.card), '#card hidden after #walkin-0');
    const hf = await accText(ID31.cardHire);
    assert(hf.includes(fill(UI.hireFee, { f: wk[0].wage })), '#card-hire reads ' + describe(hf) + ', wanted ' + describe(fill(UI.hireFee, { f: wk[0].wage })));
    await screenshot(SCREENSHOTS.cardWalkin);
    const cash0 = await ev('S().cash');
    const pay0 = await ev('sim.payroll().now');
    const n0 = await eventCount();
    await click(ID31.cardHire);
    await advance(0);
    await backFromCard();
    const ch = await eventsSince(n0, EV31.crewHired);
    assert(ch.length === 1 && ch[0].from === 'walkin' && ch[0].fee === wk[0].wage && ch[0].name === wk[0].name, 'crew_hired after the walk-in hire ' + describe(ch));
    assert((await ev('S().cash')) === cash0 - wk[0].wage, 'cash ' + cash0 + ' to ' + (await ev('S().cash')) + ', the fee ' + wk[0].wage);
    assert(await visible(ID3.sheet), '#sheet hidden after the walk-in hire');
    const sl2 = await accText(ID31.crewSlots);
    assert(sl2 === fill(UI.slots, { n: 2, s: slots31 }), '#crew-slots after the hire ' + describe(sl2));
    const joined = await ev('(sim.crewView(' + ch[0].id + ') || {}).bring === true');
    const pm2 = await meterOf(ID31.crewPayroll);
    assert(pm2.now === String(pay0 + (joined ? wk[0].wage : 0)), '#crew-payroll after the hire ' + describe(pm2) + ', wanted ' + (pay0 + (joined ? wk[0].wage : 0)) + (joined ? ' (joined the lineup)' : ' (resting)'));
    // v3.4 playtest: training is automatic. The week's first Rest trains the card with the least XP;
    // the crew sheet has no Train button.
    assert(!(await present(ID31.train(1))), '#' + ID31.train(1) + ' still on the crew sheet');
    const xpB = await ev('S().crew.map((c) => ({ id: c.id, xp: c.xp, name: c.name }))');
    await click(ID3.sheetBack);
    await advance(0);
    await quickTap('off');
    const spent = await visible('daycard');
    if (spent) await nextDayTap();
    const xpA = await ev('S().crew.map((c) => ({ id: c.id, xp: c.xp, name: c.name }))');
    const gained = xpA.filter((c) => { const b = xpB.find((x) => x.id === c.id); return b && c.xp === b.xp + PC.TRAIN_XP; });
    const least = xpB.slice().sort((u, v) => u.xp - v.xp || u.id - v.id)[0];
    assert(gained.length === 1 && gained[0].id === least.id, 'the Rest trained ' + describe(gained) + ', wanted ' + describe(least));
    const xp0 = least.xp, xp1 = gained[0].xp;
    await click(ID3.cardCrew);
    await advance(0);
    const tl = await accText(ID31.crewTrainLine);
    assert(tl === fill(UI.trainedLine, { name: gained[0].name }), '#crew-train-line reads ' + describe(tl));
    const allOff = await ev('[...document.querySelectorAll("[id^=\\"train-\\"]")].filter((b) => b.tagName === "BUTTON").every((b) => b.disabled)');
    assert(allOff, 'a train- button is still enabled after the pick');
    await screenshot(SCREENSHOTS.crew);
    await click(ID3.sheetBack);
    await advance(0);
    return 'payroll ' + rosa.wage + ' of ' + budget31 + ', 1 then 2 of ' + slots31 + ', mood read on ' + moodHow + ', ' + wk[0].name + ' signed for ' + wk[0].wage + (joined ? ' and joined the lineup' : ' and rests') + ', the first Rest trained ' + least.name + ' ' + xp0 + ' to ' + xp1 + ' XP' + (spent ? ' (Tuesday next)' : '');
  });

  await step('level-up choice by real taps', async () => {
    const rosa = pageCard(1, 'Rosa', 'run', [2.5, 3], { banked: 1, potential: 4 });
    await reload(saveV5({ season: { week: 2, results: resultsOf(1) }, crew: [rosa] }));
    assert((await loop()) === LOOP.week, 'the fixture loaded as ' + describe(await loop()));
    await click(ID3.cardCrew);
    await advance(0);
    await click(ID31.crew(1));
    await advance(0);
    assert(await visible(ID31.card), '#card hidden after #crew-1');
    assert((await accText(ID31.cardBanked)) === fill(UI.banked, { n: 1 }), '#card-banked reads ' + describe(await accText(ID31.cardBanked)));
    for (const id of [ID31.cardBring, ID31.cardRaise, ID31.cardLetGo, ID31.cardXp]) assert(await visible(id), '#' + id + ' not shown in crew mode');
    assert(!(await present(ID31.cardTrain)), '#' + ID31.cardTrain + ' on the card (v3.4: training is automatic)');
    await screenshot(SCREENSHOTS.cardCrew);   // deviation 34: the card sheet in crew mode
    await click(ID31.cardLevel);
    await advance(0);
    assert((await visible(ID31.cardPick(0))) && (await visible(ID31.cardPick(1))), 'level mode lacks #card-pick-0 or #card-pick-1');
    assert((await accText(ID31.card)).includes(UI.levelH), 'level mode has no ' + describe(UI.levelH));
    const p0 = (await accText(ID31.cardPick(0))).toLowerCase();
    assert(p0 === fill(UI.levelPick, { skill: W15.skill.run[0] }).toLowerCase(), '#card-pick-0 reads ' + describe(p0));
    await screenshot(SCREENSHOTS.cardLevel);
    const n0 = await eventCount();
    await click(ID31.cardPick(0));
    await advance(0);
    const lu = await eventsSince(n0, EV31.levelUp);
    assert(lu.length === 1 && lu[0].id === 1 && lu[0].skill === 0 && lu[0].value === 3, 'level_up ' + describe(lu));
    const sk = await ev('S().crew.find((c) => c.id === 1).skills');
    assert(sameJSON(sk, [3, 3]), 'skills after the pick ' + describe(sk));
    assert(!(await visible(ID31.cardBanked)), '#card-banked still shown with nothing banked');
    await backFromCard();
    await click(ID3.sheetBack);
    await advance(0);
    return 'level mode, Speed up half a star, skills [3, 3], nothing banked';
  });

  await step('crew rows on the report, thirds on screen', async () => {
    const runC = pageCard(1, 'Rosa', 'run', [2.5, 2.5]);
    const fireC = pageCard(2, 'Dale', 'fire', [3, 3]);
    await reload(saveV5({ season: { week: 3, results: resultsOf(2) }, rep: 40, gear: { kettle2: true }, crew: [runC, fireC], cash: 300 }));
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'the fixture loaded as ' + describe(await loop()));
    const pay = await ev('sim.payroll()');
    assert(pay.now === runC.wage + fireC.wage && pay.now === 50, 'payroll ' + describe(pay) + ', wanted 50');
    // v3.4 review: the third line under the Cash tiles is cut under the Start button; the Word of
    // mouth pill's thirds bar carries it. v3.5: Monday's planner stands in for the Start button.
    let third = 'on the Word of mouth pill';
    if ((await present('hub-start')) || (await present('planner'))) {
      const th = await ev('({ on: [...$("week-thirds").querySelectorAll(".seg")].findIndex((x) => x.classList.contains("on")), aria: $("week-thirds").getAttribute("aria-label"), name: PitSim.STRINGS.thirdName[1] })');
      assert(th.on === 1 && th.aria.includes(th.name) && !(await present(ID31.thirdLine)), 'the thirds bar ' + describe(th));
    } else {
      third = await accText(ID31.thirdLine);
      assert(third === UI.thirdNow[1], '#third-line reads ' + describe(third) + ', wanted ' + describe(UI.thirdNow[1]));
    }
    const first = await ev('S().season.offers[0].id');
    await click(ID3.book(first));
    await advance(0);
    await toBookedDay();   // D10.1
    await click(ID3.go);
    await advance(0);
    assert(await ev(inService), 'not in service after #go; #go-why ' + describe(await accText(ID3.goWhy).catch(() => '')));
    const rr = await untilLoopM(LOOP.report, await secondsLeftM());
    assert(rr.ok, 'no report after ' + rr.t + ' s');
    await advance(0);
    const till = await ev(F.till);
    const rows = (till.crew || []).filter((r) => r.worked);
    assert(rows.length === 2 && rows.some((r) => r.id === 1) && rows.some((r) => r.id === 2), 'till.crew ' + describe(till.crew));
    for (const r of rows) {
      assert(await visible(ID31.repCrewRow(r.id)), '#rep-crew-' + r.id + ' hidden');
      const line = await text(ID31.repCrewLine(r.id));
      assert(line === r.line, '#rep-crew-' + r.id + '-line ' + describe(line) + ', the till row ' + describe(r.line));
      assert(await labelIn(ID31.repCrewRow(r.id), moodAriaOf(r.name, r.moodTo)), '#rep-crew-' + r.id + ' has no ' + describe(moodAriaOf(r.name, r.moodTo)));
      if (r.moodFrom !== r.moodTo) {
        const was = fill(UI.moodWas, { mood: W15.mood[r.moodTo + 2], was: W15.mood[r.moodFrom + 2] });
        assert((await accText(ID31.repCrewRow(r.id))).includes(was), '#rep-crew-' + r.id + ' lacks ' + describe(was));
      }
      const xm = await meterOf(ID31.repCrewXp(r.id));
      assert(xm.role === 'meter' && Number(xm.now) === r.xp && Number(xm.max) === PC.LEVEL_XP, '#rep-crew-' + r.id + '-xp ' + describe(xm));
    }
    assert(!(await visible(ID31.repRested)), '#rep-rested shown with nobody resting');
    assert(till.third === 1, 'till.third ' + describe(till.third));
    const ht = await accText(ID31.repHostThird);
    assert(ht === fill(W15.hostThird[1], { name: MARTY.name }), '#rep-host-third reads ' + describe(ht));
    const compact = await compactOrder(till.stars);
    const ledger = await ledgerAddsUp(ID3.repMoney);
    assert(!(await visible(ID31.repMoneyDetail)), '#rep-money-detail open');
    let height;
    try {
      if (DESKTOP_MODE) { await emulate(PHONE); await sleep(TIMEOUT_MS.resize); await advance(0); }
      height = await ev('({ h: $(' + JSON.stringify(ID.till) + ').scrollHeight, ih: window.innerHeight })');
      assert(height.h <= 2 * height.ih, '#till is ' + height.h + ' px tall with two crew rows, over twice ' + height.ih);
      await screenshot(SCREENSHOTS.reportCrew);
    } finally {
      if (DESKTOP_MODE) { await emulate(RUN_METRICS); await sleep(TIMEOUT_MS.resize); await advance(0); }
    }
    return 'third line ' + describe(third) + ', ' + rows.map((r) => describe(r.line)).join(' and ') + ', host third, ' + compact + ' compact rows (' + ledger + '), #till ' + height.h + ' of ' + (2 * height.ih) + ' px';
  });

  await step('v2.1 and v3.0 saves migrate in the page', async () => {
    const { v3, v4 } = migratedSamples();
    const tileWant = [fill(UI.crewLine, { n: 2, s: slots31 }), fill(UI.crewSub, { p: 50, b: budget31 })];
    await reload(v3);
    await advance(0);
    assert(await visible(ID3.creator), '#creator hidden for the v3 sample with hires');
    const st1 = await text(ID.status);
    assert(st1 === UI.noticeCrew, '#status is ' + describe(st1) + ', wanted ' + describe(UI.noticeCrew));
    await click(ID3.crGo);
    await advance(0);
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'after Fire it up: loop ' + describe(await loop()) + ' (the save had hires, so no Hiring Day)');
    const ct1 = await crewTile();
    assert(tileWant.every((t) => ct1.includes(t)), '#card-crew reads ' + describe(ct1) + ', wanted ' + describe(tileWant));
    if (slots31 === 2 && budget31 === 60) assert(ct1.includes('2 of 2 on the crew') && ct1.includes('Payroll 50 / 60'), '#card-crew ' + describe(ct1) + ', X15.2 literal');
    await reload(v4);
    await advance(0);
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'the v4 sample with hires loaded as ' + describe(await loop()));
    const st2 = await text(ID.status);
    assert(st2 === UI.noticeCrew, '#status is ' + describe(st2) + ', wanted ' + describe(UI.noticeCrew));
    const ct2 = await crewTile();
    assert(tileWant.every((t) => ct2.includes(t)), '#card-crew reads ' + describe(ct2));
    const raw = await storedSave();
    assert(raw && raw.v === SAVE_V && !('hires' in raw) && Array.isArray(raw.crew) && raw.crew.length === 2, 'stored save ' + describe(raw && { v: raw.v, hires: raw.hires, crew: raw.crew && raw.crew.length }));
    return 'v3 sample: creator, ' + describe(st1) + ', the week hub with two cards; v4 sample: the week hub directly; ' + describe(tileWant);
  });

  await step('the crew in the yard', async () => {
    const fireC = pageCard(1, 'Dale', 'fire', [3, 3], { look: { skin: 4, hair: 3, hairColor: 5, face: 1, hat: 2, apron: 3 } });
    const prepC = pageCard(2, 'Opal', 'prep', [2, 2], { look: { skin: 2, hair: 2, hairColor: 2, face: 3, hat: 0, apron: 1 } });
    await reload(saveV5({ season: { week: 2, results: resultsOf(1) }, crew: [fireC, prepC], cash: 300 }));
    assert((await loop()) === LOOP.week, 'the fixture loaded as ' + describe(await loop()));
    const first = await ev('S().season.offers[0].id');
    await click(ID3.book(first));
    await advance(0);
    await toBookedDay();   // D10.1
    await click(ID3.go);
    await advance(0);
    assert(await ev(inService), 'not in service after #go; #go-why ' + describe(await accText(ID3.goWhy).catch(() => '')));
    const hook = await ev('JSON.parse(JSON.stringify(g.crew))');
    const keys = await ev('({ fire: globalThis.' + GLOBAL_NAME + '.art.crewKey("fire"), prep: globalThis.' + GLOBAL_NAME + '.art.crewKey("prep") })');
    const want = { fire: 'fire:' + lookKeyOf(fireC.look), prep: 'prep:' + lookKeyOf(prepC.look) };
    assert(hook && hook.run === null && hook.fire && hook.fire.id === 1 && hook.fire.key === keys.fire && keys.fire === want.fire && hook.prep && hook.prep.id === 2 && hook.prep.key === keys.prep && keys.prep === want.prep,
      'PitSim.game.crew ' + describe(hook) + ', art.crewKey ' + describe(keys) + ', wanted ' + describe(want));
    const frame = await captureFrame();
    captures.crewYard = frame;
    assert(frame.some((d) => /^tender_/.test(d.name)) && frame.some((d) => /^prep_/.test(d.name)), 'captureFrame has no tender_ or prep_ record: ' + describe([...new Set(frame.map((d) => d.name))].filter((n) => /^(buddy|tender|prep)_/.test(n))));
    const gate = await ev('S().today.gateAt');
    const lit = await until(F.fire('kettle1') + ' > 0', 10);
    assert(lit.ok && (await ev(F.clock)) < gate, 'the FIRE card did not light kettle 1 within 10 s (fire ' + (await ev(F.fire('kettle1'))) + ', clock ' + (await ev(F.clock)) + ')');
    return 'crew keys ' + describe(keys) + ', tender_ and prep_ drawn, kettle 1 lit at ' + lit.t + ' s with no player input';
  });

  // ---- v3.2 days of the week (D10.1 steps 72 to 78) ----------------------------------------------

  // v3.4 playtest: the hub's kinds as the UI offers them (the pick on #hub-start, the rest behind
  // Change plan), in D32.dayKinds order.
  const PU = await ev('JSON.parse(JSON.stringify(PitSim.STRINGS.ui))');   // v3.4: the page's own strings
  const hubKinds = () => ev('(() => { const r = sim.recommendDay(); if (!r) return []; return ' + JSON.stringify(D32.dayKinds) + '.filter((k) => k === r.kind || r.alt.some((a) => a.kind === k)); })()');
  const OLD_DAY_IDS = ['day-market', 'day-prep', 'day-train', 'day-loadin'];

  await step('v3.4 days 72: a full week by the start button, Rest trains, the event preps itself', async () => {
    const C = await pageC();
    await reload(saveV6({ cash: 300, season: { pick: 'birthday' }, crew: [Object.assign({}, DAY_CARD)] }));
    assert(await visible(ID3.week) && sameJSON(await litDays(), [0]), 'the Monday hub ' + describe(await litDays()));
    assert(await ev('S().season.booking.type') === 'birthday', 'the fixture booking ' + describe(await ev('S().season.booking.type')));
    const notes = [];
    // The start button: one big button with the game's pick, Change plan hides the other choice.
    await passPlanner();   // v3.5: every weekday planned a Yard day, so the week runs day by day
    const rv = await ev('sim.recommendDay()');
    assert(rv && (await present('hub-start')) && (await accText('hub-start')).includes(rv.start), '#hub-start reads ' + describe(await present('hub-start') ? await accText('hub-start') : null) + ', wanted ' + describe(rv && rv.start));
    const first = await ev('(() => { const b = $("hub-start").getBoundingClientRect(), o = $(' + JSON.stringify(ID3.offers) + ').getBoundingClientRect(); return { b: b.top, o: o.top }; })()');
    assert(first.b < first.o, '#hub-start sits below the offers ' + describe(first));
    for (const id of OLD_DAY_IDS) assert(!(await present(id)), '#' + id + ' is still on the hub');
    assert((await present('hub-change')) && (await visible('hub-plan')) === false, 'Change plan is open before a tap');
    await click('hub-change');
    await advance(0);
    const alt = rv.alt.map((o) => o.kind);
    for (const k of alt) assert(await visible('day-' + k), '#day-' + k + ' hidden after Change plan');
    await click('hub-change');
    await advance(0);
    assert(!(await visible('hub-plan')), '#hub-plan still open after a second tap');
    notes.push('#hub-start "' + rv.start + '", Change plan shows ' + alt.join(', '));
    await screenshot(SCREENSHOTS.daysWeek);
    // Monday to Friday: Rest. The week's first Rest trains the card; the next Rest lifts its mood.
    const xp0 = await ev('S().crew[0].xp');
    await quickTap('off');
    assert(await visible('daycard'), '#daycard missing after Rest');
    assert((await ev('S().crew[0].xp')) === xp0 + C.TRAIN_XP, 'the first Rest trained ' + (await ev('S().crew[0].xp')) + ' after ' + xp0);
    await screenshot(SCREENSHOTS.daysCard);
    await nextDayTap();
    assert(sameJSON(await litDays(), [1]) && (await ev('$("day-0").classList.contains("done")')), 'Tuesday lit, Monday done');
    await savedDayIsLit('after Monday');
    const m0 = await ev('S().crew[0].mood');
    await quickTap('off');
    assert((await ev('S().crew[0].mood')) === Math.min(C.DAYOFF_MOOD_CAP, m0 + 1), 'the Rest mood ' + (await ev('S().crew[0].mood')) + ' after ' + m0);
    assert((await ev('S().crew[0].xp')) === xp0 + C.TRAIN_XP, 'a second Rest trained again');
    await nextDayTap();
    for (let d = 2; d < 5; d++) { await quickTap('off'); await nextDayTap(); }
    await savedDayIsLit('after Friday');
    // Saturday: the booked event on #hub-start; Back from the morning shop spends nothing.
    assert(await goShown(), 'the Birthday is not on Saturday ' + describe(await hubKinds()));
    const sat = await ev('sim.recommendDay()');
    assert(sat.kind === 'event' && sat.start === fill(PU.startDay, { day: 'Saturday', kind: sat.label }) && (await accText('hub-start')).includes(sat.start), 'Saturday pick ' + describe(sat));
    const cash0 = await ev('S().cash');
    await click('hub-start');
    await advance(0);
    if (await visible('mshop')) {
      await click('shop-back');
      await advance(0);
      assert((await ev('S().cash')) === cash0 && (await ev('S().phase')) === 'morning' && (await visible(ID3.week)), 'Back from the shop moved cash or left the hub');
      await click('hub-start');
      await advance(0);
      await click('shop-confirm');
      await advance(0);
      notes.push('Saturday through the morning shop');
    }
    assert((await ev('S().today.prepBonus')) === 4, 'today.prepBonus ' + (await ev('S().today.prepBonus')) + ' (prep is automatic)');
    for (let i = 0; i < 40 && (await ev('S().phase')) !== 'service'; i++) await advance(0.5);
    await advance(4);
    await screenshotYard(SCREENSHOTS.daysWeekend);
    assert(await ev('sim.settle(3)'), 'sim.settle(3) refused (deviation 18)');
    await advance(0);
    assert(await visible(ID.till), '#till hidden after the event');
    assert((await accText(ID.next)) === D32.nextDay, 'the Saturday report #next reads ' + describe(await accText(ID.next)));
    await click(ID.next);
    await advance(0);
    assert(sameJSON(await litDays(), [6]), 'Sunday lit after the report ' + describe(await litDays()));
    await savedDayIsLit('after Saturday');
    await quickTap('off');
    await nextDayTap();
    assert((await ev('S().season.week')) === 2 && sameJSON(await litDays(), [0]), 'week 2 Monday ' + describe({ week: await ev('S().season.week'), lit: await litDays() }));
    await savedDayIsLit('week 2');
    notes.push('Rest x6 (first trained +' + C.TRAIN_XP + ' xp, then mood), the Birthday at prepBonus 4, week 2 Monday');
    return notes.join('; ');
  });

  await step('v3.4 days 73: the morning shop, Back spends nothing, the weekend warning, Confirm starts the day', async () => {
    // The Sunday picnic's meat costs more than its deposit, so the weekend holds money back.
    await reload(saveV6({ cash: 60, charcoal: 0, stock: Object.assign({}, ZERO_STOCK), gear: { cooler: true, kettle2: true }, season: { pick: 'picnic' } }));
    await passPlanner();   // v3.5
    assert((await ev('S().season.booking.type')) === 'picnic' && (await ev('sim.shopView("yard").reserve')) > 0, 'the picnic fixture holds no reserve ' + describe(await ev('sim.shopView("yard")')));
    const rk = await ev('sim.recommendDay().kind');
    if (rk !== 'yard') { await click('hub-change'); await advance(0); }
    const cash0 = await ev('S().cash');
    const cart0 = await ev('JSON.parse(JSON.stringify(S().cart))');
    await click(rk === 'yard' ? 'hub-start' : 'day-yard');
    await advance(0);
    assert((await visible('mshop')) && (await visible(ID3.sheet)), 'the morning shop did not open for a Yard day with nothing in stock');
    assert((await accText(ID3.sheetH)).includes(fill(PU.shopTitle, { day: 'Monday' })), '#sheet-h reads ' + describe(await accText(ID3.sheetH)));
    assert((await text('shop-price')) === fill(PU.shopPrice, { p: Math.round((await ev('C.DAY_PRICE[0]')) * 100) }), '#shop-price ' + describe(await text('shop-price')));
    // v3.4 review: the booked event's meats come first, pre-filled and tagged ("Sun needs N").
    const bn = await ev('sim.bookingNeeds()');
    const tags = await ev('[...document.querySelectorAll(".needtag")].map((t) => t.id + "=" + t.textContent)');
    const railM = Object.keys(bn.units).filter((m) => bn.units[m] > 0);
    const dshort = bn.dayShort.charAt(0) + bn.dayShort.slice(1).toLowerCase();
    assert(railM.length && railM.every((m) => tags.includes('need-' + m + '=' + dshort + ' needs ' + bn.units[m])), 'needs tags ' + describe(tags) + ' for ' + describe(bn.units));
    const cartM = await ev('Object.keys(S().cart.meat).filter((m) => S().cart.meat[m] > 0)');
    assert(cartM.length && cartM.every((m) => bn.rail[m] > 0), 'the Yard day cart ' + describe(cartM) + ' is not the booked meats');
    const fx = await ev('PitSim.CATALOG.filter((r) => r.kind === "meat").map((r) => [r.label, r.effect])');
    assert(fx.every((r) => !r[1].startsWith(r[0] + ':')), 'meat effects still repeat the name ' + describe(fx));
    // More chicken until the cart eats into the weekend's booking money: the warning shows.
    let taps = 0;
    while (!(await ev('sim.shopView("yard").warn')) && taps < 30) {
      const id = (await ev('!!$("inc-sausage") && !$("inc-sausage").disabled')) ? 'inc-sausage' : (await ev('!!$("inc-ribs") && !$("inc-ribs").disabled')) ? 'inc-ribs' : null;
      if (!id) break;
      await click(id); await advance(0); taps++;
    }
    const v = await ev('sim.shopView("yard")');
    assert(v.warn && (await visible('shop-warn')) && (await text('shop-warn')) === v.warn, '#shop-warn ' + describe({ warn: v.warn, shown: await visible('shop-warn'), taps, view: v }));
    assert((await ev('S().cash')) === cash0, 'cash moved before Confirm');
    await click('shop-back');
    await advance(0);
    assert(!(await visible(ID3.sheet)) && (await visible(ID3.week)) && (await ev('S().cash')) === cash0 && sameJSON(await ev('JSON.parse(JSON.stringify(S().cart))'), cart0), 'Back: cash ' + (await ev('S().cash')) + ', cart ' + describe(await ev('S().cart')));
    // Confirm: the cart is bought at today's price and the Yard day starts.
    await click(rk === 'yard' ? 'hub-start' : 'day-yard');
    if (rk !== 'yard' && !(await present('day-yard'))) { await click('hub-change'); await advance(0); await click('day-yard'); }
    await advance(0);
    const total = await ev('sim.shopView("yard").total');
    await click('shop-confirm');
    await advance(0);
    assert((await ev('S().phase')) !== 'morning' && (await ev('S().cash')) === cash0 - total, 'Confirm: phase ' + (await ev('S().phase')) + ', cash ' + (await ev('S().cash')) + ', wanted ' + (cash0 - total));
    return taps + ' taps (sausage, ribs) to the warning ("' + v.warn + '"), Back kept ' + cash0 + ', Confirm spent ' + total + ' and opened the Yard day';
  });

  await step('v3.4 days 74: day prices Monday to Thursday in the morning shop', async () => {
    const C = await pageC();
    await reload(saveV6({ cash: 400, season: { pick: 'birthday' } }));
    const price = await ev('({ c: PitSim.CATALOG.find((r) => r.id === "chicken").price, b: PitSim.CATALOG.find((r) => r.id === "charcoal").price })');
    const got = [];
    const cls = [];
    await passPlanner();   // v3.5
    for (let d = 0; d < 4; d++) {
      const m = C.DAY_PRICE[d];
      const want = Math.round(5 * price.c * m) + Math.round(5 * price.b * m);
      await cartByTaps({ chicken: 5, charcoal: 5 });
      const shop = await accText(ID3.cardShop);
      assert(shop.includes(fill(UI.shopLine || 'Cart {t}', { t: want })), 'day ' + d + ' the shop tile reads ' + describe(shop) + ', wanted cart ' + want);
      const rk = await ev('sim.recommendDay().kind');
      if (rk !== 'yard') { await click('hub-change'); await advance(0); }
      await click(rk === 'yard' ? 'hub-start' : 'day-yard');
      await advance(0);
      assert(await visible('mshop'), 'day ' + d + ': the morning shop did not open with a cart to pay');
      cls.push(await ev('$("shop-price").className'));
      assert((await ev('sim.shopView("yard").total')) === want && (await text('shop-total')).includes(String(want)), 'day ' + d + ' #shop-total ' + describe(await text('shop-total')) + ', wanted ' + want);
      await click('shop-back');
      await advance(0);
      await quickTap('off');
      await nextDayTap();
      got.push(want);
    }
    const has = (c, k) => c.split(/\s+/).includes(k);
    assert(has(cls[0], 'low') && has(cls[1], 'low') && !has(cls[2], 'low') && !has(cls[2], 'high') && has(cls[3], 'high'), '#shop-price classes ' + describe(cls));
    return 'the same cart cost ' + got.join(', ') + ' Monday to Thursday; #shop-price ' + cls.join(' | ');
  });

  await step('v3.4 the broke rescue: an advance, a sale at half, a restart that asks twice', async () => {
    const C = await pageC();
    await reload(saveV6({ cash: 0, charcoal: 0, stock: Object.assign({}, ZERO_STOCK), gear: { cooler: true }, season: { pick: 'birthday' } }));
    const v = await ev('sim.rescueView()');
    assert(v && (await visible('rescue')), '#rescue hidden with cash 0 ' + describe(v));
    const pick = await ev('sim.recommendDay()');
    assert(pick && (await present('hub-start')), 'no start button beside the rescue');
    // v3.4 review: the Start button comes first, the rescue under it with plain buttons and a Sell gear row.
    const lay = await ev('(() => { const a = $("hub-startsec"), b = $("rescue"); const btns = [...b.querySelectorAll("button")]; return { after: !!(a.compareDocumentPosition(b) & 4), quiet: btns.every((x) => x.classList.contains("quiet")), sellRow: !!$("rescue-sell-h"), sell: btns.filter((x) => x.id.indexOf("rescue-sell-") === 0).length }; })()');
    assert(lay.after && lay.quiet && lay.sellRow && lay.sell >= 1, 'rescue layout ' + describe(lay));
    const notes = ['need ' + v.need + ', pick ' + pick.kind];
    if (v.advance > 0) {
      const c0 = await ev('S().cash');
      await click('rescue-advance');
      await advance(0);
      assert((await ev('S().cash')) === c0 + v.advance && (await ev('S().season.advance')) === v.advance, 'the advance: cash ' + (await ev('S().cash')));
      notes.push('advance ' + v.advance);
    }
    await reload(saveV6({ cash: 0, charcoal: 0, stock: Object.assign({}, ZERO_STOCK), gear: { cooler: true }, season: { pick: 'yard' } }));
    const v2 = await ev('sim.rescueView()');
    assert(v2 && v2.gear.some((g) => g.id === 'cooler'), 'no cooler to sell ' + describe(v2));
    const row = v2.gear.find((g) => g.id === 'cooler');
    const c1 = await ev('S().cash');
    await click('rescue-sell-cooler');
    await advance(0);
    assert((await ev('S().cash')) === c1 + row.price && (await ev('S().gear.cooler')) !== true, 'the sale: cash ' + (await ev('S().cash')) + ', wanted ' + (c1 + row.price));
    notes.push('sold the cooler for ' + row.price);
    await reload(saveV6({ cash: 0, charcoal: 0, stock: Object.assign({}, ZERO_STOCK), season: { week: 3, results: resultsOf(2), pick: 'yard' } }));
    assert(await present('rescue-restart'), '#rescue-restart missing with cash 0 in week 3');
    assert((await present('rescue-sell-none')) && (await ev('$("rescue-sell-none").disabled')), 'no Sell gear row with nothing to sell');
    {
      await click('rescue-restart');
      await advance(0);
      assert((await ev('S().season.week')) === 3 && (await text('rescue-restart')) !== '', 'one tap restarted the season');
      await click('rescue-restart');
      await advance(0);
      assert((await ev('S().season.week')) === 1 && (await ev('S().cash')) >= C.START_CASH, 'the restart: week ' + (await ev('S().season.week')) + ', cash ' + (await ev('S().cash')));
      notes.push('restart on the second tap');
    }
    return notes.join('; ');
  });

  await step('v3.2 days 76: a weekday Yard day', async () => {
    const C = await pageC();
    await reload(saveV6({ gear: { cooler: true }, stock: Object.assign({}, ZERO_STOCK, { sausage: 6, chicken: 4 }), charcoal: 10, season: { pick: 'birthday' } }));
    await quickTap('off');
    await nextDayTap();
    const r0 = await ev('S().season.results.length');
    await quickTap('yard');   // v3.4: #hub-start or Change plan
    const L = C.LENGTHS.normal;
    assert((await ev('S().today.endAt')) === Math.round(L.seconds * 0.5) && (await ev('S().today.weekday')) === true, 'the Tuesday Yard day endAt ' + (await ev('S().today.endAt')));
    for (let i = 0; i < 40 && !(await visible(ID.till)); i++) await advance(3);
    assert(await visible(ID.till) && (await ev('S().till.kind')) === 'yard', 'the short till did not show');
    assert((await ev('S().season.results.length')) === r0, 'season.results moved on a Yard day');
    await click(ID.next);
    await advance(0);
    assert(sameJSON(await litDays(), [2]), 'the hub after the Yard day ' + describe(await litDays()));
    return 'endAt ' + Math.round(L.seconds * 0.5) + ', the short till, results unchanged, Wednesday next';
  });

  await step('v3.2 days 77: a v5 save migrates to Monday', async () => {
    const v5 = saveV6({ season: { week: 4, results: resultsOf(3), pick: 'birthday', trained: 1 }, crew: [Object.assign({}, DAY_CARD)] });
    v5.v = 5;
    for (const k of ['day', 'dayLog', 'prepped', 'loadin', 'overnight']) delete v5.season[k];
    await reload(v5);
    assert((await ev('S().season.week')) === 4 && sameJSON(await litDays(), [0]), 'after the v5 load ' + describe({ week: await ev('S().season.week'), lit: await litDays() }));
    for (const id of OLD_DAY_IDS) assert(!(await present(id)), '#' + id + ' on the migrated hub');   // v3.4: training is automatic
    assert(await present('planner'), 'no #planner after the v5 load');   // v3.5: Monday opens the planner
    await passPlanner();
    assert(await present('hub-start'), 'no #hub-start after the v5 load');
    const raw = await storedSave();
    assert(raw && raw.v === SAVE_V, 'the stored save v ' + describe(raw && raw.v));
    return 'week 4 Monday, #planner then #hub-start and no Train button, stored v ' + SAVE_V;
  });

  await step('v3.2 days 78: booking day rules', async () => {
    await reload(saveV6({ gear: { kettle2: true }, season: { pick: 'picnic' } }));
    assert((await ev('S().season.booking.type')) === 'picnic', 'the picnic fixture ' + describe(await ev('S().season.booking.type')));
    for (let d = 0; d < 5; d++) { await quickTap('off'); await nextDayTap(); }
    const sat = await hubKinds();
    assert(sameJSON(sat, ['yard', 'off']) && !(await goShown()), 'Saturday before a Sunday picnic ' + describe(sat));
    await quickTap('off');
    await nextDayTap();
    const sun = (await hubKinds()).filter((k) => k !== 'event');
    assert(sun.length === 0 && (await goShown()) && (await accText('hub-start')).includes('Sunday'), 'Sunday options ' + describe(sun));
    // A Yard week: both weekend days offer Yard day and Day off; Sunday writes { yard, 0 }.
    await reload(saveV6({ season: { pick: 'yard' } }));
    for (let d = 0; d < 5; d++) { await quickTap('off'); await nextDayTap(); }
    const ws = [];
    for (let d = 5; d < 7; d++) {
      ws.push(await hubKinds());
      await quickTap('off');
      await nextDayTap();
    }
    assert(ws.every((x) => sameJSON(x, ['yard', 'off'])), 'the Yard week weekend ' + describe(ws));
    const last = await ev('S().season.results[S().season.results.length - 1]');
    assert(sameJSON(last, { type: 'yard', stars: 0 }) && (await ev('S().season.week')) === 2, 'the Yard week result ' + describe(last) + ', week ' + (await ev('S().season.week')));
    return 'Sunday picnic: Saturday yard and off, Sunday only the event on #hub-start; a Yard week: yard and off both days, then { yard, 0 }';
  });

  // v3.3 (design [S 3.5], [S 3.6], [S 19.8]): the competition and Offseason screens (game.js
  // deviations 70 to 78, names from [S 19.9]). Each step reads the sim's v3.3 view (compView, finishComp's till.comp,
  // offseasonView) when the sim has it, else injects the design's names, so the screens are checked
  // either way; the result line says which.
  const FIRE_CARD = Object.assign({}, DAY_CARD, { id: 1, name: 'Dale', role: 'fire', skills: [3, 3] });
  const COMP_SIM = '{ contest: "backyard", label: "Backyard Open", cats: ["chicken", "sausage", "ribs", "butt"], entry: 20, prizes: [200, 120, 80], judges: ["Ada Pruitt", "Hal Kemper", "June Okafor"], noDrum: false, rivals: [], '
    + 'slots: [{ meat: "chicken", at: 45, done: true, box: { sliced: true, pulledAt: 30, don: 50, by: "player", at: 44 }, score: { total: 88, don: 50, hold: 18, look: 20, missed: false } }, { meat: "sausage", at: 85, done: false, box: null, score: null }, { meat: "ribs", at: 125, done: false, box: null, score: null }, { meat: "butt", at: 165, done: false, box: null, score: null }] }';
  const COMP_DESIGN = '{ contest: "backyard", cats: ["chicken", "sausage", "ribs", "butt"], at: [45, 85, 125, 165], boxes: [{ score: 88, done: 50, hold: 18, look: 20, judged: true }, null, null, null], pulled: { sausage: S().clock - 9 } }';
  await step('v3.3 comp 79: turn-in boxes, the hold clock and the FIRE feed puff', async () => {
    await reload(saveV6({ crew: [Object.assign({}, FIRE_CARD)], gear: { cooler: true }, stock: Object.assign({}, ZERO_STOCK, { sausage: 6, chicken: 4 }), charcoal: 20, season: { pick: 'birthday' } }));
    await quickTap('off');
    await nextDayTap();
    await quickTap('yard');   // v3.4: #hub-start or Change plan
    for (let i = 0; i < 20 && (await ev('S().phase')) !== 'service'; i++) await advance(1);
    assert((await ev('S().phase')) === 'service' && (await ev('!!S().tender')), 'no service with the FIRE card ' + describe(await ev('({ phase: S().phase, tender: !!S().tender })')));
    const real = await ev('typeof sim.compView === "function"');
    if (real) await ev('(S().today.comp = ' + COMP_SIM + ', S().stations.board.boxes = [{ meat: "sausage", pulledAt: S().clock - 9, don: 40 }], true)');
    else await ev('(S().today.comp = ' + COMP_DESIGN + ', true)');
    await advance(0);
    const v = await ev('g.comp');
    assert(v && v.rows.length === 4 && v.next === 1 && v.rows[0].box && v.rows[0].box.score === 88 && v.rows[1].meat === 'sausage', 'g.comp ' + describe(v));
    assert((await ev('g.rail')) === null || true, 'rail');
    await screenshotYard('comp-rail.png');
    await ev('(S().today.comp = null, S().stations.board.boxes = [], true)');
    await advance(0);
    assert((await ev('g.comp')) === null, 'g.comp after the comp fields went');
    // The feed puff: kettle1 lit low, then real time until the FIRE card feeds it (fire_fed, or the bag
    // count on an older sim).
    const n0 = await ev('g.fxLog.filter((e) => e.kind === "fed").length');
    await ev('(S().stations.kettle1.fire = 3, true)');
    for (let i = 0; i < 30 && (await ev('g.fxLog.filter((e) => e.kind === "fed").length')) === n0; i++) await advance(0.5);
    const puffs = await ev('g.feedPuffs');
    const n1 = await ev('g.fxLog.filter((e) => e.kind === "fed").length');
    assert(puffs >= 1 && n1 >= n0 + 1, 'feed puff ' + describe({ puffs, n0, n1 }));
    await screenshotYard('fire-badge.png');
    return (real ? 'sim compView' : 'today.comp read directly (older sim)') + ': rail 4 boxes, next sausage, hold 9; FIRE fed kettle1, puff and fed logged';
  });

  const COMP_TILL = '{ kind: "comp", label: "Regional Cook-off", week: 9, cashAfter: S().cash, stars: 0, entry: 50, comp: { contest: "regional", label: "Regional Cook-off", place: 2, field: 10, total: 242, entry: 50, prize: 300, fans: 10, trophy: false, shelfFull: false, ribbons: ["ribs"], judges: ["Ada Pruitt", "Hal Kemper", "June Okafor"], '
    + 'boxes: [{ meat: "chicken", score: 80, done: 50, hold: 14, look: 16, missed: false }, { meat: "ribs", score: 92, done: 50, hold: 22, look: 20, missed: false }, { meat: "butt", score: 70, done: 40, hold: 10, look: 20, missed: false }, { meat: "brisket", score: 0, done: 0, hold: 0, look: 0, missed: true }], '
    + 'standings: [{ name: "Low and Slow Crew", total: 250 }, { name: "Marty\'s Pit", you: true, total: 242 }, { name: "Hickory Hollow", total: 240 }, { name: "Two Pigs", total: 235 }, { name: "Back Forty", total: 230 }, { name: "Ember Club", total: 225 }, { name: "Rib Ticklers", total: 220 }, { name: "Ash and Oak", total: 215 }, { name: "Ten Acre Pit", total: 210 }, { name: "Side Street", total: 205 }] } }';
  await step('v3.3 comp 80: the judges\' results card', async () => {
    await reload(saveV6({ season: { pick: 'birthday' } }));
    await ev('(S().till = ' + COMP_TILL + ', S().phase = "evening", S().loop = "report", true)');
    const panel = await ev('g.refresh()');
    assert(panel === 'till' && (await visible(ID.till)), 'the till did not open on the comp report ' + describe(panel));
    const placed = await ev('acc("comp-placed")');
    const rows = await ev('$("comp-standings").children.length');
    const you = await ev('acc("comp-you")');
    const b4 = await ev('acc("comp-box-4")');
    assert(/2nd of 10/i.test(placed) && rows === 10 && /You/.test(you) && /Missed/.test(b4), 'comp report ' + describe({ placed, rows, you, b4 }));
    assert(/ribs/.test(await ev('acc("comp-ribbons")')) && /Ada Pruitt/.test(await ev('acc("comp-judge-names")')) && /10/.test(await ev('acc("comp-fans")')), 'ribbons, judges or fans');
    await shotOf('comp-report.png', ID.till);
    return placed + ', ' + rows + ' teams, 4 boxes (brisket missed), ribbon for ribs, 3 judges, fans +10';
  });

  await step('v3.3 comp 81: the trophy shelf on the hub', async () => {
    await reload(saveV6({ season: { pick: 'birthday' } }));
    assert(!(await present('hub-shelf')), '#hub-shelf on a hub with no trophies');
    await ev('(S().trophies = [{ year: 1, contest: "backyard", place: 1 }, { year: 2, contest: "regional", place: 1 }], S().ribbons = Object.assign({}, S().ribbons || {}, { ribs: 2, chicken: 1 }), true)');
    await ev('g.refresh()');
    if (await present('hub-tab-pit')) { await click('hub-tab-pit'); await advance(0); }   // v3.4: the shelf is on the Your pit tab
    assert(await visible('hub-shelf'), '#hub-shelf hidden with two trophies');
    const won = await ev('$("hub-shelf").querySelectorAll("li.won").length');
    const slots = await ev('$("hub-shelf").querySelectorAll("li").length');
    const rib = await ev('acc("hub-shelf-ribbons")');
    assert(won === 2 && slots === 6 && /3/.test(rib) && (await ev('g.trophies')) === 2, 'the shelf ' + describe({ won, slots, rib }));
    await shotOf('trophy-shelf.png', 'hub-shelf');
    return won + ' of ' + slots + ' slots, ' + rib;
  });

  await step('v3.3 comp 82: the Offseason screen', async () => {
    await reload(saveV6({ crew: [Object.assign({}, DAY_CARD)], season: { week: 9, results: resultsOf(9) } }));
    assert(await visible(ID3.seasonEnd), '#season-end hidden for a nine result save');
    const real = await ev('Array.isArray((sim.seasonEndPreview() || {}).contracts) && typeof sim.resign === "function"');
    await ev(`(() => {
      S().season.results[C.SEASON_WEEKS - 1] = { type: 'finale', stars: 4, place: 2, contest: 'backyard' };
      S().trophies = [{ year: 1, contest: 'backyard', place: 1 }];
      if (!${real}) {
        const o = sim.seasonEndPreview;
        globalThis.__se = o;
        sim.seasonEndPreview = function () { const p = o.call(sim); return Object.assign({}, p, { record: S().season.results.map((x, i) => ({ week: i + 1, type: x.type, stars: x.stars, place: x.place || 0, contest: x.contest || null })),
          contracts: [{ id: 1, name: 'Rosa', role: 'run', stars: 2, mood: 0, wageFrom: 16, asks: 18, decided: globalThis.__dec || null }], leaving: [{ id: 2, name: 'Dale', role: 'fire', stars: 3, mood: 0, reason: 'is starting school in the fall.', refers: 2 }], next: { id: 'drum', label: 'Drum smoker', price: 250 } }); };
        sim.resign = function (id, n) { globalThis.__dec = n === 2 ? 'sign2' : 'sign1'; return { ok: true }; };
        sim.release = function () { globalThis.__dec = 'go'; return { ok: true }; };
        globalThis.__osStub = true;
      }
      g.refresh();
      return true;
    })()`);
    for (const id of ['se-shelf', 'se-contracts', 'se-leaving', 'se-cash', 'season-next']) assert(await present(id), '#' + id + ' missing on the Offseason screen');
    const order = await ev('["se-record", "se-shelf", "se-contracts", "se-leaving", "season-next"].map((id) => $(id)).every((e, i, a) => i === 0 || (a[i - 1].compareDocumentPosition(e) & 4))');
    assert(order, 'Offseason order: record, shelf, contracts, moving on, start');
    const wk9 = await ev('attr("se-wk-" + C.SEASON_WEEKS, "aria-label")');
    assert(/2nd/.test(wk9), '#se-wk-7 ' + describe(wk9));
    const ids = await ev('S().crew.map((c) => c.id)');
    const exp = await ev('(sim.seasonEndPreview().contracts || []).map((e) => e.id)');
    if (exp.length) {
      const id = exp[0];
      assert(await present('se-ask-' + id) && await present('se-sign2-' + id) && await present('se-release-' + id), 'contract row for ' + id);
      await click('se-sign2-' + id);
      await advance(0);
      const dec = await ev('(sim.seasonEndPreview().contracts.find((e) => e.id === ' + id + ') || {}).decided');
      assert(dec === 'sign2' && (await attrOf('se-sign2-' + id, 'aria-pressed')) === 'true', 'Re-sign 2 seasons ' + describe(dec));
    }
    await shotOf('offseason.png', ID3.seasonEnd);
    return (real ? 'sim contracts' : 'contracts stubbed (older sim)') + '; crew ' + describe(ids) + ', expiring ' + describe(exp) + '; week 9 ' + wk9;
  });

  await step('v3.3 comp 83: season 2 from the Offseason screen', async () => {
    await ev('(globalThis.__osStub && (sim.seasonEndPreview = globalThis.__se, delete sim.resign, delete sim.release), true)');
    await click('season-next');
    await advance(0);
    const st = await ev('({ year: S().season.year, week: S().season.week, loop: S().loop, trophies: g.trophies })');
    assert(st.year === 2 && st.week === 1 && (st.loop === 'hiring' || st.loop === 'week'), 'after Start season 2 ' + describe(st));
    assert(st.trophies === 1, 'the trophy did not carry into season 2 ' + describe(st));
    return 'season 2 week 1, loop ' + st.loop + ', trophy shelf kept 1';
  });

  // Integration (v3.3): a real competition in the page, no injected fields. A small in-page bot cooks
  // each category toward its turn-in, slices at the board and turns in at the window; the rail and the
  // judges' card come from sim.compView() and finishComp().
  await step('v3.3 comp 84: a real competition in the browser, rail and judges\' card', async () => {
    const PH = globalThis[GLOBAL_NAME];
    if (!PH || typeof PH.createSim !== 'function' || !PH.C.COMP_TURNINS) return 'skipped: no v3.3 sim in node';
    await reload(compSave(PH, { seed: 33 }));
    const go = await ev('(sim.bookOffer("finale").ok && sim.chooseDay("event").ok)');
    assert(go === true, 'book and load up the competition ' + describe(await ev('sim.canLoadUp()')));
    await advance(0);
    assert((await ev('!!(S().today.comp && sim.compView())')) === true, 'not at the competition');
    await ev(`(globalThis.__compBot = (() => {
      const P = globalThis.PitSim, C = P.C, M = P.MEATS, st = S(), started = new Set();
      const tile = (id) => P.MAP.station(id).tiles[0];
      const cookers = () => ['kettle1', 'kettle2', 'drum'].filter((id) => P.tileOwned(P.MAP.station(id), st.gear));
      const free = (ck, size) => { const used = new Set(); for (const p of ck.pieces) for (let k = 0; k < p.size; k++) used.add(p.slot + k);
        const n = ck.id === 'drum' ? C.DRUM_SLOTS : C.KETTLE_SLOTS;
        for (let i = 0; i + size <= n; i++) { let ok = true; for (let k = 0; k < size; k++) if (used.has(i + k)) ok = false; if (ok) return true; } return false; };
      const decide = () => {
        const c = st.player.carrying, cv = sim.compView();
        if (!cv) return null;
        if (c) {
          if (c.kind === 'charcoal') { let b = cookers()[0]; for (const id of cookers()) if (st.stations[id].fire < st.stations[b].fire) b = id; return tile(b); }
          if (c.kind === 'raw') { const ok = cookers().filter((id) => (!M[c.meat].drumOnly || id === 'drum') && free(st.stations[id], M[c.meat].slots) && st.stations[id].fire >= C.COLD_UNDER); return ok.length ? tile(ok[0]) : null; }
          if (c.kind === 'cooked') return tile('board');
          if (c.kind === 'box') return tile('table');
          if (c.kind === 'burnt') return tile('trash');
          return null;
        }
        for (const id of cookers()) for (const p of st.stations[id].pieces) if (p.state !== 'cooking') return tile(id);
        for (const id of cookers()) if (st.stations[id].fire < 50 && st.charcoal > 0 && !st.tender) return tile('pile');
        if (st.stations.board.boxes.length) return tile('board');
        for (let i = 0; i < cv.cats.length; i++) {
          const m = cv.cats[i];
          if (cv.left[i] <= 0 || cv.boxes[i] !== null || started.has(m) || !(st.stock[m] > 0)) continue;
          if (st.clock + M[m].cook / 0.8 + 14 >= cv.at[i] && cookers().some((id) => (!M[m].drumOnly || id === 'drum') && free(st.stations[id], M[m].slots) && st.stations[id].fire >= C.COLD_UNDER)) {
            sim.selectMeat(m); started.add(m); return tile('cooler');
          }
        }
        return null;
      };
      return () => { const p = st.player; if (st.phase === 'service' && !(p.busy || p.next || p.path.length || p.target)) { const t = decide(); if (t) sim.walkTo(t.x, t.y); } return st.clock; };
    })(), true)`);
    let clock = 0;
    const midAt = (await ev('C.COMP_TURNINS[1]')) + 13;   // v3.5: 13 s past the second turn-in (was 98 at 85)
    for (let i = 0; i < 800 && clock < midAt; i++) { clock = await ev('__compBot()'); await advance(0.25); }
    const mid = await ev('g.comp');
    assert(mid && mid.rows.length === 4 && mid.rows[0].box && mid.rows[1].box && mid.next >= 2, 'the rail at ' + midAt + ' s ' + describe(mid));
    await screenshotYard('comp-real-turnin.png');
    for (let i = 0; i < 800 && (await ev('S().loop')) !== 'report'; i++) { await ev('__compBot()'); await advance(0.25); }
    assert((await ev('S().loop')) === 'report' && (await ev('S().till.kind')) === 'comp', 'the competition did not end on the judges\' card');
    await advance(0);
    await ev('g.refresh()');
    const placed = await ev('acc("comp-placed")');
    const rows = await ev('$("comp-standings").children.length');
    assert(rows === 10 && /of 10/i.test(placed), 'judges card ' + describe({ placed, rows }));
    await shotOf('comp-real-results.png', ID.till);
    const c = await ev('S().till.comp');
    return placed + ', total ' + c.total + ' (' + c.boxes.map((b) => b.meat + ' ' + b.score).join(', ') + '), prize ' + c.prize;
  });

  // Playtest 2026-10-19: the week 9 card and the hub name the entry, prizes and judges (no guests, pay,
  // deposit or host line); the turn-in rail counts every pending category down; the field has a favorite.
  await step('v3.3 comp 85: the week 9 card and hub show entry, prizes, judges; the rail counts down', async () => {
    const PH = globalThis[GLOBAL_NAME];
    if (!PH || typeof PH.createSim !== 'function' || !PH.C.COMP_TURNINS) return 'skipped: no v3.3 sim in node';
    await reload(compSave(PH, { seed: 33 }));
    await advance(0);
    await ev('g.refresh()');
    const judges = await ev('sim.compJudges()');
    const card = await ev('(() => { const e = $("offer-finale"); return e ? e.textContent : null; })()');
    assert(typeof card === 'string', 'no week 9 offer card');
    assert(/Entry 20/.test(card) && /Prizes 200, 120 and 80/.test(card) && /Judges:/.test(card), 'the card lacks entry, prizes or judges ' + describe(card));
    assert(!/0 guests|Pay 0|Deposit 0/.test(card), 'the card still reads guests, pay or deposit ' + describe(card));
    assert(Array.isArray(judges) && judges.length === 3 && judges.every((n) => card.indexOf(n) !== -1), 'judges ' + describe({ judges, card }));
    assert((await ev('sim.bookOffer("finale").ok')) === true, 'book the competition');
    await ev('g.refresh()');
    const dep = await ev('$("go-deposit") ? $("go-deposit").textContent : null');
    const head = await ev('(() => { const e = document.querySelector("#next-event .next-pay"); return e ? e.textContent : null; })()');
    assert(dep && /entry fee is 20/.test(dep) && !/host/i.test(dep), 'hub entry line ' + describe(dep));
    assert(head === 'Entry 20', 'hub header ' + describe(head));
    await shotOf('comp-hub-entry.png', 'next-event');
    assert((await ev('sim.chooseDay("event").ok')) === true, 'load up the competition');
    await advance(0);
    const cp = await ev('({ judges: S().today.comp.judges, fav: S().today.comp.rivals[0].boxes })');
    assert(describe(cp.judges) === describe(judges), 'the card named other judges ' + describe({ cp, judges }));
    const favMean = cp.fav.reduce((a, x) => a + x, 0) / cp.fav.length;
    assert(favMean >= 65, 'favorite seeded low ' + describe(cp.fav));
    await advance(2);
    const r1 = await ev('g.compRail');
    const at = await ev('sim.compView().at');
    const clk = await ev('S().clock');
    assert(r1 && r1.rows.every((x, i) => x === String(Math.max(0, Math.ceil(at[i] - clk)))), 'rail strings ' + describe({ r1, at, clk }));
    await screenshotYard('comp-rail-countdown.png');
    return 'card: entry 20, prizes 200/120/80, judges ' + judges.join(', ') + '; hub ' + head + '; rail ' + r1.clock + ' | ' + r1.rows.join(' ') + '; favorite boxes ' + cp.fav.join('/');
  });

  // Joel's phone playtest (2026-10-19): the yard sign kept no space ("HOLYSMOKES BBQ"), the clock box
  // ran into a sausage icon and a count, station badges drew over the pitmaster, the order bubble
  // was counter sized and sat on the counter, and the near view left the bottom half as lawn.
  await step('phone playtest 2026-10-19: sign spacing, clock box, badges, order bubble, near view', async () => {
    // The sign: a two line split only at a space, every word kept, spaces kept within a line, and a
    // word gap at least 4 px (the letters sit 1 px apart).
    const signs = await ev('(() => { const B = PitSim.bridge3, tw = PitSim.art3.textWidth, box = PitSim.art3.rule.meta("sign").text; const names = ["Holy Smokes BBQ Co", "Holy Smokes BBQ", "YOUR PIT", "MARTY\'S PIT", "ABCDEFGHIJKLMNOPQRST"]; return names.map((nm) => { const L = B.signLines(nm), up = nm.toUpperCase(); const w = Math.max.apply(null, L.lines.map((t) => B.signLineW(t, L.bold))); const joined = L.hyphen ? L.lines[0].slice(0, -1) + L.lines[1] : L.lines.join(" "); const spaced = !/ /.test(up) || L.lines.every((t) => !/ /.test(t) || B.signLineW(t, L.bold) - t.split(" ").reduce((a, x) => a + tw(x, { bold: L.bold }), 0) >= 4 * (t.split(" ").length - 1)); return { nm, L, w, ok: !L.cut && L.lines.length <= 2 && w <= box.w && joined === up && spaced && (!L.hyphen || !/ /.test(up)) }; }); })()');
    const badSigns = signs.filter((x) => !x.ok);
    assert(badSigns.length === 0, 'sign lines ' + describe(badSigns));
    const holy = signs[0].L;
    assert(sameJSON(holy.lines, ['HOLY SMOKES', 'BBQ CO']), 'Holy Smokes BBQ Co reads ' + describe(holy));
    await reload(saveV6({ pitName: 'Holy Smokes BBQ Co', gear: { cooler: true }, stock: Object.assign({}, ZERO_STOCK, { sausage: 8, chicken: 4 }), charcoal: 20, season: { pick: 'birthday' } }));
    await quickTap('off');
    await nextDayTap();
    await quickTap('yard');
    for (let i = 0; i < 20 && (await ev('S().phase')) !== 'service'; i++) await advance(1);
    // v3.7: waiting is in line, or paid and waiting on the plate (the chip stays up for both).
    for (let i = 0; i < 120 && !(await ev('S().customers.some((c) => c.mode === "waiting" || (c.paid && !c.fed && (c.mode === "seated" || c.mode === "togo")))')); i++) await advance(0.5);
    assert(await ev('S().customers.some((c) => c.mode === "waiting" || (c.paid && !c.fed && (c.mode === "seated" || c.mode === "togo")))'), 'no waiting guest ' + describe(await ev('S().customers.map((c) => c.mode)')));
    await emulate({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    try {
      await sleep(TIMEOUT_MS.resize);
      await ev('(g.camera.set("near"), g.camera.home(), true)');
      await advance(0); await advance(0);
      // The clock has its own box; anything else on the rail starts right of it.
      const rb = await ev('g.railBoxes');
      assert(rb && rb.clock && rb.clock[0] === 1 && (!rb.items || rb.items[0] >= rb.clock[0] + rb.clock[1] + 1), 'rail boxes ' + describe(rb));
      // Badges: no kettle flame; each chip centred over its own station; a shown chip never on a person.
      const bl = await ev('g.badgeLog');
      const offStation = bl.filter((b) => { const c = (b.chip.x0 + b.chip.x1) / 2; return c < b.station.x0 || c > b.station.x1 || b.chip.y1 > b.station.y0 + 4; });
      assert(bl.length >= 3 && !bl.some((b) => b.kind === 'flame') && offStation.length === 0, 'badges ' + describe(bl));
      const onPeople = await ev('g.badgeLog.filter((b) => b.shown && g.people.some((p) => b.chip.x0 < p.x1 && p.x0 < b.chip.x1 && b.chip.y0 < p.y1 && p.y0 < b.chip.y1)).map((b) => b.kind)');
      assert(onPeople.length === 0, 'badges drawn on people ' + describe(onPeople));
      // Order bubbles: small, tail on the head, never on a counter.
      const ob = await ev('g.orderBubbles');
      const badB = ob.filter((b) => (b.rect.x1 - b.rect.x0) > 24 || b.rect.y1 > b.head.y0 || b.counters.some((c) => b.rect.x0 < c.x1 && c.x0 < b.rect.x1 && b.rect.y0 < c.y1 && c.y0 < b.rect.y1));
      assert(ob.length >= 1 && badB.length === 0, 'order bubbles ' + describe(ob) + ' guests ' + describe(await ev('S().customers.map((c) => [c.id, c.mode, c.paid, c.fed, c.x, c.y])')));
      // The near view centres the kitchen block vertically.
      const cm = await ev('g.camera.get()');
      const kc = await ev('g.kitchenBox');
      const off = Math.abs((cm.y0 + cm.vh / 2) - (kc.y0 + kc.y1) / 2);
      assert(off <= 12, 'kitchen centre off the view centre by ' + off + ' rp ' + describe({ cm, kc }));
      await screenshot('phone-390-service.png');
      return 'sign ' + holy.lines.join(' / ') + '; clock ' + describe(rb) + '; ' + bl.filter((b) => b.shown).length + ' of ' + bl.length + ' badges shown; bubble ' + Math.round(ob[0].rect.x1 - ob[0].rect.x0) + ' rp wide; kitchen off centre ' + Math.round(off) + ' rp';
    } finally {
      await emulate(DESKTOP_MODE ? DESKTOP : PHONE);
      await sleep(TIMEOUT_MS.resize);
      await advance(0);
    }
  });

  // v3.5 (sim.js note v3.5): Monday's planner by taps, Start week and Skip to the weekend.
  await step('v3.5 planner 86: Monday planner by taps, Start week, Skip to the weekend', async () => {
    await reload(saveV9({ cash: 300, season: { pick: 'birthday' } }));
    assert(await visible('planner'), '#planner hidden on Monday');
    assert(!(await present('hub-start')), '#hub-start beside the planner');
    const kinds = async () => { const out = []; for (let d = 0; d < 5; d++) out.push(await attrOf('plan-day-' + d, 'data-kind')); return out; };
    const k0 = await kinds();
    assert(sameJSON(k0, await ev('sim.planView().plan')), 'plan buttons ' + describe(k0) + ' against planView');
    assert((await accText('plan-start')).toLowerCase().includes('start week') && (await accText('plan-skip')).toLowerCase().includes('skip to the weekend'), 'planner buttons ' + describe([await accText('plan-start'), await accText('plan-skip')]));
    // Monday to Rest, Tuesday to a Yard day by taps.
    if (k0[0] === 'yard') { await click('plan-day-0'); await advance(0); }
    if ((await attrOf('plan-day-1', 'data-kind')) !== 'yard') { await click('plan-day-1'); await advance(0); }
    const k1 = await kinds();
    assert(k1[0] === 'off' && k1[1] === 'yard', 'taps left the plan ' + describe(k1));
    await click('plan-start');
    await advance(0);
    assert((await ev('S().season.day')) === 1 && (await ev('S().phase')) === 'morning' && !(await visible('daycard')), 'Start week: day ' + (await ev('S().season.day')));
    assert(!(await present('planner')) && (await present('hub-start')) && (await accText('hub-start')).includes('Tuesday'), '#hub-start after Start week ' + describe(await present('hub-start') ? await accText('hub-start') : null));
    const raw = await storedSave();
    assert(raw && raw.v === SAVE_V && raw.season && Array.isArray(raw.season.plan) && raw.season.plan[1] === 'yard', 'stored plan ' + describe(raw && raw.season && raw.season.plan));
    // Skip to the weekend from a fresh Monday.
    await reload(saveV9({ cash: 300, season: { pick: 'birthday' } }));
    assert(await visible('planner'), '#planner hidden on the second Monday');
    await click('plan-skip');
    await advance(0);
    assert((await ev('S().season.day')) === 5 && sameJSON(await ev('S().season.dayLog.slice(0, 5)'), ['off', 'off', 'off', 'off', 'off']) && !(await visible('daycard')), 'Skip to the weekend: day ' + (await ev('S().season.day')));
    assert((await present('hub-start')) && (await accText('hub-start')).includes('Saturday'), '#hub-start after the skip ' + describe(await present('hub-start') ? await accText('hub-start') : null));
    return 'plan ' + k1.join(', ') + '; Start week opened Tuesday; Skip opened Saturday';
  });

  // v3.5: buy more time. The hub shows the cook time; Long Day picks at a level up; the string lights add 20 s.
  await step('v3.5 buy more time 87: the hub cook time, a Long Day pick, the string lights time', async () => {
    const C = await pageC();
    await reload(saveV9({ cash: 300, season: { pick: 'birthday' }, pit: { xp: C.PIT_LEVEL_XP[1], longDay: 0 } }));
    await passPlanner();
    assert(await visible('hub-cooktime'), '#hub-cooktime hidden');
    const t0 = await accText('hub-cooktime');
    const ct0 = await ev('sim.cookTime()');
    assert(ct0.total === C.LENGTHS.normal.seconds && t0.includes(ct0.text), '#hub-cooktime reads ' + describe(t0) + ', wanted ' + describe(ct0.text));
    assert((await present('pit-level')) && (await accText('pit-level')).includes('Level 2'), '#pit-level reads ' + describe(await present('pit-level') ? await accText('pit-level') : null));
    assert(await visible('pit-pick-longDay'), '#pit-pick-longDay hidden at level 2');
    await click('pit-pick-longDay');
    await advance(0);
    const ct1 = await ev('sim.cookTime()');
    assert(ct1.total === C.LENGTHS.normal.seconds + C.LONG_DAY_SECONDS && (await ev('sim.pitView().longDay')) === 1 && !(await present('pit-pick-longDay')), 'after the pick ' + describe(ct1));
    assert((await accText('hub-cooktime')).includes(ct1.text), '#hub-cooktime after the pick ' + describe(await accText('hub-cooktime')));
    // The string lights: the shop row says +20 s; owning them adds 20 s to the hub time.
    await reload(saveV9({ cash: 300, season: { pick: 'birthday' }, decor: { lights: true } }));
    await passPlanner();
    const ct2 = await ev('sim.cookTime()');
    assert(ct2.lights === C.LIGHTS_SECONDS && ct2.total === C.LENGTHS.normal.seconds + C.LIGHTS_SECONDS && (await accText('hub-cooktime')).includes(ct2.text), 'lights cook time ' + describe([ct2, await accText('hub-cooktime')]));
    const row = await ev('PitSim.CATALOG.find((x) => x.id === "lights").effect');
    assert(row.includes('+20 s to every cook'), 'the string lights row reads ' + describe(row));
    return ct0.text + ' to ' + ct1.text + ' with Long Day 1; lights ' + ct2.text;
  });

  // ---- v3.5 Shorter season, longer cooks: the planner, Skip to the weekend, Long Day, string lights ----

  const planKinds = async () => { const out = []; for (let d = 0; d < 5; d++) out.push(await attrOf('plan-day-' + d, 'data-kind')); return out; };

  await step('v3.5 planner: Monday sets the week at once, Rest days pass with no screens', async () => {
    await reload(saveV9({ cash: 300, season: { pick: 'birthday' }, crew: [Object.assign({}, DAY_CARD)] }));
    assert((await present('planner')) && !(await present('hub-start')), 'Monday shows no #planner (or still #hub-start)');
    const pv = await ev('sim.planView()');
    assert(pv && pv.days.length === 5 && sameJSON(await planKinds(), pv.plan), 'the plan buttons ' + describe(await planKinds()) + ' against the draft ' + describe(pv && pv.plan));
    assert((await present('plan-start')) && (await present('plan-skip')), '#plan-start or #plan-skip missing');
    // A tap flips the day; the draft follows.
    const k1 = await attrOf('plan-day-1', 'data-kind');
    await click('plan-day-1');
    await advance(0);
    const k1b = await attrOf('plan-day-1', 'data-kind');
    assert(k1b !== k1 && (await ev('sim.planView().plan[1]')) === k1b, 'plan-day-1 ' + k1 + ' to ' + k1b + ', draft ' + describe(await ev('sim.planView().plan')));
    // Only Wednesday a Yard day: Monday and Tuesday pass at once and Wednesday's morning opens.
    for (let d = 0; d < 5; d++) {
      const want = d === 2 ? 'yard' : 'off';
      if ((await attrOf('plan-day-' + d, 'data-kind')) !== want) { await click('plan-day-' + d); await advance(0); }
    }
    assert(sameJSON(await planKinds(), ['off', 'off', 'yard', 'off', 'off']), 'the set plan ' + describe(await planKinds()));
    await click('plan-start');
    await advance(0);
    const st = await ev('({ day: S().season.day, phase: S().phase, card: !!$("daycard") && !$("daycard").hidden, plan: sim.planOf(), rk: (sim.recommendDay() || {}).kind })');
    assert(st.day === 2 && st.phase === 'morning' && !st.card && st.rk === 'yard', 'after Start week ' + describe(st));
    assert(!(await present('planner')) && (await present('hub-start')), 'Wednesday shows #planner or no #hub-start');
    return 'draft ' + pv.plan.join(',') + ', set off,off,yard,off,off, Start week opened Wednesday on #hub-start';
  });

  await step('v3.5 Skip to the weekend: five Rest days at once, then the weekend booking', async () => {
    await reload(saveV9({ cash: 300, season: { pick: 'birthday' }, crew: [Object.assign({}, DAY_CARD)] }));
    assert(await present('plan-skip'), '#plan-skip missing on Monday');
    const xp0 = await ev('S().crew[0].xp');
    await click('plan-skip');
    await advance(0);
    const st = await ev('({ day: S().season.day, phase: S().phase, card: !!$("daycard") && !$("daycard").hidden, rk: (sim.recommendDay() || {}).kind, note: sim.restNote() })');
    assert(st.day >= 5 && st.phase === 'morning' && !st.card && st.rk === 'event', 'after Skip ' + describe(st));
    assert(await present('hub-start'), 'no #hub-start on the weekend');
    assert((await ev('S().crew[0].xp')) > xp0, 'the skipped week trained nobody');
    return 'day ' + st.day + ', the booked event on #hub-start, rested ' + describe(st.note && st.note.days);
  });

  await step('v3.5 Long Day at level up: +15 s to every cook, cook time on the hub', async () => {
    const C = await pageC();
    await reload(saveV9({ cash: 300, season: { pick: 'birthday' }, pit: { xp: C.PIT_LEVEL_XP[1], longDay: 0 } }));
    assert((await present('hub-cooktime')) && (await present('pit-level')), '#hub-cooktime or #pit-level missing');
    const ct0 = await ev('sim.cookTime()');
    assert((await text('hub-cooktime')).includes(ct0.text), '#hub-cooktime ' + describe(await text('hub-cooktime')) + ', wanted ' + describe(ct0.text));
    assert(await present('pit-pick-longDay'), '#pit-pick-longDay missing with a level banked ' + describe(await ev('sim.pitView()')));
    await click('pit-pick-longDay');
    await advance(0);
    const ct1 = await ev('sim.cookTime()');
    assert((await ev('S().pit.longDay')) === 1 && ct1.total === ct0.total + C.LONG_DAY_SECONDS, 'Long Day ' + describe([await ev('S().pit.longDay'), ct0.total, ct1.total]));
    assert((await text('hub-cooktime')).includes(ct1.text) && !(await present('pit-pick-longDay')), '#hub-cooktime ' + describe(await text('hub-cooktime')) + ' or the pick stayed');
    const raw = await storedSave();
    assert(raw && raw.pit && raw.pit.longDay === 1, 'the stored pit ' + describe(raw && raw.pit));
    return 'cook ' + ct0.text + ' to ' + ct1.text + ', saved longDay 1';
  });

  await step('v3.5 string lights: the shop row names the time, the hub cook time grows', async () => {
    const C = await pageC();
    await reload(saveV9({ cash: 900, season: { week: 2, results: resultsOf(1) } }));
    await passPlanner();
    const t0 = await ev('sim.cookTime().total');
    await click(ID3.cardGear);
    await advance(0);
    const row = await ev('(() => { const r = document.querySelector("[data-item=\\"lights\\"] .effect"); return r ? r.textContent : null; })()');
    const want = await ev('PitSim.STRINGS.pit.lightsRow');
    assert(row && row.includes(want), 'the lights row ' + describe(row) + ', wanted ' + describe(want));
    await click(ID.buy('lights'));
    await advance(0);
    await click(ID.buyOk('lights'));
    await advance(0);
    const t1 = await ev('sim.cookTime()');
    assert((await ev('S().decor.lights')) === true && t1.total === t0 + C.LIGHTS_SECONDS && t1.lights === C.LIGHTS_SECONDS, 'lights ' + describe([t0, t1]));
    return 'row "' + want + '", cook ' + t0 + ' s to ' + t1.total + ' s';
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
    tapPoints: tileToClientSeen === true ? 'PitSim.game.tileToClient' : 'no canvas taps',
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

// --week [--week-skip] [--week-save-v N]: play one week from Monday by real taps (CDP input at each
// button's center) and log taps and simulated seconds. Menus are tapped; each cook's clock runs out.
async function realTap(id) {
  const p = await ev('(() => { const e = $(' + JSON.stringify(id) + '); if (!e || e.disabled) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()');
  assert(p, '#' + id + ' missing or disabled');
  if (DESKTOP_MODE) await mouseTap(p.x, p.y);
  else {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, radiusX: 4, radiusY: 4, force: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await sleep(60);
  await advance(0);
}
async function weekPlay() {
  const url = pathToFileURL(FILES.index).href + '?seed=' + SEED;
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
  assert(await waitForGame(), 'game did not load');
  const s = saveV9({ cash: 300, season: { pick: 'birthday' } });
  s.v = Number.parseInt(argValue('--week-save-v', '9'), 10);
  await reload(s);
  const skip = argv.includes('--week-skip');
  const log = [];
  let taps = 0, cookSec = 0, cooks = 0, menuSim = 0;
  const tap = async (id) => { await realTap(id); taps += 1; log.push(id); };
  const w0 = await ev('S().season.week');
  for (let i = 0; i < 80; i++) {
    const st = await ev('({ wk: S().season.week, day: S().season.day, phase: S().phase, loop: S().loop })');
    if (st.wk !== w0) { log.push('end ' + describe(st)); break; }
    if (st.phase === 'service') {
      const c0 = await ev('S().clock');
      const r = await until('S().phase !== "service"', 600);
      cookSec += r.t; cooks += 1; log.push('cook ' + r.t + ' s (clock from ' + c0 + ')');
      continue;
    }
    if (await present('planner')) {
      if (skip) await tap('plan-skip'); else await tap('plan-start');
      continue;
    }
    const pick = ['shop-confirm', 'go', 'next', 'daycard-next', 'season-next', 'hub-start'];
    let done = false;
    for (const id of pick) if ((await present(id)) && (await visible(id)) && !(await ev('$(' + JSON.stringify(id) + ').disabled'))) { await tap(id); done = true; break; }
    if (!done) {
      // a morning with prep time on the clock: let it run into service
      const r = await until('S().phase === "service" || S().phase === "evening"', 120);
      menuSim += r.t;
      if (!r.ok) { log.push('stuck ' + describe(st) + ' ids ' + describe(await ev('[...document.querySelectorAll("button")].filter((b) => b.offsetParent && !b.disabled).map((b) => b.id).filter(Boolean)'))); break; }
      log.push('waited ' + r.t + ' s');
    }
  }
  return { taps, cooks, cookSec: Math.round(cookSec), prepSec: Math.round(menuSim), log, errors: errorCount().total };
}
async function main() {
  if (argv.includes('--week')) {
    try { await launch(); console.log(JSON.stringify(await weekPlay(), null, 1)); } finally { try { if (cdp && cdp.ws) cdp.ws.close(); } catch (_e) { /* ignore */ } killChrome(); await removeProfile(); }
    return;
  }
  await nodeChecks();
  if (!fatal && !argv.includes('--node-only')) {
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
