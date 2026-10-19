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
const GEAR_ORDER = ['kettle2', 'cooler', 'buddy', 'bigtable', 'drum', 'tray', 'canopy'];   // the v2.1 day bot
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

// A sim on the week 1 hub: the tutorial skipped, the creator finished with the default look.
function newSeasonSim(seed, length) {
  const sim = P.createSim(null, seed);
  sim.skipTutorial();
  sim.drainEvents();
  sim.setPlayer(P.DEFAULT_LOOK, DEFAULT_NAME, DEFAULT_PIT);
  if (length && length !== 'normal') sim.setLength(length);
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
    const wages = (s.hires.buddy ? C.BUDDY_WAGE : 0) + (s.hires.tender ? C.TENDER_WAGE : 0);
    return { sausage, chicken, bags, reserve: cost + wages + C.DAILY_COSTS };
  };
  for (const g of GEAR_ORDER) {
    const pl = plan();
    if (g === 'buddy') {   // W22.12: no day gate on the buddy in loop week
      if (s.hires.buddy) continue;
      if (s.rep >= 45 && s.cash - pl.reserve - C.BUDDY_WAGE >= 0) { sim.hire('buddy'); bought.push('buddy'); continue; }
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
  const sim = newSeasonSim(seed, LENGTH);
  const rows = [];
  const firsts = {};
  for (let d = 1; d <= days; d++) {
    const s = sim.state;
    if (s.loop === 'seasonEnd') { sim.startSeason(); sim.drainEvents(); }
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
    const lu = sim.loadUp();
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

// ---- mode 2: the season bot (W20) ------------------------------------------------------------

const POLICIES = [
  { id: 'sharp', stars: 5, drumBand: 4, drivewayBand: 9 },     // S1W4 / S1W9
  { id: 'steady', stars: 3, drumBand: 8, drivewayBand: 13 },   // S1W8 / S2W4
  { id: 'rough', stars: 2, drumBand: 18, drivewayBand: 27 }    // S2W9 / S3W9
];
const W = () => C.SEASON_WEEKS;
const absWeek = (year, week) => (year - 1) * W() + week;
const fmtWeek = (abs) => (Number.isFinite(abs) ? 'S' + (Math.floor((abs - 1) / W()) + 1) + 'W' + (((abs - 1) % W()) + 1) : 'never');
function median(list) {
  const v = list.map((x) => (x === null || x === undefined ? Infinity : x)).sort((a, b) => a - b);
  if (!v.length) return Infinity;
  return v[Math.floor(v.length / 2)];   // deviation 2: the upper middle for an even count
}
const medianNum = (list) => { const v = list.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };

// The Birthday's prefill meat cost on an empty cooler at this length (W22.21: 40 at Normal).
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
const wagesOf = (s) => (s.hires.buddy ? C.BUDDY_WAGE : 0) + (s.hires.tender ? C.TENDER_WAGE : 0);

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

// One spend pass in the W20 order; returns what it bought.
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
  if (!s.hires.buddy && s.gear.drum && s.cash >= 200 && sim.hire('buddy').ok) bought.push('buddy');
  if (!s.hires.tender && s.gear.cooler && sim.hire('tender').ok) bought.push('tender');
  return bought;
}

function seasonRun(policy, seed, seasons, length) {
  const sim = newSeasonSim(seed, length);
  const s = sim.state;
  const bdayCost = birthdayMeatCost(length);
  const res = { seed, drum: null, driveway: null, seasonCash: [], stuck: null, underZero: [], idle: [], weeks: [], fallbacks: 0 };
  let lowStreak = 0;
  const total = seasons * W();
  for (let n = 1; n <= total + 1; n++) {
    if (s.loop !== 'week' || s.phase !== 'morning') { res.stuck = res.stuck || ('loop ' + s.loop + ' at ' + fmtWeek(n)); break; }
    const abs = absWeek(s.season.year, s.season.week);
    const finalPass = n === total + 1;
    // Week start: never stuck and the driveway milestone (cash at week start, deposit excluded).
    if (!finalPass) {
      lowStreak = s.cash < bdayCost ? lowStreak + 1 : 0;
      if (lowStreak >= 2 && !res.stuck) res.stuck = 'cash under ' + bdayCost + ' two weeks running at ' + fmtWeek(abs);
      if (res.driveway === null && s.gear.drum && s.rep >= C.DRIVEWAY_REP && s.cash >= C.DRIVEWAY_PRICE) res.driveway = abs;
    }
    // 1. pick and read the prefilled cart; reserve.
    const pick = choosePick(sim, policy);
    sim.bookOffer(pick.id);
    const reserve = Math.max(0, sim.cartTotal() - (pick.deposit | 0)) + wagesOf(s) + C.DAILY_COSTS;
    // 2. empty every cart line; 3. spend; hires.
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
    // 4. book again to re-prefill; 5. load up (a refused pick falls back to the Yard day).
    let booked = s.season.offers.find((o) => o.id === pick.id) || s.season.offers[0];
    // P-8: a gear buy can turn a stretch offer safe (W22.11), so pick again and keep it when it loads up.
    const again = choosePick(sim, policy);
    if (again && again.id !== booked.id) {
      sim.bookOffer(again.id);
      if (sim.canLoadUp().ok) booked = again;
    }
    sim.bookOffer(booked.id);
    let lu = sim.loadUp();
    if (!lu.ok) {
      const yard = s.season.offers.find((o) => o.type === 'yard');
      if (yard && yard.id !== booked.id) { sim.bookOffer(yard.id); lu = sim.loadUp(); booked = yard; res.fallbacks += 1; }
    }
    sim.drainEvents();
    if (!lu.ok) { res.stuck = res.stuck || ('loadUp refused at ' + fmtWeek(abs) + ': ' + (sim.canLoadUp().reason || lu.message)); break; }
    const cashAfterLoad = s.cash;
    // 6. the cook.
    const kind = s.today.kind;
    if (kind === 'booking') {
      if (sim.settle(policy.stars) !== true) { res.stuck = res.stuck || ('settle refused at ' + fmtWeek(abs)); break; }
    } else {
      playEvent(sim);
    }
    sim.drainEvents();
    const t = s.till;
    // W22.21: cash before the CASH_FLOOR clamp.
    const preClamp = cashAfterLoad + (t.payRest | 0) + (t.menuBonus | 0) + (t.tips | 0) + (t.seatTips | 0) + (t.revenue | 0) - (t.wages | 0) - C.DAILY_COSTS;
    if (preClamp < 0) res.underZero.push(fmtWeek(abs) + ' ' + preClamp);
    res.weeks.push({ abs, type: booked.type, stars: t.stars | 0, cash: s.cash, rep: s.rep, bought: bought.join(' ') });
    // 7. next.
    sim.finishReport();
    sim.drainEvents();
    if (s.loop === 'seasonEnd') {
      res.seasonCash.push(s.cash);
      sim.startSeason();
      sim.drainEvents();
    }
  }
  return res;
}

function seasonMode() {
  requireV3();
  const header = 'econ season bot: ' + SEEDS.length + ' seeds (' + SEEDS[0] + ' to ' + SEEDS[SEEDS.length - 1] + '), ' + SEASONS + ' seasons, length ' + LENGTH
    + '; Birthday meat on an empty cooler ' + birthdayMeatCost(LENGTH) + '; driveway ' + C.DRIVEWAY_PRICE + ' at word of mouth ' + C.DRIVEWAY_REP;
  console.log(header);
  console.log('policy stars drum band result drivewayAffordable band(info) stuck idle');
  const checks = [];
  const outside = [];
  const extra = [];
  for (const pol of POLICIES) {
    const runs = SEEDS.map((seed) => seasonRun(pol, seed, SEASONS, LENGTH));
    const drumMed = median(runs.map((r) => r.drum));
    const dwMed = median(runs.map((r) => r.driveway));
    const stuck = runs.filter((r) => r.stuck);
    const idle = runs.filter((r) => r.idle.length);
    const under = runs.filter((r) => r.underZero.length);
    const drumOk = drumMed <= pol.drumBand;
    console.log([pol.id.padEnd(6), String(pol.stars).padEnd(5), fmtWeek(drumMed).padEnd(5), fmtWeek(pol.drumBand).padEnd(5), (drumOk ? 'PASS' : 'FAIL').padEnd(6),
      fmtWeek(dwMed).padEnd(18), (fmtWeek(pol.drivewayBand) + (dwMed <= pol.drivewayBand ? '' : ' late')).padEnd(12),
      (stuck.length + '/' + runs.length).padEnd(5), idle.length + '/' + runs.length].join(' '));
    checks.push({ ok: drumOk, line: 'drum ' + pol.id + ': median ' + fmtWeek(drumMed) + ' against ' + fmtWeek(pol.drumBand) });
    checks.push({ ok: stuck.length === 0, line: 'never stuck ' + pol.id + ': ' + stuck.length + ' seed(s)' + (stuck.length ? ', first seed ' + stuck[0].seed + ' ' + stuck[0].stuck : '') });
    checks.push({ ok: idle.length === 0, line: 'never idle ' + pol.id + ': ' + idle.length + ' seed(s)' + (idle.length ? ', first seed ' + idle[0].seed + ' ' + idle[0].idle[0] : '') });
    if (pol.id === 'rough') checks.push({ ok: under.length === 0, line: 'rough never under 0: ' + under.length + ' seed(s)' + (under.length ? ', first seed ' + under[0].seed + ' ' + under[0].underZero[0] : '') });
    for (const r of runs) {
      if (!((r.drum === null ? Infinity : r.drum) <= pol.drumBand)) outside.push(pol.id + ' seed ' + r.seed + ': drum ' + fmtWeek(r.drum === null ? Infinity : r.drum) + ' after ' + fmtWeek(pol.drumBand));
      if (!((r.driveway === null ? Infinity : r.driveway) <= pol.drivewayBand)) outside.push(pol.id + ' seed ' + r.seed + ': drivewayAffordable ' + fmtWeek(r.driveway === null ? Infinity : r.driveway) + ' after ' + fmtWeek(pol.drivewayBand) + ' (info)');
      if (r.fallbacks) outside.push(pol.id + ' seed ' + r.seed + ': ' + r.fallbacks + ' week(s) fell back to the Yard day after a refused loadUp');
    }
    // Per week (season 1) and per season, medians over seeds (information).
    const wk = [];
    for (let w = 1; w <= W(); w++) {
      const cash = medianNum(runs.map((r) => (r.weeks.find((x) => x.abs === w) || {}).cash));
      const rep = medianNum(runs.map((r) => (r.weeks.find((x) => x.abs === w) || {}).rep));
      wk.push('W' + w + ' ' + cash + '/' + rep);
    }
    const se = [];
    for (let k = 0; k < SEASONS; k++) se.push('S' + (k + 1) + ' ' + medianNum(runs.map((r) => r.seasonCash[k])));
    extra.push(pol.id + ' season 1 cash/word of mouth after each week: ' + wk.join(', '));
    extra.push(pol.id + ' cash at each season end: ' + se.join(', '));
    if (VERBOSE) {
      for (const r of runs) {
        console.log('  ' + pol.id + ' seed ' + r.seed + ': drum ' + fmtWeek(r.drum === null ? Infinity : r.drum) + ', drivewayAffordable ' + fmtWeek(r.driveway === null ? Infinity : r.driveway)
          + ', season end cash ' + (r.seasonCash.join(' ') || 'none') + ', stuck ' + (r.stuck || 'no') + ', idle ' + (r.idle.join('; ') || 'no') + (r.underZero.length ? ', under 0 ' + r.underZero.join('; ') : ''));
      }
    }
    if (TRACE && runs[0]) {
      console.log('  trace ' + pol.id + ' seed ' + runs[0].seed + ':');
      for (const x of runs[0].weeks) console.log('    ' + fmtWeek(x.abs) + ' ' + x.type + ' ' + x.stars + ' stars, cash ' + x.cash + ', word of mouth ' + x.rep + (x.bought ? ', bought ' + x.bought : ''));
    }
  }
  for (const line of extra) console.log(line);
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
else { requireV3(); dayMode(); }
