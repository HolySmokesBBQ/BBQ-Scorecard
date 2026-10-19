// games/pit-sim/dev/econ.mjs
// Economy bot for the pit sim, v3.0 (contract docs/superpowers/specs/2026-10-18-pit-sim-v3-0-contract.md,
// W20 and W22.19 to W22.22; design [S 10.3]). Dev only, never shipped, not a harness step, but the
// v3.0 round passes only when `--season` exits 0 as well. Drives the real PitSim.createSim from
// ../sim.js through public methods only (the same calls a player makes, plus sim.settle(stars), the
// dev and harness fast path of W8.4). It never writes sim.state.
//
// Two modes.
//
// 1. Day runs (kept from v2.1, now through the week): skip the tutorial, finish the creator with the
//    default look, then every event is a Yard day booked from the week hub (bookOffer('yard'),
//    the v2.1 competent morning, loadUp()), played tick by tick by the competent bot (the
//    section 20.1 policy: quickest meat first, fire kept above 50, pull on done, carry the plate
//    someone waits for, buy about 1.1 times the expected crowd, hold a day's reserve before gear,
//    buy in the order second kettle, cooler, buddy at word of mouth 45, bigger table, drum, tray,
//    canopy). Week 9 is the Season finale (offers[0]), played by the same bot on the prefilled
//    rail meats and tagged `finale`; at the season end the bot calls startSeason() and goes on.
//      node games/pit-sim/dev/econ.mjs                  seed 1, 10 events, then seeds 1 to 8 summary
//      node games/pit-sim/dev/econ.mjs --days 20 --seed 3
//      node games/pit-sim/dev/econ.mjs --decor          also buys decor once gear is covered
//      node games/pit-sim/dev/econ.mjs --seeds 1-24     summary over a seed range
//
// 2. The season bot (W20): whole seasons with forced client stars per policy.
//      node games/pit-sim/dev/econ.mjs --season [--seeds 50] [--seasons 5] [--length normal] [--verbose] [--trace]
//    Policies by forced stars: sharp 5, steady 3, rough 2. Each week, in the W22.19 order: pick
//    (sharp and steady the highest pay safe offer; rough the Yard day while word of mouth is under
//    C.DRIVEWAY_REP, else the highest pay safe offer it can load up; week 9 always the finale),
//    read the prefilled cart, empty it, spend down the order kettle2, drum, tray, cooler, canopy,
//    bigtable, then decor (chair1, lights, chair2, picnic2, flowers, birdbath) while
//    cash - price >= reserve, hire (the buddy once the drum is owned and cash is 200 or more, the
//    fire tender once the cooler is owned), book again to re-prefill, loadUp(), then settle(stars)
//    on a booking or play the Yard day with the competent bot, then finishReport().
//    Milestones per seed in absolute weeks, printed S{season}W{week}: drum (first week owned),
//    drivewayAffordable (first week start with the drum, word of mouth >= C.DRIVEWAY_REP and cash
//    >= C.DRIVEWAY_PRICE), cash at each season end. Medians over seeds per policy are checked
//    against the [S 10.3] bands: drum by S1W4 (sharp), S1W8 (steady), S2W9 (rough) are enforced;
//    drivewayAffordable against S1W9, S2W4, S3W9 is information until v3.3. Global rules, enforced
//    per seed: never stuck (cash at week start under the Birthday's prefill meat cost on an empty
//    cooler two weeks in a row, a refused loadUp on both the pick and the Yard day, or rough ending
//    an event under 0 before the CASH_FLOOR clamp), never idle (at each season boundary, right after
//    the week 1 spend pass, cash - reserve above twice the price of the earliest unbought item of
//    the spend order whose non cash needs are met). Exit 1 when any enforced check fails; exit 2
//    when ../sim.js does not have the v3.0 surface yet.
//    Beyond W20 (information only, never a FAIL): per policy the median cash and word of mouth at
//    the end of every week of season 1, the median cash at every season end, and any seed whose
//    milestone lands outside its band is listed under "outside the bands".
//
// Deviations from W20 (Harness builder):
//   1. The task brief for this round called the policies "competent and careless over seeds 1 to 8";
//      the contract (W20) is the law here, so the season bot runs sharp, steady and rough, over
//      seeds 1 to 50 by default. `--seeds 8` (a count) or `--seeds 1-8` (a range) runs the short set.
//   2. The median of an even number of seeds is the upper of the two middle values (the later week),
//      so a band passes only when at least half the seeds reach it.
//   3. --trace (not in W20) prints the week by week rows of the first seed of each policy.
// Integration (v3.0 integrator, recorded in contract W23):
//   I-2. The season bot's decor stage opens only once all six gear rows of the spend order are owned.
//        W20 and W22.19 as written (decor bought with continue while the drum is out of reach) put
//        the sharp drum median at S1W6, two weeks past its S1W4 band, at the starting C values.
// Playtest round 1 (2026-10-19, recorded in contract W24):
//   P-7. The gear stage buys the next item of the order only ([S 10.3] "buys the next item on a
//        fixed upgrade order"): it stops at the first gear row it cannot afford instead of going on
//        to cheaper rows. The decor stage keeps W22.19's continue rule. With sim.js P-1 the one
//        kettle Church picnic is a stretch, so week 1 is a Birthday and the continue rule spent the
//        drum money on the tray, cooler and canopy (sharp drum median S1W7).
//   P-8. After the spend pass the bot picks again (W22.11: a gear buy can turn a stretch offer
//        safe) and keeps the new pick when it loads up, else the first pick.
//   P-9. "Never stuck" uses the Birthday's prefill meat cost on an empty cooler as prefill() now
//        builds it: no spare without a cooler (sim.js P-5), 30 at Normal.
// Playtest round 2 (2026-10-19, recorded in contract W25):
//   R-1. The competent bot's boardFits() follows sim.js R-2: a stack of that meat with room, else a
//        free stack (C.BOARD_STACKS 5, C.BOARD_STACK 14). No other change; the season bot reads the
//        sized finale (sim.js R-3), the drum second in GOAL_ORDER and BAGS_PER_COOKER 6 through the
//        sim's public methods.
//
// v3.1, crew cards (contract docs/superpowers/specs/2026-10-19-pit-sim-v3-1-contract.md, X16 and
// X18.1 item 47). The v2 hires are gone (state.hires, hire()), so the bot drafts on Hiring Day and
// runs a lineup through the X7 methods:
//   - Hiring Day, every season: round 1 hires the open FIRE applicant with the most stars (ties to the
//     lower wage, then the lower idx), round 2 the open RUN applicant the same way, round 3 passes.
//     From season 2 it hires in a round only for a role the crew lacks (FIRE, then RUN) and passes
//     otherwise. Over the slots it lets go the card with the fewest stars until it fits. No tryouts.
//   - The lineup each week: FIRE from the week the cooler is owned, RUN from the week the drum is owned
//     and week start cash is 200 or more; nobody on a Yard day; nobody when week start cash is under
//     the W22.19 reserve plus the lineup's wages, and the reserve adds those wages.
//   - Keeping the crew: notice gets the raise once, else letGo; a wanted role the crew lacks hires the
//     best walk-in of that role when cash - fee holds the reserve plus two wages; the lowest id card
//     trains each week; every banked level goes on skill 0, then skill 1.
//   - Day runs pass Hiring Day; the v2.1 "buddy at word of mouth 45" step hires the best RUN walk-in
//     and brings it.
//   Checks (Normal, 50 seeds, 5 seasons): the [S 10.3] drum bands, never stuck and rough never under 0
//   with wages in the pre-clamp sum, never idle, payroll in budget (every event's wages at most
//   C.PAYROLL[0]) and payroll a real sink (sharp and steady: median wages a season over seasons 2 to 5
//   between 8 and 40 percent of median pay and tips) are enforced; the Driveway against S1W9, S2W4,
//   S3W9, the season end cash beside v3.0's, the eager policy, the season 1 crew counts and the
//   Birthday's longest empty line (X16 check 7) are information.
// Deviations from X16 (v3.1, Harness builder, who owns this file this round):
//   4. "Pay plus tips" per season is deposit + pay rest + menu bonus + tips + seat tips + plate sales
//      (a Yard day's pay is its plate sales).
//   5. X16's lineup rules can ask for more than the budget once renewed wages grow, and the sim
//      refuses Load up and go over it (X5.4). The bot brings FIRE first, then RUN while the lineup
//      fits C.PAYROLL[0], and after any walk-in hire rests PREP, then RUN, then FIRE until it fits.
//      The Sim builder's scratch run (sim.js header, The X16 run) used the same order.
//   6. The X16 lineup reads "from the week the cooler (drum) is owned" as owned at that week's start,
//      checked each week, and "week start cash is 200 or more" each week too.
//   7. A refused Load up and go falls back to the Yard day with everyone resting (as v3.0's fallback,
//      plus the rest, so the payroll can never be the reason a Yard day is refused).
//   8. The eager policy (X18.1 item 47) is steady stars bringing FIRE and RUN to every booking from
//      week 1, inside the budget and the cash rule; it prints stuck, under 0 and the median season 1
//      cash, and its stuck seeds become a Joel playtest watch item, never a FAIL.
//   9. Exit 2 also when ../sim.js lacks the v3.1 surface (passRound, finishHiring, hiringView, ...).
// Review round 1 (contract X20; Sim and Harness builder):
//  10. A new enforced check per policy, "the stretch pays the most": every week the hub opens, a card
//      of tier 'stretch' pays more than C.STRETCH_EDGE times every tier 'safe' card shown with it (the
//      invite, the Yard day and the finale aside). The bot's rules are unchanged. A scratch run at a
//      backyard budget of 50 (the review's suggestion) failed check 5 for sharp (wages 353 a season,
//      7.8 percent of 4525), so C.PAYROLL[0] stays 60 (contract X20.13).

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const simPath = path.resolve(here, '..', 'sim.js');
vm.runInThisContext(fs.readFileSync(simPath, 'utf8'), { filename: simPath });
const P = globalThis.PitSim;
const { C, MAP, MEATS, MEAT_IDS, CATALOG } = P;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(name);
const SEASON_MODE = flag('--season');
const VERBOSE = flag('--verbose');
const TRACE = flag('--trace');
const WITH_DECOR = flag('--decor');
const DAYS = Number(arg('--days', 10));
const SEED = Number(arg('--seed', 1));
function seedList(spec) {
  const m = /^(\d+)-(\d+)$/.exec(spec);
  if (m) { const out = []; for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i); return out; }
  if (/^\d+$/.test(spec) && SEASON_MODE) { const out = []; for (let i = 1; i <= Number(spec); i++) out.push(i); return out; }
  return spec.split(',').map(Number).filter((n) => Number.isFinite(n));
}
const SEEDS = seedList(arg('--seeds', SEASON_MODE ? '50' : '1-8'));
const SEASONS = Math.max(1, Number(arg('--seasons', 5)) | 0);
const LENGTH = arg('--length', 'normal');

const DECOR_ORDER = ['chair1', 'lights', 'chair2', 'picnic2', 'flowers', 'birdbath'];
const GEAR_ORDER = ['kettle2', 'cooler', 'runCard', 'bigtable', 'drum', 'tray', 'canopy'];   // the v2.1 day bot; v3.1: the buddy row is a RUN walk-in
const SPEND_GEAR = ['kettle2', 'drum', 'tray', 'cooler', 'canopy', 'bigtable'];
const SPEND_ORDER = SPEND_GEAR.concat(DECOR_ORDER);   // W20
const COOKERS = ['kettle1', 'kettle2', 'drum'];
const ROW = Object.fromEntries(CATALOG.map((r) => [r.id, r]));
const DEFAULT_NAME = 'Pitmaster', DEFAULT_PIT = 'Your Pit';

const V3_METHODS = ['bookOffer', 'loadUp', 'finishReport', 'startSeason', 'setPlayer', 'settle', 'canLoadUp', 'setLength', 'prefill'];
function requireV3() {
  const probe = P.createSim(null, 1);
  const missing = V3_METHODS.filter((m) => typeof probe[m] !== 'function');
  if (!P.DEFAULT_LOOK || !P.genOffers || missing.length) {
    console.error('econ: ../sim.js does not have the v3.0 surface yet (missing ' + (missing.join(', ') || 'DEFAULT_LOOK or genOffers') + '). Run this after the Sim builder lands.');
    process.exit(2);
  }
}
const V31_METHODS = ['hiringView', 'passRound', 'hireApplicant', 'finishHiring', 'hireWalkin', 'setBring', 'payroll', 'train', 'levelUp', 'giveRaise', 'letGo', 'crewView'];
function requireV31() {
  const probe = P.createSim(null, 1);
  const missing = V31_METHODS.filter((m) => typeof probe[m] !== 'function');
  if (missing.length || typeof P.cardStars !== 'function' || !Array.isArray(C.PAYROLL)) {
    console.error('econ: ../sim.js does not have the v3.1 surface yet (missing ' + (missing.join(', ') || 'cardStars or C.PAYROLL') + '). Run this after the Sim builder lands.');
    process.exit(2);
  }
}

// ---- the competent bot, service side (v2.1, reads the v3.0 timings) --------------------------

function stationTile(id) { const t = MAP.station(id).tiles[0]; return { x: t.x, y: t.y }; }
function activeCookers(s) { return COOKERS.filter((id) => P.tileOwned(MAP.station(id), s.gear)); }
function freeSlot(ck, size) {
  const taken = new Array(ck.slots).fill(false);
  for (const p of ck.pieces) for (let i = 0; i < p.size; i++) taken[p.slot + i] = true;
  for (let i = 0; i + size <= ck.slots; i++) {
    let ok = true;
    for (let j = 0; j < size; j++) if (taken[i + j]) ok = false;
    if (ok) return true;
  }
  return false;
}
function tableFits(s, meat) {
  const sp = s.stations.table.spots;
  return sp.some((x) => x && x.meat === meat && x.times.length < C.TABLE_STACK) || sp.some((x) => x === null);
}
function boardFits(s, meat, plates) {
  if (s.stations.board.stacks.some((x) => x.meat === meat && x.times.length + plates <= C.BOARD_STACK)) return true;
  return s.stations.board.stacks.length < C.BOARD_STACKS && plates <= C.BOARD_STACK;
}
const cookableNow = (s, m) => !MEATS[m].drumOnly || s.gear.drum === true;
function chooseMeat(s) {
  const waiting = s.customers.filter((c) => c.mode === 'waiting' && c.queueIndex >= 0).sort((a, b) => a.queueIndex - b.queueIndex);
  for (const c of waiting) {
    const m = c.want;
    if (!(s.stock[m] > 0) || !cookableNow(s, m)) continue;
    const onTable = s.stations.table.spots.some((x) => x && x.meat === m);
    const onBoard = s.stations.board.stacks.some((x) => x.meat === m);
    const onGrate = COOKERS.some((id) => s.stations[id].pieces.some((p) => p.meat === m && p.state !== 'burnt'));
    if (!onTable && !onBoard && !onGrate) return m;
  }
  let best = null;
  for (const m of MEAT_IDS) {
    if (!cookableNow(s, m) || !(s.stock[m] > 0)) continue;
    if (best === null || s.stock[m] > s.stock[best] || (s.stock[m] === s.stock[best] && MEATS[m].cook < MEATS[best].cook)) best = m;
  }
  return best;
}
function decide(sim) {
  const s = sim.state;
  const c = s.player.carrying;
  const cookers = activeCookers(s);
  const fireOf = (id) => s.stations[id].fire;
  const lastCall = s.today && Number.isFinite(s.today.lastCallAt) ? s.today.lastCallAt : C.LAST_CALL;
  if (c) {
    if (c.kind === 'charcoal') {
      let best = cookers[0];
      for (const id of cookers) if (fireOf(id) < fireOf(best)) best = id;
      return stationTile(best);
    }
    if (c.kind === 'raw') {
      const m = MEATS[c.meat];
      const ok = cookers.filter((id) => (!m.drumOnly || id === 'drum') && freeSlot(s.stations[id], m.slots) && fireOf(id) >= C.COLD_UNDER);
      if (ok.length) { ok.sort((a, b) => fireOf(b) - fireOf(a)); return stationTile(ok[0]); }
      return null;
    }
    if (c.kind === 'cooked') return boardFits(s, c.meat, MEATS[c.meat].plates) ? stationTile('board') : null;
    if (c.kind === 'burnt') return stationTile('trash');
    if (c.kind === 'plates') return tableFits(s, c.meat) ? stationTile('table') : null;
    return null;
  }
  let pull = null;
  let pullKey = -Infinity;
  for (const id of cookers) {
    for (const p of s.stations[id].pieces) {
      if (p.state === 'cooking') continue;
      const key = p.state === 'burnt' ? 0.5 : 1 + (p.prog - MEATS[p.meat].cook);
      if (key > pullKey) { pullKey = key; pull = id; }
    }
  }
  if (pull && pullKey >= 1) return stationTile(pull);
  const stockLeft = MEAT_IDS.some((m) => s.stock[m] > 0);
  const needsFire = (id, under) => {
    const ck = s.stations[id];
    if (ck.fire >= under) return false;
    if (ck.pieces.some((p) => p.state === 'cooking' || p.state === 'done')) return true;
    return stockLeft && s.clock < lastCall;
  };
  if (s.charcoal > 0) for (const id of cookers) if (needsFire(id, 45)) return stationTile('pile');
  const stacks = s.stations.board.stacks;
  if (stacks.length && stacks.some((st) => tableFits(s, st.meat))) return stationTile('board');
  if (s.charcoal > 0) for (const id of cookers) if (needsFire(id, 54)) return stationTile('pile');
  if (pull) return stationTile(pull);
  if (stockLeft) {
    const m = chooseMeat(s);
    if (m) {
      const slotOk = cookers.some((id) => (!MEATS[m].drumOnly || id === 'drum') && freeSlot(s.stations[id], MEATS[m].slots) && fireOf(id) >= C.FIRE_GOOD - 5);
      if (slotOk) { sim.selectMeat(m); return stationTile('cooler'); }
    }
  }
  return null;
}
function botTick(sim) {
  const s = sim.state;
  if (s.phase !== 'service') return;
  const p = s.player;
  if (p.busy || p.next || p.path.length || p.target) return;
  const t = decide(sim);
  if (t) sim.walkTo(t.x, t.y);
}
function playEvent(sim) {
  let guard = 0;
  while (sim.state.phase === 'service' && guard++ < 100000) { botTick(sim); sim.tick(); sim.drainEvents(); }
  return sim.state.phase !== 'service';
}

// v3.2 (D10.2): one quick day by tap, chooseDay then the result card's Next day. Returns the events.
function quickDay(sim, kind, opt) {
  const r = sim.chooseDay(kind, opt);
  const evs = sim.drainEvents();
  if (r.ok && sim.state.loop === 'week' && sim.state.phase === 'evening') sim.advanceDay();
  return { ok: r.ok, message: r.message, evs };
}
const dayOk = (sim, kind) => {
  const v = sim.dayOptions();
  return !!(v && Array.isArray(v.options) && v.options.some((o) => o.kind === kind && o.ok));
};
// Days off until `kind` is on today's list (or the week ends). Returns the quick days tapped.
function offUntil(sim, kind) {
  const s = sim.state;
  const week = s.season.week, year = s.season.year;
  let n = 0;
  while (s.loop === 'week' && s.season.week === week && s.season.year === year && n < 7) {
    const v = sim.dayOptions();
    if (v.options.some((o) => o.kind === kind)) break;
    quickDay(sim, 'off');
    n += 1;
  }
  return n;
}
// The grinder's weekday Yard day cart: half a Yard day's crowd in sausage and chicken, plus bags.
function weekdayYardCart(sim) {
  const s = sim.state;
  for (const m of MEAT_IDS) if (s.cart.meat[m]) sim.buy(m, -999);
  if (s.cart.charcoal) sim.buy('charcoal', -999);
  const cookers = 1 + (s.gear.kettle2 ? 1 : 0) + (s.gear.drum ? 1 : 0);
  const crowd = Math.ceil(sim.expectedCrowd() * C.YARD_DAY_FRAC);
  const have = MEAT_IDS.reduce((a, m) => a + s.stock[m] * MEATS[m].plates, 0);
  const units = Math.ceil(Math.max(0, Math.ceil(1.1 * crowd) + 1 - have) / 2);
  const chicken = Math.floor(units / 2);
  if (units - chicken) sim.buy('sausage', units - chicken);
  if (chicken) sim.buy('chicken', chicken);
  const bags = Math.max(0, Math.ceil(C.BAGS_PER_COOKER * C.YARD_DAY_FRAC) * cookers - s.charcoal);
  if (bags) sim.buy('charcoal', bags);
}

// v3.1 (X16): Hiring Day. Season 1 drafts the best FIRE, then the best RUN, then passes; later seasons
// hire only for a role the crew lacks. Over the slots, the fewest stars go first. Returns the events.
function hiringDay(sim, firstSeason) {
  const s = sim.state;
  const evs = [];
  const best = (role) => {
    const v = sim.hiringView();
    return v ? v.pool.filter((e) => e.status === 'open' && e.role === role).sort((a, b) => b.stars - a.stars || a.wage - b.wage || a.idx - b.idx)[0] || null : null;
  };
  const has = (role) => s.crew.some((c) => c.role === role);
  for (let round = 1; round <= 3 && s.loop === 'hiring'; round++) {
    let role = null;
    if (firstSeason) role = round === 1 ? 'fire' : (round === 2 ? 'run' : null);
    else role = !has('fire') ? 'fire' : (!has('run') ? 'run' : null);
    const pick = role ? best(role) : null;
    if (pick) sim.hireApplicant(pick.idx); else sim.passRound();
    evs.push(...sim.drainEvents());
  }
  while (s.crew.length > sim.payroll().slots) {
    const worst = s.crew.slice().sort((a, b) => P.cardStars(a.skills) - P.cardStars(b.skills) || a.id - b.id)[0];
    if (!sim.letGo(worst.id).ok) break;
  }
  const f = sim.finishHiring();
  evs.push(...sim.drainEvents());
  if (!f.ok) throw new Error('econ: finishHiring refused: ' + (f.message || 'rounds left'));
  return evs;
}
// Pass every round (day runs and the Birthday check).
function passHiringDay(sim) {
  for (let i = 0; i < 3 && sim.state.loop === 'hiring'; i++) sim.passRound();
  if (sim.state.loop === 'hiring') sim.finishHiring();
  sim.drainEvents();
}

// A sim on the week 1 hub: the tutorial skipped, the creator finished with the default look, Hiring
// Day left to the caller (draft true) or passed (draft false).
function newSeasonSim(seed, length, draft) {
  const sim = P.createSim(null, seed);
  sim.skipTutorial();
  sim.drainEvents();
  sim.setPlayer(P.DEFAULT_LOOK, DEFAULT_NAME, DEFAULT_PIT);
  sim.drainEvents();
  if (!draft) passHiringDay(sim);
  if (length && length !== 'normal' && sim.state.loop === 'week') sim.setLength(length);   // V-10: setLength is week only
  sim.drainEvents();
  return sim;
}

// ---- mode 1: the v2.1 day runs through the week ----------------------------------------------

function morning(sim) {
  const s = sim.state;
  const bought = [];
  if (s.broke) return { broke: true, bought };
  if (s.comingNext && typeof sim.dismissComingNext === 'function') sim.dismissComingNext();
  for (const m of MEAT_IDS) if (s.cart.meat[m]) sim.buy(m, -999);
  if (s.cart.charcoal) sim.buy('charcoal', -999);
  const plan = () => {
    const cookers = 1 + (s.gear.kettle2 ? 1 : 0) + (s.gear.drum ? 1 : 0);
    const crowd = sim.expectedCrowd();
    const plates = Math.ceil(1.1 * crowd) + 1 + (cookers > 1 ? 2 : 0);
    const have = MEAT_IDS.reduce((a, m) => a + s.stock[m] * MEATS[m].plates, 0);
    const need = Math.max(0, plates - have);
    const units = Math.ceil(need / 2);
    const chicken = Math.floor(units / 2);
    const sausage = units - chicken;
    const bags = Math.max(0, 6 * cookers - s.charcoal);
    const cost = sausage * ROW.sausage.price + chicken * ROW.chicken.price + bags * ROW.charcoal.price;
    const wages = sim.payroll().now;   // v3.1: the lineup's wages (X5.4)
    return { sausage, chicken, bags, reserve: cost + wages + C.DAILY_COSTS };
  };
  for (const g of GEAR_ORDER) {
    const pl = plan();
    if (g === 'runCard') {   // v3.1 (X16): the buddy row of the v2.1 order is the best RUN walk-in, brought
      if (s.crew.some((c) => c.role === 'run')) continue;
      const w = s.season.walkins.map((x, i) => [x, i]).filter(([x]) => !x.hired && x.role === 'run').sort((a, b) => b[0].stars - a[0].stars || a[0].wage - b[0].wage || a[1] - b[1])[0];
      if (w && s.rep >= 45 && s.crew.length < sim.payroll().slots && s.cash - pl.reserve - 2 * w[0].wage >= 0 && sim.hireWalkin(w[1]).ok) {
        const c = s.crew.find((k) => k.role === 'run');
        if (c && !c.bring) sim.setBring(c.id, true);
        bought.push('runCard');
        continue;
      }
      break;
    }
    if (s.gear[g]) continue;
    const row = ROW[g];
    if (row.needs && row.needs.gear && !s.gear[row.needs.gear]) break;
    if (s.cash - row.price >= pl.reserve && sim.buy(g, 1).ok) bought.push(g);
    else break;
  }
  if (WITH_DECOR && s.gear.kettle2) {
    for (const d of DECOR_ORDER) {
      if (s.decor[d]) continue;
      const row = ROW[d];
      if (s.cash - row.price >= plan().reserve + 40 && sim.buy(d, 1).ok) bought.push(d);
    }
  }
  const pl = plan();
  if (pl.sausage) sim.buy('sausage', pl.sausage);
  if (pl.chicken) sim.buy('chicken', pl.chicken);
  if (pl.bags) sim.buy('charcoal', pl.bags);
  if (!sim.canLoadUp().ok) {
    if (s.charcoal + s.cart.charcoal === 0) sim.buy('charcoal', 1);
    if (!MEAT_IDS.some((m) => s.stock[m] + s.cart.meat[m] > 0)) sim.buy('sausage', 1);
  }
  return { broke: false, bought };
}

function dayRun(seed, days) {
  const sim = newSeasonSim(seed, LENGTH, false);
  const rows = [];
  const firsts = {};
  for (let d = 1; d <= days; d++) {
    const s = sim.state;
    if (s.loop === 'seasonEnd') { sim.startSeason(); sim.drainEvents(); passHiringDay(sim); }   // v3.1: Hiring Day passed
    if (s.loop !== 'week') { firsts.stuck = firsts.stuck || ('loop ' + s.loop); break; }
    const start = s.cash;
    const finale = s.season.week === C.SEASON_WEEKS;
    let m = { broke: false, bought: [] };
    if (finale) {
      sim.bookOffer(s.season.offers[0].id);   // W22.22: the finale, on its prefilled cart
    } else {
      sim.bookOffer('yard');
      m = morning(sim);
    }
    for (const b of m.bought) if (!(b in firsts)) firsts[b] = s.day;
    if (m.broke) { if (!('broke' in firsts)) firsts.broke = s.day; break; }
    // v3.2: days off to the weekend (the cart rides along), then a full length Yard day or the finale.
    const cart = { meat: Object.assign({}, s.cart.meat), charcoal: s.cart.charcoal };
    if (finale) offUntil(sim, 'event');
    else while (s.loop === 'week' && s.season.day < 5) quickDay(sim, 'off');
    if (!finale) {
      for (const k of MEAT_IDS) if (s.cart.meat[k] !== cart.meat[k]) sim.buy(k, cart.meat[k] - s.cart.meat[k]);
      if (s.cart.charcoal !== cart.charcoal) sim.buy('charcoal', cart.charcoal - s.cart.charcoal);
    }
    const lu = finale ? sim.chooseDay('event') : sim.chooseDay('yard');
    sim.drainEvents();
    if (!lu.ok) { if (!('stuck' in firsts)) firsts.stuck = 'day ' + s.day + ': ' + (sim.canLoadUp().reason || lu.message); break; }
    playEvent(sim);
    const t = s.till;
    rows.push({ day: t.day, kind: finale ? 'finale' : t.kind, wk: 'S' + s.season.year + 'W' + s.season.week, start, cust: t.customers, served: t.served,
      seated: t.seated, togo: t.togo, walk: t.walkouts, past: t.past, close: t.close, burnt: t.burnt, rev: t.revenue,
      pay: (t.payRest | 0) + (t.deposit | 0) + (t.menuBonus | 0), tips: t.tips, seat: t.seatTips, wages: t.wages + C.DAILY_COSTS,
      spoil: t.spoilCost, rain: s.rain ? 'y' : '', rep: t.repEnd, cash: s.cash, bought: m.bought.join(', ') });
    if (s.cash >= C.DRIVEWAY_PRICE && s.gear.drum && !('driveway' in firsts)) firsts.driveway = t.day;
    sim.finishReport();
    sim.drainEvents();
    const wk = s.season.week;
    while (s.loop === 'week' && s.season.week === wk) { quickDay(sim, 'off'); }
  }
  return { rows, firsts };
}

function table(rows) {
  const cols = ['day', 'wk', 'kind', 'start', 'cust', 'served', 'seated', 'togo', 'walk', 'past', 'close', 'burnt', 'rev', 'pay', 'tips', 'seat', 'wages', 'spoil', 'rain', 'rep', 'cash', 'bought'];
  const lines = ['| ' + cols.join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|'];
  for (const r of rows) lines.push('| ' + cols.map((c) => String(r[c])).join(' | ') + ' |');
  return lines.join('\n');
}

function dayMode() {
  const one = dayRun(SEED, DAYS);
  console.log('Competent bot' + (WITH_DECOR ? ' with decor' : '') + ', seed ' + SEED + ', ' + DAYS + ' events through the week hub, length ' + LENGTH
    + ' (Yard days, week 9 the finale; wages includes the ' + C.DAILY_COSTS + ' daily costs; pay = deposit + rest + menu bonus; seat = seat tips)\n');
  console.log(table(one.rows));
  console.log('\nFirst bought: ' + (Object.entries(one.firsts).map(([k, v]) => k + ' day ' + v).join(', ') || 'nothing'));
  const summary = [];
  for (const seed of SEEDS) {
    const r = dayRun(seed, Math.max(DAYS, 25));
    summary.push({ seed, kettle2: r.firsts.kettle2, drum: r.firsts.drum, driveway: r.firsts.driveway, broke: r.firsts.broke, stuck: r.firsts.stuck });
  }
  console.log('\nSeeds ' + SEEDS[0] + ' to ' + SEEDS[SEEDS.length - 1] + ', up to 25 events: day of the second kettle, the drum, the driveway price, broke, stuck');
  for (const s of summary) console.log('  seed ' + s.seed + ': kettle2 ' + (s.kettle2 || 'never') + ', drum ' + (s.drum || 'never') + ', driveway ' + (s.driveway || 'not in 25') + ', broke ' + (s.broke || 'never') + (s.stuck ? ', stuck ' + s.stuck : ''));
}

// ---- mode 2: the season bot (W20, X16) -------------------------------------------------------

const POLICIES = [
  { id: 'sharp', stars: 5, drumBand: 4, drivewayBand: 9 },     // S1W4 / S1W9
  { id: 'steady', stars: 3, drumBand: 8, drivewayBand: 13 },   // S1W8 / S2W4
  { id: 'rough', stars: 2, drumBand: 18, drivewayBand: 27 },   // S2W9 / S3W9
  { id: 'eager', stars: 3, drumBand: Infinity, drivewayBand: Infinity, eager: true, info: true },   // X18.1 item 47, information only
  { id: 'grinder', stars: 3, drumBand: Infinity, drivewayBand: Infinity, grinder: true, info: true }   // v3.2 (D10.2): steady stars, a Yard day every weekday, no Load-in; information only
];
const V30_SEASON_CASH = { sharp: [827, 2361, 3895, 5429, 6963] };   // [S 10.7], the v3.0 result X16 check 5 prints beside
const W = () => C.SEASON_WEEKS;
const absWeek = (year, week) => (year - 1) * W() + week;
const fmtWeek = (abs) => (Number.isFinite(abs) ? 'S' + (Math.floor((abs - 1) / W()) + 1) + 'W' + (((abs - 1) % W()) + 1) : 'never');
function median(list) {
  const v = list.map((x) => (x === null || x === undefined ? Infinity : x)).sort((a, b) => a - b);
  if (!v.length) return Infinity;
  return v[Math.floor(v.length / 2)];   // deviation 2: the upper middle for an even count
}
const medianNum = (list) => { const v = list.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };

// The Birthday's prefill meat cost on an empty cooler at this length (W22.21), now on the v3.1
// Birthday of seed 1, week 1 (its size is one SAFE_SIZES draw, X3.4).
function birthdayMeatCost(length) {
  const gear = Object.fromEntries(Object.keys(P.createSim(null, 1).state.gear).map((g) => [g, false]));
  const offers = P.genOffers({ seed: 1, year: 1, week: 1, rep: C.START_REP, cash: C.START_CASH, gear, length });
  const b = offers.find((o) => o.type === 'birthday');
  let cost = 0;
  for (const m of MEAT_IDS) {
    const r = b.rail[m] | 0;
    if (r <= 0) continue;
    cost += Math.ceil(r / MEATS[m].plates) * ROW[m].price;   // P-9: no spare on an empty cooler with no cooler (sim.js P-5)
  }
  return cost;
}
const needsMet = (s, row) => !row.needs || ((!row.needs.gear || s.gear[row.needs.gear] === true) && (!row.needs.decor || s.decor[row.needs.decor] === true));
const owned = (s, id) => (ROW[id].kind === 'decor' ? s.decor[id] === true : s.gear[id] === true);
// The best card of a role on the crew: most stars, then the lowest id.
const cardOfRole = (s, role) => s.crew.filter((c) => c.role === role).sort((a, b) => P.cardStars(b.skills) - P.cardStars(a.skills) || a.id - b.id)[0] || null;

function choosePick(sim, policy) {
  const s = sim.state;
  const offers = s.season.offers;
  const yard = offers.find((o) => o.type === 'yard') || null;
  if (s.season.week === W()) return offers.find((o) => o.type === 'finale') || offers[0];
  const safe = offers.filter((o) => o.type !== 'yard' && o.safe).sort((a, b) => b.pay - a.pay);
  if (policy.id === 'rough') {
    if (s.rep < C.DRIVEWAY_REP) return yard || safe[0];
    for (const o of safe) {
      sim.bookOffer(o.id);
      if (sim.canLoadUp().ok) return o;
    }
    return yard || safe[0];
  }
  return safe[0] || yard;
}

// One spend pass in the W20 order; returns what it bought. The v3.0 hire step is gone: crew cards
// come from Hiring Day and walk-ins (X16).
function spendPass(sim, reserve) {
  const s = sim.state;
  const bought = [];
  // Integration I-2 (contract W23): the decor stage of the order opens once every gear row of it is
  // owned, as the v2 bot bought decor only once gear was covered ([S 10.3]'s upgrade order is gear only).
  for (const id of SPEND_ORDER) {
    const row = ROW[id];
    if (!row || owned(s, id) || !needsMet(s, row)) continue;
    // P-7: read per item, so the pass that buys the last gear row goes straight on to the decor.
    if (DECOR_ORDER.includes(id) && !SPEND_GEAR.every((g) => owned(s, g))) continue;
    if (s.cash - row.price >= reserve && sim.buy(id, 1).ok) { bought.push(id); continue; }
    if (SPEND_GEAR.includes(id)) break;   // P-7: the gear stage buys the next item only; decor keeps continue (W22.19)
  }
  return bought;
}

function seasonRun(policy, seed, seasons, length) {
  const sim = newSeasonSim(seed, length, true);
  const s = sim.state;
  const bdayCost = birthdayMeatCost(length);
  const res = { seed, drum: null, driveway: null, seasonCash: [], stuck: null, underZero: [], idle: [], weeks: [], fallbacks: 0,
    maxWages: 0, overBudget: [], wagesBySeason: [], payBySeason: [], left1: 0, sendoffs1: 0, walkins1: 0, crewAt: [], stretchLow: [],
    secsBySeason: [], yardDays: 0, noCook: 0 };   // v3.2: play seconds a season (2 s a quick day, cooks at endAt), the grinder's weekday Yard days
  const count = (evs) => {
    if (s.season.year !== 1) return;
    for (const e of evs) {
      if (e.type === 'crew_left') res.left1 += 1;
      if (e.type === 'crew_let_go' && e.sendoff > 0) res.sendoffs1 += 1;
      if (e.type === 'crew_hired' && e.from === 'walkin') res.walkins1 += 1;
    }
  };
  count(hiringDay(sim, true));
  if (length && length !== 'normal') { sim.setLength(length); sim.drainEvents(); }   // setLength is week only (sim.js V-10)
  let lowStreak = 0;
  let wages = 0, pay = 0, secs = 0;
  const total = seasons * W();
  // v3.2: the season end after a week's last day (Sunday's tick opens it).
  const seasonEnded = () => {
    if (s.loop !== 'seasonEnd') return;
    res.seasonCash.push(s.cash);
    res.wagesBySeason.push(wages);
    res.payBySeason.push(pay);
    res.secsBySeason.push(secs);
    res.crewAt.push(s.crew.map((c) => c.role + ' ' + P.cardStars(c.skills) + ' at ' + c.wage).join(', '));
    wages = 0; pay = 0; secs = 0;
    sim.startSeason();
    count(sim.drainEvents());
    if (s.loop === 'hiring') count(hiringDay(sim, false));
  };
  const quick = (kind, opt) => { const r = quickDay(sim, kind, opt); count(r.evs); if (r.ok) secs += 2; return r; };
  for (let n = 1; n <= total + 1; n++) {
    if (s.loop !== 'week' || s.phase !== 'morning') { res.stuck = res.stuck || ('loop ' + s.loop + ' at ' + fmtWeek(n)); break; }
    const abs = absWeek(s.season.year, s.season.week);
    const finalPass = n === total + 1;
    const weekStart = s.cash;
    // Week start: never stuck and the driveway milestone (cash at week start, deposit excluded).
    if (!finalPass) {
      lowStreak = s.cash < bdayCost ? lowStreak + 1 : 0;
      if (lowStreak >= 2 && !res.stuck) res.stuck = 'cash under ' + bdayCost + ' two weeks running at ' + fmtWeek(abs);
      if (res.driveway === null && s.gear.drum && s.rep >= C.DRIVEWAY_REP && s.cash >= C.DRIVEWAY_PRICE) res.driveway = abs;
    }
    // X16 keeping the crew: a card with notice gets the raise once, else it is let go.
    for (const c of s.crew.slice()) {
      if (!c.notice) continue;
      if (!c.raised) sim.giveRaise(c.id);
      else sim.letGo(c.id);
    }
    count(sim.drainEvents());
    // Review 1 (deviation 10): a STRETCH card pays more than every SAFE BET card shown beside it (the
    // invite and the Yard day aside), every week the hub opens, before any gear is bought.
    if (!finalPass) {
      const shown = s.season.offers.filter((o) => o.type !== 'yard' && o.type !== 'finale' && !o.invite);
      const safeTop = Math.max(0, ...shown.filter((o) => o.tier === 'safe').map((o) => o.pay));
      for (const o of shown) if (o.tier === 'stretch' && !(o.pay > safeTop * C.STRETCH_EDGE)) res.stretchLow.push(fmtWeek(abs) + ' ' + o.id + ' ' + o.pay + ' against ' + safeTop);
    }
    // 1. pick and read the prefilled cart.
    const pick = choosePick(sim, policy);
    sim.bookOffer(pick.id);
    // X16 the lineup: FIRE from the week the cooler is owned, RUN from the week the drum is owned
    // with 200 at week start; nobody on a Yard day; eager brings both to every booking. Deviation 5:
    // FIRE first, then RUN while the payroll budget holds.
    const isYard = pick.type === 'yard';
    const wantRoles = [];
    if (!isYard) {
      if (policy.eager) wantRoles.push('fire', 'run');
      else {
        if (s.gear.cooler) wantRoles.push('fire');
        if (s.gear.drum && weekStart >= 200) wantRoles.push('run');
      }
    }
    const budget = sim.payroll().budget;
    let lineWages = 0;
    const fitRoles = [];
    for (const role of wantRoles) {
      const c = cardOfRole(s, role);
      const w = c ? c.wage : 0;
      if (lineWages + w <= budget) { fitRoles.push(role); lineWages += w; }
    }
    // The reserve of W22.19 adds the lineup's wages; nobody is brought when week start cash is under it.
    const baseReserve = Math.max(0, sim.cartTotal() - (pick.deposit | 0)) + C.DAILY_COSTS;
    const bringRoles = weekStart >= baseReserve + lineWages ? fitRoles : [];
    const reserve = baseReserve + (bringRoles.length ? lineWages : 0);
    // 2. empty every cart line; 3. spend.
    for (const m of MEAT_IDS) sim.buy(m, -999);
    sim.buy('charcoal', -999);
    const bought = spendPass(sim, reserve);
    if (res.drum === null && s.gear.drum) res.drum = abs;
    // W22.20: never idle, measured right after the week 1 spend pass of every later season.
    if (s.season.week === 1 && s.season.year > 1) {
      const next = SPEND_ORDER.find((id) => ROW[id] && !owned(s, id) && needsMet(s, ROW[id]));
      if (next && s.cash - reserve > 2 * ROW[next].price) res.idle.push(fmtWeek(abs) + ' holds ' + (s.cash - reserve) + ' over ' + next + ' at ' + ROW[next].price);
    }
    if (finalPass) break;
    // 4. book again to re-prefill (P-8: a gear buy can turn a stretch offer safe).
    let booked = s.season.offers.find((o) => o.id === pick.id) || s.season.offers[0];
    const again = choosePick(sim, policy);
    if (again && again.id !== booked.id) {
      sim.bookOffer(again.id);
      if (sim.canLoadUp().ok) booked = again;
    }
    sim.bookOffer(booked.id);
    // X16: a walk-in for a wanted role the crew lacks, when cash - fee holds the reserve plus two wages.
    for (const role of bringRoles) {
      if (cardOfRole(s, role) || s.crew.length >= sim.payroll().slots) continue;
      const w = s.season.walkins.map((x, i) => [x, i]).filter(([x]) => !x.hired && x.role === role).sort((a, b) => b[0].stars - a[0].stars || a[0].wage - b[0].wage || a[1] - b[1])[0];
      if (w && s.cash - w[0].wage >= reserve + 2 * w[0].wage) sim.hireWalkin(w[1]);
    }
    // Bring the wanted roles, rest the rest, then trim to the budget (PREP, RUN, then FIRE).
    const bringIds = new Set(bringRoles.map((role) => cardOfRole(s, role)).filter(Boolean).map((c) => c.id));
    for (const c of s.crew) if (c.bring !== bringIds.has(c.id)) sim.setBring(c.id, bringIds.has(c.id));
    for (const role of ['prep', 'run', 'fire']) {
      if (sim.payroll().now <= budget) break;
      for (const c of s.crew) if (c.bring && c.role === role) sim.setBring(c.id, false);
    }
    // X16: spend every banked level on skill 0, then skill 1 (the training pick is Wednesday's day).
    const levels = () => {
      for (const c of s.crew) {
        let guard = 0;
        while (c.banked > 0 && guard++ < 20) if (!sim.levelUp(c.id, 0).ok && !sim.levelUp(c.id, 1).ok) break;
      }
      count(sim.drainEvents());
    };
    levels();
    // 5. v3.2 (D10.2) Monday to Friday the way [S 19.6]'s weekend player taps them: Monday a Market
    // run of the prefill when the cooler holds it, else Prep; Tuesday Prep when not prepped, else a
    // Day off; Wednesday Train (the lowest id card) when there is a card; Thursday off; Friday
    // Load-in. A Yard week trains on Wednesday and rests. The grinder cooks a Yard day every weekday
    // it can and skips Load-in.
    const weekNo = s.season.week, yearNo = s.season.year;
    const inThisWeek = () => s.loop === 'week' && s.season.week === weekNo && s.season.year === yearNo;
    const isBookingWeek = booked.type !== 'yard';
    while (inThisWeek() && s.phase === 'morning' && s.season.day <= 4) {
      const d = s.season.day;
      if (policy.grinder) {
        weekdayYardCart(sim);
        const brought = s.crew.filter((c) => c.bring).map((c) => c.id);
        for (const id of brought) sim.setBring(id, false);   // a weekday Yard day cooks with nobody brought
        const yardOk = dayOk(sim, 'yard') && sim.chooseDay('yard').ok;
        for (const id of brought) sim.setBring(id, true);
        if (yardOk) {
          count(sim.drainEvents());
          playEvent(sim);
          count(sim.drainEvents());
          const ty = s.till;
          wages += ty.wages | 0;
          pay += (ty.revenue | 0) + (ty.tips | 0) + (ty.seatTips | 0);
          secs += ty.endAt | 0;
          res.yardDays += 1;
          sim.finishReport();
          count(sim.drainEvents());
          levels();
          continue;
        }
        sim.bookOffer(s.season.booking.id);   // the booking's prefill back in the cart
        sim.drainEvents();
      }
      let kind = 'off';
      let opt;
      if (d === 2 && s.crew.length && s.season.trained === null) { kind = 'train'; opt = { id: s.crew.slice().sort((a, b) => a.id - b.id)[0].id }; }
      if (isBookingWeek && !policy.grinder) {
        if (d === 0) {
          const cartMeat = MEAT_IDS.reduce((a, m) => a + s.cart.meat[m], 0);
          const holds = cartMeat > 0 && MEAT_IDS.reduce((a, m) => a + s.stock[m], 0) + cartMeat <= sim.coolerCap();
          kind = holds && dayOk(sim, 'market') ? 'market' : 'prep';
        } else if (d === 1) kind = s.season.prepped ? 'off' : 'prep';
        else if (d === 4) kind = 'loadin';
      }
      if (!dayOk(sim, kind)) { kind = 'off'; opt = undefined; }
      quick(kind, opt);
      levels();
    }
    // The weekend: the booked day, the other day off. A Yard week cooks Saturday's Yard day (Sunday's
    // when Saturday cannot). A booking that cannot load rests everyone and tries again; when it still
    // cannot, the week falls back to a later weekend Yard day, if one is left.
    let lu = { ok: false, message: '' };
    let wantYard = !isBookingWeek;
    while (inThisWeek() && s.phase === 'morning') {
      const opts = sim.dayOptions().options;
      if (opts.some((o) => o.kind === 'event')) {
        if (!dayOk(sim, 'event')) for (const c of s.crew) if (c.bring) sim.setBring(c.id, false);
        lu = sim.chooseDay('event');
        if (lu.ok) break;
        res.fallbacks += 1;
        wantYard = true;
        quick('off');
        continue;
      }
      if (wantYard && dayOk(sim, 'yard')) {
        if (isBookingWeek) for (const c of s.crew) if (c.bring) sim.setBring(c.id, false);
        lu = sim.chooseDay('yard');
        if (lu.ok) { booked = { type: 'yard' }; break; }
      }
      quick('off');
    }
    count(sim.drainEvents());
    if (!lu.ok) {
      // No cook this week: the Sunday tick wrote { yard, 0 } and opened the next week.
      if ((s.loop === 'week' && s.phase === 'morning') || s.loop === 'seasonEnd') { res.noCook += 1; seasonEnded(); continue; }
      res.stuck = res.stuck || ('no cook at ' + fmtWeek(abs) + ': ' + (sim.canLoadUp().reason || lu.message));
      break;
    }
    const cashAfterLoad = s.cash;
    // 6. the cook.
    const kind = s.today.kind;
    if (kind === 'booking') {
      if (sim.settle(policy.stars) !== true) { res.stuck = res.stuck || ('settle refused at ' + fmtWeek(abs)); break; }
    } else {
      playEvent(sim);
    }
    count(sim.drainEvents());
    const t = s.till;
    // W22.21: cash before the CASH_FLOOR clamp, wages in the sum.
    const preClamp = cashAfterLoad + (t.payRest | 0) + (t.menuBonus | 0) + (t.tips | 0) + (t.seatTips | 0) + (t.revenue | 0) - (t.wages | 0) - C.DAILY_COSTS;
    if (preClamp < 0) res.underZero.push(fmtWeek(abs) + ' ' + preClamp);
    // X16 check 4: the event's lineup wages inside the budget.
    res.maxWages = Math.max(res.maxWages, t.wages | 0);
    if ((t.wages | 0) > C.PAYROLL[0]) res.overBudget.push(fmtWeek(abs) + ' ' + t.wages);
    wages += t.wages | 0;
    pay += (t.deposit | 0) + (t.payRest | 0) + (t.menuBonus | 0) + (t.tips | 0) + (t.seatTips | 0) + (t.revenue | 0);
    secs += t.endAt | 0;
    // 7. next: the report ends the day, then the rest of the week off.
    sim.finishReport();
    count(sim.drainEvents());
    while (inThisWeek() && s.phase === 'morning') quick('off');
    res.weeks.push({ abs, type: booked.type, stars: t.stars | 0, cash: s.cash, rep: s.rep, wages: t.wages | 0, crew: s.crew.length, bought: bought.join(' ') });
    seasonEnded();
  }
  return res;
}

// X16 check 7 (information): the Birthday of week 1 played tick by tick by the competent bot with no
// crew: fed, stars, and the longest stretch with no booked guest arriving or waiting while food is in
// progress and guests are still to come (the X18.1 item 38 predicate, until endAt - LAST_CALL_GUARD).
function foodInProgress(s) {
  for (const id of COOKERS) if (P.tileOwned(MAP.station(id), s.gear) && s.stations[id].pieces.some((p) => p.state !== 'burnt')) return true;
  const b = s.stations.board;
  if (b.stacks.some((x) => x.times.length > 0) || (Array.isArray(b.waiting) && b.waiting.length > 0) || b.slicing !== null) return true;
  return s.stations.table.spots.some((sp) => sp && sp.times.length > 0);
}
function birthdayRun(seed, length) {
  const sim = newSeasonSim(seed, length, false);
  const s = sim.state;
  const b = s.season.offers.find((o) => o.type === 'birthday');
  if (!b || !sim.bookOffer(b.id).ok) return { seed, error: 'no Birthday on offer' };
  offUntil(sim, 'event');   // v3.2: days off to the booked Saturday
  const lu = sim.chooseDay('event');
  sim.drainEvents();
  if (!lu.ok) return { seed, error: 'loadUp ' + (sim.canLoadUp().reason || lu.message) };
  let gap = 0, maxGap = 0, guard = 0;
  const dt = C.TICK_SECONDS;
  while (s.phase === 'service' && guard++ < 100000) {
    botTick(sim);
    sim.tick();
    sim.drainEvents();
    const t = s.today;
    if (s.phase === 'service' && t && t.pending > 0 && s.clock >= t.gateAt && s.clock < t.endAt - C.LAST_CALL_GUARD - 1e-9) {
      const empty = !s.customers.some((c) => c.booked === true && (c.mode === 'arriving' || c.mode === 'waiting'));
      if (empty && foodInProgress(s)) { gap += dt; if (gap > maxGap) maxGap = gap; } else gap = 0;
    } else gap = 0;
  }
  const t = s.till;
  return { seed, guests: b.headcount, menu: b.menu.join('+'), fed: t.fed | 0, booked: t.booked | 0, stars: t.stars | 0, maxGap: Math.round(maxGap * 100) / 100 };
}

function seasonMode() {
  requireV3();
  requireV31();
  const header = 'econ season bot (v3.1, X16): ' + SEEDS.length + ' seeds (' + SEEDS[0] + ' to ' + SEEDS[SEEDS.length - 1] + '), ' + SEASONS + ' seasons, length ' + LENGTH
    + '; Birthday meat on an empty cooler ' + birthdayMeatCost(LENGTH) + '; driveway ' + C.DRIVEWAY_PRICE + ' at word of mouth ' + C.DRIVEWAY_REP + '; payroll budget ' + C.PAYROLL[0];
  console.log(header);
  console.log('policy stars drum band result drivewayAffordable band(info) stuck idle');
  const checks = [];
  const outside = [];
  const extra = [];
  const summary = {};
  for (const pol of POLICIES) {
    const runs = SEEDS.map((seed) => seasonRun(pol, seed, SEASONS, LENGTH));
    const drumMed = median(runs.map((r) => r.drum));
    const dwMed = median(runs.map((r) => r.driveway));
    const stuck = runs.filter((r) => r.stuck);
    const idle = runs.filter((r) => r.idle.length);
    const under = runs.filter((r) => r.underZero.length);
    const over = runs.filter((r) => r.overBudget.length);
    const drumOk = drumMed <= pol.drumBand;
    const se = [];
    for (let k = 0; k < SEASONS; k++) se.push(medianNum(runs.map((r) => r.seasonCash[k])));
    // X16 check 5: wages paid per season over seasons 2 to 5 against pay plus tips per season.
    const perSeason = (r, key) => { const v = r[key].slice(1); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
    const wagesMed = medianNum(runs.map((r) => perSeason(r, 'wagesBySeason')));
    const payMed = medianNum(runs.map((r) => perSeason(r, 'payBySeason')));
    const share = wagesMed / payMed;
    summary[pol.id] = { drumMed, dwMed, se, share, wagesMed, payMed };
    // v3.2 (D10.2): play minutes a season, 2 s a quick day and every cook at its seconds, against the 45 minute target.
    const mins = [];
    for (let k = 0; k < SEASONS; k++) mins.push(Math.round(medianNum(runs.map((r) => r.secsBySeason[k])) / 6) / 10);
    extra.push(pol.id + ' minutes a season (2 s a quick day, cooks at their seconds; target under 45): ' + mins.join(' ')
      + (pol.grinder ? '; weekday Yard days ' + runs.reduce((a, r) => a + r.yardDays, 0) + ' over ' + runs.length + ' seeds' : '')
      + '; weeks with no cook ' + runs.reduce((a, r) => a + r.noCook, 0));
    if (pol.grinder) {
      const base = summary.steady ? summary.steady.se : [];
      extra.push('grinder (information) cash at each season end ' + se.join(' ') + ' against the base policy at the same stars (steady) ' + base.join(' ')
        + '; stuck ' + stuck.length + '/' + runs.length + ', under 0 ' + under.length + '/' + runs.length);
    } else if (pol.info) {
      // X18.1 item 47: the eager policy is information only.
      const s1 = medianNum(runs.map((r) => r.seasonCash[0]));
      extra.push(pol.id + ' (information): stuck ' + stuck.length + '/' + runs.length + ', under 0 ' + under.length + '/' + runs.length + ', median season 1 cash ' + s1
        + ', drum ' + fmtWeek(drumMed) + ', cash at each season end ' + se.join(' ') + (stuck.length ? '; a Joel playtest watch item (eager stuck, first seed ' + stuck[0].seed + ' ' + stuck[0].stuck + ')' : ''));
    } else {
      console.log([pol.id.padEnd(6), String(pol.stars).padEnd(5), fmtWeek(drumMed).padEnd(5), fmtWeek(pol.drumBand).padEnd(5), (drumOk ? 'PASS' : 'FAIL').padEnd(6),
        fmtWeek(dwMed).padEnd(18), (fmtWeek(pol.drivewayBand) + (dwMed <= pol.drivewayBand ? '' : ' late')).padEnd(12),
        (stuck.length + '/' + runs.length).padEnd(5), idle.length + '/' + runs.length].join(' '));
      checks.push({ ok: drumOk, line: 'drum ' + pol.id + ': median ' + fmtWeek(drumMed) + ' against ' + fmtWeek(pol.drumBand) });
      checks.push({ ok: stuck.length === 0, line: 'never stuck ' + pol.id + ': ' + stuck.length + ' seed(s)' + (stuck.length ? ', first seed ' + stuck[0].seed + ' ' + stuck[0].stuck : '') });
      checks.push({ ok: idle.length === 0, line: 'never idle ' + pol.id + ': ' + idle.length + ' seed(s)' + (idle.length ? ', first seed ' + idle[0].seed + ' ' + idle[0].idle[0] : '') });
      if (pol.id === 'rough') checks.push({ ok: under.length === 0, line: 'rough never under 0: ' + under.length + ' seed(s)' + (under.length ? ', first seed ' + under[0].seed + ' ' + under[0].underZero[0] : '') });
      checks.push({ ok: over.length === 0, line: 'payroll in budget ' + pol.id + ': ' + over.length + ' seed(s) over ' + C.PAYROLL[0] + ', the largest event wages ' + Math.max(...runs.map((r) => r.maxWages)) + (over.length ? ', first seed ' + over[0].seed + ' ' + over[0].overBudget[0] : '') });
      const low = runs.filter((r) => r.stretchLow.length);
      checks.push({ ok: low.length === 0, line: 'the stretch pays the most ' + pol.id + ': ' + low.length + ' seed(s) with a STRETCH card at or under a SAFE BET' + (low.length ? ', first seed ' + low[0].seed + ' ' + low[0].stretchLow[0] : '') });
      if (pol.id === 'sharp' || pol.id === 'steady') {
        checks.push({ ok: share >= 0.08 && share <= 0.40, line: 'payroll is a real sink ' + pol.id + ': median wages ' + Math.round(wagesMed) + ' a season of median pay and tips ' + Math.round(payMed) + ' (seasons 2 to ' + SEASONS + '), ' + (100 * share).toFixed(1) + ' percent, wanted 8 to 40' });
      }
      for (const r of runs) {
        if (!((r.drum === null ? Infinity : r.drum) <= pol.drumBand)) outside.push(pol.id + ' seed ' + r.seed + ': drum ' + fmtWeek(r.drum === null ? Infinity : r.drum) + ' after ' + fmtWeek(pol.drumBand));
        if (!((r.driveway === null ? Infinity : r.driveway) <= pol.drivewayBand)) outside.push(pol.id + ' seed ' + r.seed + ': drivewayAffordable ' + fmtWeek(r.driveway === null ? Infinity : r.driveway) + ' after ' + fmtWeek(pol.drivewayBand) + ' (info)');
        if (r.fallbacks) outside.push(pol.id + ' seed ' + r.seed + ': ' + r.fallbacks + ' week(s) fell back to the Yard day after a refused loadUp');
      }
    }
    // Per week (season 1) and per season, medians over seeds (information).
    const wk = [];
    for (let w = 1; w <= W(); w++) {
      const cash = medianNum(runs.map((r) => (r.weeks.find((x) => x.abs === w) || {}).cash));
      const rep = medianNum(runs.map((r) => (r.weeks.find((x) => x.abs === w) || {}).rep));
      wk.push('W' + w + ' ' + cash + '/' + rep);
    }
    extra.push(pol.id + ' season 1 cash/word of mouth after each week: ' + wk.join(', '));
    extra.push(pol.id + ' cash at each season end: ' + se.map((c, k) => 'S' + (k + 1) + ' ' + c).join(', ') + (V30_SEASON_CASH[pol.id] ? ' (v3.0: ' + V30_SEASON_CASH[pol.id].join(', ') + ')' : ''));
    extra.push(pol.id + ' payroll: median wages ' + Math.round(wagesMed) + ' a season, ' + (100 * share).toFixed(1) + ' percent of pay and tips ' + Math.round(payMed) + ' (seasons 2 to ' + SEASONS + ')');
    extra.push(pol.id + ' season 1 crew: ' + runs.reduce((a, r) => a + r.left1, 0) + ' moved on, ' + runs.reduce((a, r) => a + r.sendoffs1, 0) + ' send-offs, ' + runs.reduce((a, r) => a + r.walkins1, 0) + ' walk-in hires over ' + runs.length + ' seeds'
      + '; crew at the season 1 end (seed ' + runs[0].seed + '): ' + (runs[0].crewAt[0] || 'none'));
    if (VERBOSE) {
      for (const r of runs) {
        console.log('  ' + pol.id + ' seed ' + r.seed + ': drum ' + fmtWeek(r.drum === null ? Infinity : r.drum) + ', drivewayAffordable ' + fmtWeek(r.driveway === null ? Infinity : r.driveway)
          + ', season end cash ' + (r.seasonCash.join(' ') || 'none') + ', stuck ' + (r.stuck || 'no') + ', idle ' + (r.idle.join('; ') || 'no') + (r.underZero.length ? ', under 0 ' + r.underZero.join('; ') : '')
          + ', wages by season ' + r.wagesBySeason.join(' '));
      }
    }
    if (TRACE && runs[0]) {
      console.log('  trace ' + pol.id + ' seed ' + runs[0].seed + ':');
      for (const x of runs[0].weeks) console.log('    ' + fmtWeek(x.abs) + ' ' + x.type + ' ' + x.stars + ' stars, cash ' + x.cash + ', word of mouth ' + x.rep + ', wages ' + x.wages + ', crew ' + x.crew + (x.bought ? ', bought ' + x.bought : ''));
    }
  }
  for (const line of extra) console.log(line);
  // X16 check 7, information.
  const bdays = [];
  for (let seed = 1; seed <= 8; seed++) bdays.push(birthdayRun(seed, LENGTH));
  const okB = bdays.filter((b) => !b.error);
  console.log('Birthday tick by tick, competent bot, no crew, seeds 1 to 8 (information): ' + bdays.map((b) => b.error ? 'seed ' + b.seed + ' ' + b.error
    : 'seed ' + b.seed + ' ' + b.fed + '/' + b.booked + ' fed, ' + b.stars + ' stars, empty line ' + b.maxGap + ' s').join('; '));
  if (okB.length) console.log('  longest empty line while food cooked: ' + Math.max(...okB.map((b) => b.maxGap)) + ' s (expected at most ' + (C.ARRIVAL_PULL_S + C.TICK_SECONDS) + ')');
  if (outside.length) {
    console.log('outside the bands (' + outside.length + '):');
    for (const line of outside.slice(0, 40)) console.log('  ' + line);
    if (outside.length > 40) console.log('  and ' + (outside.length - 40) + ' more');
  }
  let failed = 0;
  for (const c of checks) { console.log((c.ok ? 'PASS ' : 'FAIL ') + c.line); if (!c.ok) failed += 1; }
  console.log(failed ? 'econ: ' + failed + ' enforced check(s) failed' : 'econ: every enforced check passed');
  process.exitCode = failed ? 1 : 0;
}

if (SEASON_MODE) seasonMode();
else { requireV3(); requireV31(); dayMode(); }
