// games/pit-sim/dev/econ.mjs
// Season economy bot, v4 (2026-10-20). Dev only, never shipped, not a harness step.
//
// Plays whole seasons on the current rules through ../sim.js only (no DOM), the way the game UI
// drives a week: Hiring Day, the week hub (book an offer, buy gear), the Monday planner, each
// morning's shop (the game's own starter cart or prefill), every cook tick by tick with a player
// bot that works the register, carries plates to seated guests, tends the fire and pulls meat on
// time, the report, then the next day. The week 7 competition is settled at 3 stars (the bot does
// not box turn-ins); weeks 1 to 6 are played in full.
//
// Strategies:
//   cautious  one cheap RUN card, rests every weekday (Skip to the weekend), the smallest safe
//             booking, gear only with 150 left over.
//   typical   drafts a FIRE and a RUN card and brings both everywhere, takes the highest paying
//             safe booking, follows the planner's prefilled Yard days and the big Start button,
//             buys gear in order with 80 left over.
//   greedy    the stretch booking when it can load, Yard days every weekday and Sunday, both cards
//             brought everywhere, gear with 30 left over.
//   nocrew    typical without any crew.
//   typicalpit typical, and from the week 3 hub a 3 star PIT card (v4.3) signed as a walk-in once the
//             yard has the cabinet smoker (the FIRE card goes when the wages cap needs the room). The
//             PIT card works the bookings and rests on Yard days and at the competition; the bot
//             leaves its cooker to it. ECON_LETGO=1 lets the FIRE card go when the cap is full.
//
//   --pitpair  paired cooks (v4.3): the typical season forked at its first stick burner booking and
//             at its first weekday Yard day with a kettle beside the cabinet smoker, played once
//             without and once with a 3 star PIT card (on the second kettle, and on the stick burner
//             at the booking); prints the median cash difference after the PIT card's wage.
//
// Usage:
//   node games/pit-sim/dev/econ.mjs                       all four strategies, seeds 1 to 30
//   node games/pit-sim/dev/econ.mjs --seeds 1-60 --strategy typical
//   node games/pit-sim/dev/econ.mjs --ledger --seed 3 --strategy typical    one seed's day ledger
//
//   careless  greedy with slow hands (3 s between taps) and no cash reserve before gear.
//   --react N sets the seconds between taps for the others (default 1.5, 0 is a perfect bot).
//   --sim path runs another copy of sim.js (a before copy, for comparisons).
//
// v4.4 the real pace phone player (Joel 2026-10-20, "Still losing money here"): a tap 2.5 to 3.5 s
// after the last (the walk inside it), the game's own cart, the planner's default and Start, the Gear
// tile's Next once it leaves 40, the fire fed under 30, pulls a few seconds late, 1 piece in 14 burnt.
//   realsolo      no crew.          real          on Hiring Day the first card under the wage line.
//   realhire      the first card it can sign (ignores the wage line, as Joel did).
//   realcareless  realhire, a Yard day every day, the stretch booking, 3 more chicken on every cart,
//                 1 piece in 4 burnt, no reserve before gear.
//   --days        the per day ledger over every seed (means; cash the median at day end).
//
// Output: per strategy, median cash at the end of each week (and at the season end), median gear
// owned, and the season's money by line summed over seeds: revenue, tips, booking pay, meat and
// charcoal bought, gear, wages, daily costs, refunds, spoilage, waste, leftover stock value.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const simArg = process.argv.indexOf('--sim');
const simPath = simArg > 0 ? path.resolve(process.argv[simArg + 1]) : path.resolve(here, '..', 'sim.js');   // --sim: another sim.js (a before copy)
vm.runInThisContext(fs.readFileSync(simPath, 'utf8'), { filename: simPath });
const P = globalThis.PitSim;
const { C, MAP, MEATS, MEAT_IDS, CATALOG } = P;
const ROW = Object.fromEntries(CATALOG.map((r) => [r.id, r]));
const COOKERS = ['kettle1', 'kettle2', 'drum'];

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (n) => process.argv.includes(n);
function seedList(spec) {
  const m = /^(\d+)-(\d+)$/.exec(spec);
  if (m) { const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; }
  return String(spec).split(',').map(Number).filter(Number.isFinite);
}
const LEDGER = flag('--ledger');
const SEEDS = LEDGER ? [Number(arg('--seed', 1))] : seedList(arg('--seeds', '1-30'));
const STRATS = arg('--strategy', 'cautious,typical,greedy,careless,nocrew').split(',');

const STRAT = {
  cautious: { crew: ['run'], cheap: true, plan: 'skip', sunday: false, offer: 'small', reserve: 150 },
  typical: { crew: ['fire', 'run'], cheap: false, plan: 'default', sunday: 'rec', offer: 'pay', reserve: 80 },
  greedy: { crew: ['fire', 'run'], cheap: false, plan: 'all', sunday: true, offer: 'stretch', reserve: 30 },
  nocrew: { crew: [], cheap: false, plan: 'default', sunday: 'rec', offer: 'pay', reserve: 80 },
  typicalpit: { crew: ['fire', 'run'], cheap: false, plan: 'default', sunday: 'rec', offer: 'pay', reserve: 80, pit: 3 },
  careless: { crew: ['fire', 'run'], cheap: false, plan: 'all', sunday: true, offer: 'stretch', reserve: 0, react: 3 },
  // v4.4 the real pace phone player (Joel 2026-10-20, "Still losing money here"): a tap every 2.5 to
  // 3.5 s plus the walk, the game's own cart as is, the planner's default and the Start button, on
  // Hiring Day the first card it can sign (the UI asks before an empty pass), the Gear tile's Next
  // item once it leaves 40, a fire fed late, pulls a few seconds late and a burn now and then.
  real: { crew: [], ui: true, heed: true, cheap: false, plan: 'default', sunday: 'rec', offer: 'pay', reserve: 40, real: true },
  // real pace and careless: a Yard day every day, the stretch booking, no reserve before gear, the
  // first card it can sign, 3 more units of chicken on every cart, and 1 piece in 4 left to burn.
  realcareless: { crew: [], ui: true, heed: false, cheap: false, plan: 'all', sunday: true, offer: 'stretch', reserve: 0, real: true, over: 3, burn: 0.25 },
  realhire: { crew: [], ui: true, heed: false, cheap: false, plan: 'default', sunday: 'rec', offer: 'pay', reserve: 40, real: true },   // ignores the wage line
  realsolo: { crew: [], ui: false, cheap: false, plan: 'default', sunday: 'rec', offer: 'pay', reserve: 40, real: true }
};
// The Gear tile's Next item: the first unowned gear row in catalog order (game.js R-10).
const uiNextGear = (s, sim) => { if (sim && sim.nextGear) { const n = sim.nextGear(); return n ? n.id : null; } const r = CATALOG.find((x) => x.kind === 'gear' && s.gear[x.id] !== true); return r ? r.id : null; };
// v4.1 the gear ladder: the cabinet smoker early, the stick burner mid season, the trailer last.
const GEAR_ORDER = ROW.cabinet && !process.env.ECON_OLD ? ['cabinet', 'kettle2', 'offset', 'cooler', 'bigtable', 'tray', 'drum', 'canopy', 'trailer'] : ['kettle2', 'cooler', 'bigtable', 'tray', 'drum', 'canopy'];
const woodOf = (id) => (MAP.station(id).fuel || 'charcoal') === 'wood';
const brisketOn = (id) => MAP.station(id).brisket === true || (MAP.station(id).brisket === undefined && id === 'drum');
const canBrisket = (s) => (P.canBrisket ? P.canBrisket(s.gear) : s.gear.drum === true);

// ---- the cook bot ----------------------------------------------------------------------------

function stationTile(sim, id) { const t = MAP.station(id).tiles[0]; return { x: t.x, y: t.y }; }
const owned = (s, id) => P.tileOwned(MAP.station(id), s.gear);
function freeSlot(ck, size) {
  const taken = new Array(ck.slots).fill(false);
  for (const p of ck.pieces) for (let i = 0; i < p.size; i++) taken[p.slot + i] = true;
  for (let i = 0; i + size <= ck.slots; i++) { let ok = true; for (let j = 0; j < size; j++) if (taken[i + j]) ok = false; if (ok) return true; }
  return false;
}
function hash(n) { let x = (n * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x >>> 8) / 16777216; }
const awaitsPlate = (c) => c.paid === true && c.fed !== true && (c.mode === 'toSeat' || c.mode === 'seated' || c.mode === 'togo');
function tableFits(s, meat) {
  const sp = s.stations.table.spots;
  return sp.some((x) => x && x.meat === meat && x.times.length < C.TABLE_STACK) || sp.some((x) => x === null);
}
function boardFits(s, meat, plates) {
  if (s.stations.board.stacks.some((x) => x.meat === meat && x.times.length + plates <= C.BOARD_STACK)) return true;
  return s.stations.board.stacks.length < C.BOARD_STACKS && plates <= C.BOARD_STACK;
}
function platesInPlay(s, m) {
  let n = 0;
  for (const id of COOKERS) for (const p of s.stations[id].pieces) if (p.meat === m && p.state !== 'burnt') n += MEATS[m].plates;
  for (const st of s.stations.board.stacks) if (st.meat === m) n += st.times.length;
  for (const sp of s.stations.table.spots) if (sp && sp.meat === m) n += sp.times.length;
  if (s.player.carrying && s.player.carrying.meat === m) n += s.player.carrying.kind === 'plates' ? s.player.carrying.times.length : MEATS[m].plates;
  const pc = s.pitCard ? s.pitCard.carrying : null;   // v4.3
  if (pc && pc.meat === m && pc.kind !== 'burnt') n += MEATS[m].plates;
  for (const w of s.stations.board.waiting || []) if (w.meat === m) n += MEATS[m].plates;
  if (s.stations.board.slicing && s.stations.board.slicing.meat === m && s.stations.board.slicing.who !== 'player') n += MEATS[m].plates;
  return n;
}
function decide(sim) {
  const s = sim.state;
  const t = s.today;
  const tile = (id) => stationTile(sim, id);
  const pitOn = s.pitCard ? s.pitCard.cooker : null;   // v4.3: the PIT card's cooker is left to it
  const cookers = COOKERS.filter((id) => owned(s, id) && id !== pitOn);
  const fireOf = (id) => s.stations[id].fire;
  const c = s.player.carrying;
  const seatOf = (g) => MAP.seats.find((x) => x.id === g.seat);
  if (c) {
    if (c.kind === 'charcoal') { const cc = cookers.filter((id) => !woodOf(id)); if (!cc.length) return tile('trash'); let b = cc[0]; for (const id of cc) if (fireOf(id) < fireOf(b)) b = id; return tile(b); }
    if (c.kind === 'raw') {
      const m = MEATS[c.meat];
      const ok = cookers.filter((id) => (!m.drumOnly || brisketOn(id)) && freeSlot(s.stations[id], m.slots) && fireOf(id) >= C.COLD_UNDER);
      if (ok.length) { ok.sort((a, b) => fireOf(b) - fireOf(a)); return tile(ok[0]); }
      return null;
    }
    if (c.kind === 'cooked') return boardFits(s, c.meat, MEATS[c.meat].plates) ? tile('board') : tile('trash');
    if (c.kind === 'burnt') return tile('trash');
    if (c.kind === 'plates') {
      const g = s.customers.filter((cu) => awaitsPlate(cu) && !cu.togo && cu.seat && cu.want === c.meat).sort((a, b) => a.paidAt - b.paidAt)[0];
      if (g) { const se = seatOf(g); return { x: se.x, y: se.y }; }
      return tableFits(s, c.meat) ? tile('table') : tile('trash');
    }
    if (c.kind === 'box') return tile('table');
    return null;
  }
  // 1. pull done (or burnt) meat
  let pull = null, pullKey = -Infinity;
  for (const id of cookers) for (const p of s.stations[id].pieces) {
    if (p.state === 'cooking') continue;
    if (REAL && p.state === 'done' && p.prog - MEATS[p.meat].cook < lateOf(s, p)) continue;   // not noticed yet
    const key = p.state === 'burnt' ? 0.5 : 1 + (p.prog - MEATS[p.meat].cook);
    if (key > pullKey) { pullKey = key; pull = id; }
  }
  if (pull && pullKey >= 1) return tile(pull);
  const stockLeft = MEAT_IDS.some((m) => s.stock[m] > 0);
  const needsFire = (id, under) => {
    const ck = s.stations[id];
    if (ck.fire >= under) return false;
    if (ck.pieces.some((p) => p.state === 'cooking' || p.state === 'done')) return true;
    return stockLeft && s.clock < t.lastCallAt;
  };
  const tender = !!s.tender;
  const feed = (under) => {   // v4.1: a wood cooker takes a split at the cooker itself
    for (const id of cookers) if (needsFire(id, under) && (woodOf(id) ? s.wood > 0 : s.charcoal > 0)) return tile(woodOf(id) ? id : 'pile');
    return null;
  };
  if (!tender) { const f = feed(REAL ? 30 : 40); if (f) return f; }
  // 2. ring up the line (unless a TILL card does it)
  const line = s.customers.filter((o) => o.queueIndex >= 0 && o.mode === 'waiting' && !o.booked).length;
  if (line > 0 && !s.cashier) return tile('register');
  // 3. a plate on the counter for a seated guest (unless a RUN card is out)
  const runner = !!s.buddy;
  if (!runner && s.customers.some((cu) => awaitsPlate(cu) && !cu.togo && cu.seat && s.stations.table.spots.some((x) => x && x.meat === cu.want))) return tile('table');
  if (!tender) { const f = feed(REAL ? 40 : 50); if (f) return f; }
  if (!runner && s.stations.board.stacks.some((st) => st.times.length > 0 && tableFits(s, st.meat))) return tile('board');
  if (pull) return tile(pull);
  // 4. put meat on: what the waiting guests want first, else the meat that cooks soonest
  if (!stockLeft || s.clock > t.lastCallAt + 5) return null;
  const cookable = (m) => (!MEATS[m].drumOnly || canBrisket(s)) && s.stock[m] > 0;
  const want = {};
  for (const cu of s.customers) if (awaitsPlate(cu) || (cu.queueIndex >= 0 && cu.mode === 'waiting')) want[cu.want] = (want[cu.want] || 0) + 1;
  let pick = null;
  for (const m of MEAT_IDS) if (cookable(m) && (want[m] || 0) > platesInPlay(s, m)) { pick = m; break; }
  if (pick === null) {
    // keep a few plates ahead of the line, but not more than the crowd still to come
    const ahead = MEAT_IDS.reduce((a, m) => a + platesInPlay(s, m), 0);
    const left = Math.max(0, t.lastCallAt - s.clock);
    const toCome = Math.ceil(left / Math.max(3, sim.spawnIntervalNow ? sim.spawnIntervalNow() : 8)) + 2;
    if (t.kind === 'booking' ? false : ahead >= toCome) return null;
    for (const m of MEAT_IDS) {
      if (!cookable(m)) continue;
      if (t.kind === 'booking' && !(t.rail[m] > 0)) continue;
      if (pick === null || s.stock[m] > s.stock[pick] || (s.stock[m] === s.stock[pick] && MEATS[m].cook < MEATS[pick].cook)) pick = m;
    }
  }
  if (pick === null) return null;
  const slotOk = cookers.some((id) => (!MEATS[pick].drumOnly || brisketOn(id)) && freeSlot(s.stations[id], MEATS[pick].slots) && fireOf(id) >= C.FIRE_GOOD - 5);
  if (!slotOk) return null;
  sim.selectMeat(pick);
  return tile('cooler');
}
// REACT: seconds a human takes to look, decide and tap between actions (0 is a perfect bot).
const REACT0 = Number(arg('--react', 1.5));
let REACT = REACT0;
let REAL = false;   // v4.4 the real pace player
let BURN = 0.07;    // the share of pieces it loses track of until they burn
// Seconds past done before the real player notices a piece: a few seconds most of the time, and one
// piece in about 14 is lost track of until it burns. A hash of the season seed, day and piece id.
function lateOf(s, p) {
  const h = hash((s.season.seed >>> 0) % 100000 * 131 + (s.season.week * 7 + s.season.day) * 977 + p.id * 31);
  const w = MEATS[p.meat].window;
  return h < BURN ? w + 1 : w * (0.05 + 0.4 * (h - BURN) / (1 - BURN));
}
// v4.2: taps the bot spends in a cook (each walkTo the sim takes, each trash tap), for taps per plate.
let TAPS = 0;
function playCook(sim, evs) {
  const s = sim.state;
  let g = 0;
  let readyAt = 0;
  let wasIdle = false;
  while (s.phase === 'service' && g++ < 200000) {
    const p = s.player;
    const idle = !(p.busy || p.next || p.path.length || p.target);
    // v4.4: the real player taps 2.5 to 3.5 s after the last tap (the walk counts inside that gap).
    if (idle && !wasIdle && !REAL) readyAt = s.clock + REACT * (0.6 + 0.8 * hash(g));
    wasIdle = idle;
    if (idle && s.clock >= readyAt) {
      wasIdle = false;
      const t = decide(sim);
      if (process.env.ECON_TRACE && process.env.ECON_TRACE === s.season.week + '.' + s.season.day && g % 3 === 0) console.log('T', s.clock.toFixed(1), JSON.stringify(t), JSON.stringify(s.player.carrying), 'wood', s.wood, 'coal', s.charcoal, COOKERS.map((id) => owned(s, id) ? id + ':' + s.stations[id].fire.toFixed(0) + ':' + s.stations[id].pieces.map((p) => p.meat + '/' + p.state).join('|') : '').join(' '), JSON.stringify(s.stock), sim.verbAt ? sim.verbAt().label : '');
      // The trash never acts on arrival (auto false): once there, tap it.
      const tr = MAP.station('trash').tiles[0];
      if (t && t.x === tr.x && t.y === tr.y && sim.reach() === 'trash' && sim.verbAt().enabled) { sim.interact(); TAPS += 1; if (REAL) readyAt = s.clock + 2.5 + hash(g + 7); }
      else if (t) { const ok = sim.walkTo(t.x, t.y); if (ok) TAPS += 1; if (REAL) readyAt = s.clock + 2.5 + hash(g + 7); if (!ok && process.env.ECON_DEBUG) console.log('walk refused', JSON.stringify(t), JSON.stringify(s.player.carrying)); }
      else if (process.env.ECON_DEBUG && (g % 200 === 0)) console.log('idle', s.clock.toFixed(1), JSON.stringify(s.player.carrying), JSON.stringify(s.stock), s.charcoal, COOKERS.map((id) => owned(s, id) ? id + ':' + s.stations[id].fire.toFixed(0) + ':' + s.stations[id].pieces.map((p) => p.meat + '/' + p.state).join('|') : '').join(' '), 'line', s.customers.filter((o) => o.queueIndex >= 0).length);
    }
    sim.tick();
    for (const e of sim.drainEvents()) evs.push(e);
  }
}

// ---- the week ------------------------------------------------------------------------------

const stockValue = (s) => MEAT_IDS.reduce((a, m) => a + s.stock[m] * ROW[m].price, 0);
const cartSplit = (sim) => {
  const s = sim.state, mult = C.DAY_PRICE[s.season.day];
  let meat = 0;
  for (const m of MEAT_IDS) if (s.cart.meat[m] > 0) meat += Math.round(s.cart.meat[m] * ROW[m].price * mult);
  const coal = (s.cart.charcoal > 0 ? Math.round(s.cart.charcoal * ROW.charcoal.price * mult) : 0)
    + (ROW.wood && s.cart.wood > 0 ? Math.round(s.cart.wood * ROW.wood.price * mult) : 0);   // v4.1: wood splits count with the charcoal
  return { meat, coal };
};

// The wages the yard can sign (v4.0 grows it with the gear; older rules: the payroll).
const capOf = (sim) => { const p = sim.payroll(); return p.hire !== undefined ? p.hire : C.PAYROLL[0]; };
function hiring(sim, st) {
  const s = sim.state;
  if (st.real) {   // v4.4: the first card on the page it can sign, in round 1; pass the rest
    for (let round = 1; round <= C.HIRE_ROUNDS && s.loop === 'hiring'; round++) {
      const v = sim.hiringView();
      // v4.4 heed: under the Hiring Day wage line when the game shows one (hv.money.half)
      const line = st.heed && v && v.money && v.money.warn ? v.money.half : Infinity;
      const pick = st.ui && round === 1 && v ? v.pool.find((e) => e.status === 'open' && e.wage <= capOf(sim) && e.wage <= line) : null;
      if (pick) sim.hireApplicant(pick.idx); else sim.passRound();
      sim.drainEvents();
    }
    if (s.loop === 'hiring') sim.finishHiring();
    sim.drainEvents();
    for (const c of s.crew) sim.setBring(c.id, true);
    return;
  }
  for (let round = 1; round <= C.HIRE_ROUNDS && s.loop === 'hiring'; round++) {
    const role = st.crew.find((r) => !s.crew.some((c) => c.role === r)) || null;
    const v = sim.hiringView();
    const wages = s.crew.reduce((a, c) => a + c.wage, 0);
    const open = role && v ? v.pool.filter((e) => e.status === 'open' && e.role === role && wages + e.wage <= capOf(sim)) : [];
    open.sort(st.cheap ? (a, b) => a.wage - b.wage || b.stars - a.stars : (a, b) => b.stars - a.stars || a.wage - b.wage);
    if (open.length && s.crew.length < sim.payroll().slots) sim.hireApplicant(open[0].idx); else sim.passRound();
    sim.drainEvents();
  }
  if (s.loop === 'hiring') sim.finishHiring();
  sim.drainEvents();
  for (const c of s.crew) sim.setBring(c.id, true);
}

// v4.3: a 3 star PIT card signed as a walk-in (the fee is one wage); the FIRE card goes when the
// wages cap needs the room.
function pitWalkin(sim, stars) {
  const s = sim.state;
  s.season.walkins.push({ name: 'Dee', role: 'pit', skills: [stars, stars], potential: stars, mood: 0, look: Object.assign({}, P.DEFAULT_LOOK), stars, wage: P.wageFor(stars, 'pit'), hired: false });
  return s.season.walkins.length - 1;
}
function hirePit(sim, led) {
  const s = sim.state;
  const before = s.cash;
  const i = pitWalkin(sim, 3);
  let r = sim.hireWalkin(i);
  if (!r.ok && LETGO && /wages/.test(r.message)) { const f = s.crew.find((c) => c.role === 'fire'); if (f && sim.letGo(f.id).ok) r = sim.hireWalkin(i); }
  if (!r.ok) s.season.walkins.splice(i, 1);
  else sim.setBring(r.id, true);
  led.other += s.cash - before;
  sim.drainEvents();
  return r.ok;
}
const LETGO = !!process.env.ECON_LETGO;   // let the FIRE card go to make room (else wait for the cap)
let FORK = null;   // --pitpair: called on each cook morning before the shop

function pickOffer(sim, st) {
  const s = sim.state;
  const offers = s.season.offers.filter((o) => o.type !== 'yard');
  if (s.season.week === C.SEASON_WEEKS) return offers[0] || null;
  const safe = offers.filter((o) => o.safe);
  if (st.offer === 'stretch') { const str = offers.filter((o) => o.safe && o.tier === 'stretch'); if (str.length) return str.sort((a, b) => b.pay - a.pay)[0]; }
  if (!safe.length) return null;
  if (st.offer === 'small') return safe.sort((a, b) => a.headcount - b.headcount)[0];
  return safe.sort((a, b) => b.pay - a.pay)[0];
}

function buyGear(sim, st, led) {
  const s = sim.state;
  if (st.real) {   // v4.4: the Gear tile's Next item, once it leaves the reserve
    for (let k = 0; k < 3; k++) {
      const g = uiNextGear(s, sim);
      if (!g || s.cash - ROW[g].price < st.reserve) return;
      const r = sim.buy(g, 1);
      if (!r || !r.ok) return;
      led.gear += ROW[g].price;
      led.bought = (led.bought || []).concat(g);
    }
    return;
  }
  for (const g of GEAR_ORDER) {
    if (s.gear[g]) continue;
    const row = ROW[g];
    if (row.needs && row.needs.gear && !s.gear[row.needs.gear]) return;
    if (s.cash - row.price < st.reserve) return;
    const r = sim.buy(g, 1);
    if (!r || !r.ok) return;
    led.gear += row.price;
    led.bought = (led.bought || []).concat(g);
  }
}

function newLedgerRow(sim, label) {
  const s = sim.state;
  return { wk: s.season.week, day: s.season.day, kind: label, cashStart: s.cash, meatBuy: 0, coalBuy: 0, gear: 0,
    revenue: 0, tips: 0, pay: 0, wages: 0, daily: 0, refunds: 0, refundN: 0, walkouts: 0, served: 0, customers: 0,
    spoil: 0, waste: 0, boxed: 0, overtime: 0, cashEnd: 0, stockEnd: 0, coalEnd: 0, other: 0 };
}

function playSeason(seed, stName) {
  const st = STRAT[stName];
  REACT = st.react !== undefined ? st.react : REACT0;
  REAL = st.real === true;
  BURN = st.burn !== undefined ? st.burn : 0.07;
  const sim = P.createSim(null, seed);
  sim.skipTutorial(); sim.drainEvents();
  sim.setPlayer(P.DEFAULT_LOOK, 'Pitmaster', 'Your Pit'); sim.drainEvents();
  const s = sim.state;
  if (s.loop === 'hiring') hiring(sim, st);
  if (!st.crew.length && !st.ui) for (const c of s.crew) sim.setBring(c.id, false);
  const rows = [];
  const weekEnd = [];
  let hub = null;
  let guard = 0;
  while (s.loop === 'week' && guard++ < 400) {
    const week = s.season.week;
    if (s.season.day === 0 && s.phase === 'morning' && hub !== week) {
      hub = week;
      // the week hub
      const pre = newLedgerRow(sim, 'hub');
      buyGear(sim, st, pre);
      // bring a rested card once the payroll has room for it (the payroll grows with the gear)
      if (st.crew.length) for (const c of s.crew) if (!c.bring && !s.crew.some((o) => o.bring && o.role === c.role) && sim.payroll().now + c.wage <= sim.payroll().budget) sim.setBring(c.id, true);
      // a careless player also hires the best walk-in when a role is missing
      if (st.crew.length) for (const role of st.crew) {
        if (s.crew.some((c) => c.role === role) || s.crew.length >= sim.payroll().slots) continue;
        const w = (s.season.walkins || []).map((x, i) => [x, i]).filter(([x]) => !x.hired && x.role === role && s.crew.reduce((n, c) => n + c.wage, 0) + x.wage <= capOf(sim)).sort((a, b) => b[0].stars - a[0].stars)[0];
        if (w && s.cash - w[0].wage - st.reserve >= 60) { const before = s.cash; if (sim.hireWalkin(w[1]).ok) pre.other += s.cash - before; }
      }
      if (st.pit && week >= st.pit && sim.pitOpen && sim.pitOpen() && !s.crew.some((c) => c.role === 'pit')) hirePit(sim, pre);
      const o = pickOffer(sim, st);
      if (o) sim.bookOffer(o.id);
      pre.cashEnd = s.cash;
      if (pre.gear) rows.push(pre);
      while (sim.pitView().pending > 0 && sim.pickPitSkill('longDay').ok) { /* Long Day */ }
      sim.drainEvents();
    }
    if (process.env.ECON_DEBUG) console.log("loop", s.season.week, s.season.day, s.phase, s.cash, s.season.booking && s.season.booking.id, JSON.stringify(sim.planView() && sim.planView().plan), (sim.recommendDay()||{}).kind, s.loop);
    if (sim.planView()) {
      if (st.plan === 'skip') sim.skipToWeekend();
      else if (st.plan === 'all') { for (let d = 0; d < C.PLAN_DAYS; d++) sim.setPlanDay(d, 'yard'); sim.startPlan(); }
      else sim.startPlan();
      sim.drainEvents();
      continue;
    }
    const rv = sim.rescueView();
    if (rv) {
      const r = newLedgerRow(sim, 'rescue');
      if (rv.advance > 0) sim.rescueAdvance();
      else if (rv.gear.length) sim.rescueSell(rv.gear[rv.gear.length - 1].id);
      else sim.rescueRestart();
      r.other = s.cash - r.cashStart; r.cashEnd = s.cash; rows.push(r);
      sim.drainEvents();
      continue;
    }
    if (s.phase === 'evening') { sim.advanceDay(); sim.drainEvents(); continue; }
    const rec = sim.recommendDay();
    let kind = rec.kind;
    const d = s.season.day;
    const booked = sim.dayOptions().booked;
    if (!booked) {
      if (d === 6 && st.sunday === true) kind = 'yard';
      if (d === 6 && st.sunday === false) kind = 'off';
      if (d === 5 && st.plan === 'skip' && !booked) kind = 'off';
    }
    if (kind === 'off') {
      const before = stockValue(s);
      sim.chooseDay('off'); sim.drainEvents();
      const sp = before - stockValue(s);
      if (sp > 0) { const r = newLedgerRow(sim, 'rest'); r.spoil = sp; r.cashEnd = s.cash; r.wk = week; rows.push(r); }
      continue;
    }
    // a cook day: the morning shop with the game's cart, then the cook
    const r = newLedgerRow(sim, kind === 'event' ? (s.season.booking.type) : (d <= 4 ? 'yard-wkday' : 'yard-wkend'));
    if (process.env.ECON_DEBUG) console.log('DAY', week, d, kind);
    if (FORK) FORK(sim, kind, d, week);
    // typicalpit: the PIT card works the bookings and rests on Yard days (a loss there by design).
    if (st.pit) for (const c of s.crew) if (c.role === 'pit') { sim.setBring(c.id, kind === 'event' && week < C.SEASON_WEEKS); sim.drainEvents(); }
    sim.shopOpen(kind);
    if (st.over && s.cart) s.cart.meat.chicken += st.over;   // overbuys
    let cs = cartSplit(sim);
    let res = sim.shopConfirm(kind);
    if (!res.ok && st.over) { s.cart.meat.chicken = Math.max(0, s.cart.meat.chicken - st.over); cs = cartSplit(sim); res = sim.shopConfirm(kind); }
    sim.drainEvents();
    if (!res.ok) { if (process.env.ECON_DEBUG) console.log("refused", s.season.week, d, kind, res.message, JSON.stringify(sim.shopView(kind))); sim.shopBack(); sim.chooseDay('off'); sim.drainEvents(); continue; }
    r.meatBuy = cs.meat; r.coalBuy = cs.coal;
    const evs = [];
    if (s.today && s.today.comp) { sim.settle(3); for (const e of sim.drainEvents()) evs.push(e); }
    else { TAPS = 0; playCook(sim, evs); r.taps = TAPS; }
    const t = s.till;
    for (const e of evs) {
      if ((e.type === 'walk_out' || e.type === 'left_at_close') && e.refund > 0) { r.refunds += e.refund; r.refundN += 1; }
      if (e.type === 'overtime') r.overtime += 1;
    }
    r.revenue = t.revenue + r.refunds;   // rung up before refunds
    r.tips = t.tips + t.seatTips;
    r.pay = (t.deposit | 0) + (t.payRest | 0) + (t.menuBonus | 0) + (t.comp ? (t.comp.prize | 0) : 0);
    r.wages = t.wages; r.daily = typeof t.daily === 'number' ? t.daily : C.DAILY_COSTS;   // v4.4: a weekday Yard day's half
    r.walkouts = t.walkouts; r.served = t.served; r.customers = t.customers; r.boxed = t.boxed | 0;
    r.spoil = t.spoilCost | 0; r.waste = (t.wasteCost | 0) + (t.grateCost | 0) + (t.rawWaste | 0);
    r.entry = t.entry | 0;
    r.stars = t.stars;
    sim.finishReport(); sim.drainEvents();
    r.cashEnd = s.cash; r.stockEnd = stockValue(s); r.coalEnd = s.charcoal;
    rows.push(r);
    if (s.loop === 'seasonEnd' || s.season.week !== week) { /* fallthrough */ }
  }
  // cash at each week end from the rows
  let cash = C.START_CASH;
  const byWeek = {};
  for (const r of rows) byWeek[r.wk] = r.cashEnd;
  for (let w = 1; w <= C.SEASON_WEEKS; w++) { if (byWeek[w] !== undefined) cash = byWeek[w]; weekEnd.push(cash); }
  const gear = GEAR_ORDER.filter((g) => s.gear[g]);
  return { rows, weekEnd, endCash: s.cash, gear, crew: s.crew.length, loop: s.loop };
}

// ---- report ----------------------------------------------------------------------------------

const med = (a) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
const pad = (v, n) => String(v).padStart(n);

// v4.3 --pitpair: one cook from a saved morning, with or without a PIT card (and where it works).
function pairCook(save, seed, kind, pit) {
  const sim = P.createSim(JSON.parse(JSON.stringify(save)), seed);
  sim.drainEvents();
  const s = sim.state;
  let wage = 0;
  if (pit) {
    const id = s.crewSeq;
    s.crewSeq += 1;
    const card = { id, name: 'Dee', role: 'pit', skills: [3, 3], potential: 3, xp: 0, banked: 0, mood: 0, wage: P.wageFor(3, 'pit'), contract: 1, seasons: 0, rookie: false, trait: null,
      look: Object.assign({}, P.DEFAULT_LOOK), bring: true, raised: false, notice: false, worked: 0, bench: 0, post: pit.post || null };
    s.crew.push(card);
    // over the lineup budget: the FIRE card rests (the PIT card does its job on its cooker)
    if (sim.payroll().now > sim.payroll().budget) { const f = s.crew.find((c) => c.role === 'fire' && c.bring); if (f) f.bring = false; }
    wage = card.wage;
  }
  sim.shopOpen(kind);
  const res = sim.shopConfirm(kind);
  sim.drainEvents();
  if (!res.ok) return null;
  const c0 = s.cash + 0;
  const evs = [];
  playCook(sim, evs);
  const t = s.till;
  const out = { served: t.served, customers: t.customers, burnt: t.burnt, wages: t.wages, stars: t.stars || 0, walkouts: t.walkouts, pitWage: wage, fireRest: pit ? !s.crew.some((c) => c.role === 'fire' && c.bring) : false };
  sim.finishReport(); sim.drainEvents();
  out.cash = s.cash;
  out.cashDay = s.cash - c0;
  return out;
}
function pitPairs() {
  const book = [], yard = [];
  for (const sd of SEEDS) {
    let gotB = null, gotY = null;
    FORK = (sim, kind, d) => {
      const s = sim.state;
      const tier = P.pitTier(s.gear);
      if (!gotB && kind === 'event' && tier >= 2 && !(s.today && s.today.comp) && s.season.week < C.SEASON_WEEKS) gotB = { save: sim.serialize(), kind };
      if (!gotY && kind === 'yard' && d <= 4 && tier >= 1 && s.gear.kettle2) gotY = { save: sim.serialize(), kind };
    };
    playSeason(sd, 'typical');
    FORK = null;
    if (gotB) {
      const a = pairCook(gotB.save, sd, 'event', null), b = pairCook(gotB.save, sd, 'event', { post: null }), c = pairCook(gotB.save, sd, 'event', { post: 'kettle1' });
      if (a && b && c) book.push({ sd, a, b, c });
    }
    if (gotY) {
      const a = pairCook(gotY.save, sd, 'yard', null), b = pairCook(gotY.save, sd, 'yard', { post: 'kettle2' });
      if (a && b) yard.push({ sd, a, b });
    }
  }
  const line = (label, rows, k) => {
    if (!rows.length) { console.log(label + ': no cooks'); return; }
    const d = rows.map((r) => r[k].cash - r.a.cash);
    const sv = rows.map((r) => r[k].served - r.a.served);
    const br = rows.map((r) => r[k].burnt - r.a.burnt);
    const st = rows.map((r) => r[k].stars - r.a.stars);
    console.log(label + ' (' + rows.length + ' seeds): median cash after the day ' + (med(d) >= 0 ? '+' : '') + med(d) + ' (wage ' + rows[0][k].pitWage + ', FIRE rested in ' + rows.filter((r) => r[k].fireRest).length + '), plates ' + (med(sv) >= 0 ? '+' : '') + med(sv)
      + ', burnt ' + (med(br) >= 0 ? '+' : '') + med(br) + ', stars ' + (med(st) >= 0 ? '+' : '') + med(st) + '; ahead in ' + d.filter((x) => x > 0).length + ' of ' + d.length);
  };
  line('stick burner booking, PIT on the second kettle', book, 'b');
  line('stick burner booking, PIT on the stick burner', book, 'c');
  line('weekday Yard day, PIT on the second kettle (a kettle)', yard, 'b');
}

if (flag('--pitpair')) {
  pitPairs();
} else if (flag('--days')) {
  // v4.4: the per day ledger over every seed: the mean of each line a (week, day), the median cash.
  for (const sn of STRATS) {
    const runs = SEEDS.map((sd) => playSeason(sd, sn));
    console.log('\n' + sn + ' (' + runs.length + ' seeds), per day means; cash is the median at day end');
    console.log('wk d kind(most)  n  meat coal gear sales tips  pay wage dly refd spoil waste walk srv/cust stockV  cash');
    const keyOf = (r) => r.wk * 10 + r.day;
    const groups = new Map();
    for (const run of runs) {
      const seen = new Map();
      for (const r of run.rows) {
        if (r.kind === 'rescue') continue;
        const k = keyOf(r);
        const g = seen.get(k) || { kinds: [], meatBuy: 0, coalBuy: 0, gear: 0, sales: 0, tips: 0, pay: 0, wages: 0, daily: 0, refunds: 0, spoil: 0, waste: 0, walkouts: 0, served: 0, customers: 0, stockEnd: 0, cashEnd: 0 };
        g.kinds.push(r.kind);
        g.meatBuy += r.meatBuy; g.coalBuy += r.coalBuy; g.gear += r.gear; g.sales += r.revenue - r.refunds; g.tips += r.tips; g.pay += r.pay;
        g.wages += r.wages; g.daily += (r.kind === 'rest' || r.kind === 'hub') ? 0 : r.daily; g.refunds += r.refunds; g.spoil += r.spoil; g.waste += r.waste;
        g.walkouts += r.walkouts; g.served += r.served; g.customers += r.customers; g.stockEnd = r.stockEnd; g.cashEnd = r.cashEnd;
        seen.set(k, g);
      }
      for (const [k, g] of seen) { const a = groups.get(k) || []; a.push(g); groups.set(k, a); }
    }
    for (const k of [...groups.keys()].sort((a, b) => a - b)) {
      const a = groups.get(k);
      const mean = (f) => Math.round(a.reduce((x, g) => x + g[f], 0) / a.length);
      const kinds = {}; for (const g of a) for (const kd of g.kinds) kinds[kd] = (kinds[kd] || 0) + 1;
      const top = Object.entries(kinds).sort((x, y) => y[1] - x[1])[0][0].replace('yard-', '');
      console.log([pad(Math.floor(k / 10), 2), pad(k % 10, 1), top.padEnd(11), pad(a.length, 2), pad(mean('meatBuy'), 5), pad(mean('coalBuy'), 4), pad(mean('gear'), 4), pad(mean('sales'), 5), pad(mean('tips'), 4), pad(mean('pay'), 4), pad(mean('wages'), 4), pad(mean('daily'), 3),
        pad(mean('refunds'), 4), pad(mean('spoil'), 5), pad(mean('waste'), 5), pad(mean('walkouts'), 4), pad(mean('served') + '/' + mean('customers'), 8), pad(mean('stockEnd'), 6), pad(med(a.map((g) => g.cashEnd)), 5)].join(' '));
    }
  }
} else if (LEDGER) {
  for (const sn of STRATS) {
    const out = playSeason(SEEDS[0], sn);
    console.log('\n' + sn + ' seed ' + SEEDS[0] + ' (gear ' + out.gear.join(',') + ')');
    console.log('wk d kind         start  meat coal gear  rev tips  pay wage dly refd spoil waste  end stockV  srv/cust walk box');
    for (const r of out.rows) {
      console.log([pad(r.wk, 2), pad(r.day, 1), r.kind.padEnd(11), pad(r.cashStart, 6), pad(r.meatBuy, 5), pad(r.coalBuy, 4), pad(r.gear, 4), pad(r.revenue, 4), pad(r.tips, 4), pad(r.pay, 4), pad(r.wages, 4), pad(r.kind === 'rest' || r.kind === 'hub' ? 0 : r.daily, 3), pad(r.refunds, 4), pad(r.spoil, 5), pad(r.waste, 5), pad(r.cashEnd, 4), pad(r.stockEnd, 6), pad(r.served + '/' + r.customers, 9), pad(r.walkouts, 4), pad(r.boxed, 3)].join(' '));
    }
  }
} else {
  const allRuns = {};
  for (const sn of STRATS) {
    const runs = SEEDS.map((sd) => playSeason(sd, sn));
    allRuns[sn] = runs;
    const weeks = [];
    for (let w = 0; w < C.SEASON_WEEKS; w++) weeks.push(med(runs.map((r) => r.weekEnd[w])));
    const sum = {};
    const keys = ['meatBuy', 'coalBuy', 'gear', 'revenue', 'tips', 'pay', 'wages', 'refunds', 'spoil', 'waste'];
    for (const k of keys) sum[k] = 0;
    let daily = 0, cooks = 0;
    const byKind = {};
    for (const r of runs) for (const x of r.rows) {
      for (const k of keys) sum[k] += x[k] || 0;
      if (x.kind !== 'rest' && x.kind !== 'hub' && x.kind !== 'rescue') {
        daily += x.daily; cooks += 1;
        const k = x.kind;
        const b = byKind[k] || (byKind[k] = { n: 0, net: 0, wages: 0, meat: 0, coal: 0, in: 0, taps: 0, served: 0 });
        b.taps += x.taps || 0; b.served += x.served || 0;
        b.n += 1; b.wages += x.wages; b.meat += x.meatBuy; b.coal += x.coalBuy;
        b.in += x.revenue - x.refunds + x.tips + x.pay;
        b.net += x.revenue - x.refunds + x.tips + x.pay - x.wages - x.daily - x.meatBuy - x.coalBuy - (x.entry || 0);
      }
    }
    const n = runs.length;
    console.log('\n== ' + sn + ' (' + n + ' seeds) ==');
    console.log('median cash at week end: ' + weeks.map((c, i) => 'W' + (i + 1) + ' ' + c).join('  ') + '   (start ' + C.START_CASH + ')');
    const gw = GEAR_ORDER.map((g) => { const ws = runs.map((r) => { const x = r.rows.find((y) => (y.bought || []).includes(g)); return x ? x.wk : 99; }); const m = med(ws); return g + ' ' + (m >= 99 ? 'never' : 'W' + m); });
    console.log('median week each gear was bought: ' + gw.join(', '));
    console.log('median gear owned: ' + med(runs.map((r) => r.gear.length)) + '; by season end: ' + ['drum', 'cabinet', 'offset', 'trailer'].filter((g) => GEAR_ORDER.includes(g)).map((g) => g + ' ' + runs.filter((r) => r.gear.includes(g)).length + '/' + n).join(', '));
    console.log('per seed season totals: ' + keys.map((k) => k + ' ' + Math.round(sum[k] / n)).join(', ') + ', daily ' + Math.round(daily / n));
    for (const [k, b] of Object.entries(byKind)) {
      console.log('  ' + k.padEnd(11) + ' cooks ' + pad((b.n / n).toFixed(1), 4) + '/season  avg take ' + pad(Math.round(b.in / b.n), 4) + '  wages ' + pad(Math.round(b.wages / b.n), 3) + '  meat ' + pad(Math.round(b.meat / b.n), 3) + '  coal ' + pad(Math.round(b.coal / b.n), 3) + '  avg cash net ' + pad(Math.round(b.net / b.n), 4) + '  taps/plate ' + (b.served ? (b.taps / b.served).toFixed(2) : '-'));
    }
  }
  // v4.3: two strategies on the same seeds: the median of the per seed cash difference each week.
  if (STRATS.length === 2) {
    const [a, b] = STRATS.map((k) => allRuns[k]);
    const dw = [];
    for (let w = 0; w < C.SEASON_WEEKS; w++) dw.push(med(a.map((r, i) => b[i].weekEnd[w] - r.weekEnd[w])));
    const gearD = med(a.map((r, i) => (b[i].rows.reduce((x, y) => x + (y.gear || 0), 0)) - r.rows.reduce((x, y) => x + (y.gear || 0), 0)));
    console.log('\n' + STRATS[1] + ' minus ' + STRATS[0] + ', median per seed: ' + dw.map((d, i) => 'W' + (i + 1) + ' ' + (d >= 0 ? '+' : '') + d).join('  ') + '; gear bought ' + (gearD >= 0 ? '+' : '') + gearD);
  }
}
