// games/pit-sim/dev/econ.mjs
// Economy rerun for the pit sim v2 (design spec V2.19 item 2). Dev only, never shipped, not a
// harness step. Drives the real PitSim.createSim from ../sim.js with a scripted competent bot
// (the section 20.1 policy: quickest meat first, fire kept above 50, pull on done, carry the
// plate someone waits for, buy about 1.1 times the expected crowd, hold a day's reserve before
// gear, buy in the order second kettle, cooler, buddy at word of mouth 45, bigger table, drum,
// tray, canopy). Tap to walk and tick only, the same calls a player makes.
//
// Run from the repo root:
//   node games/pit-sim/dev/econ.mjs                  seed 1, 10 days, then seeds 1 to 8 summary
//   node games/pit-sim/dev/econ.mjs --days 20 --seed 3
//   node games/pit-sim/dev/econ.mjs --decor          also buys decor once gear is covered
//   node games/pit-sim/dev/econ.mjs --seeds 1-24     summary over a seed range

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
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}
const DAYS = Number(arg('--days', 10));
const SEED = Number(arg('--seed', 1));
const SEEDS = (() => {
  const s = arg('--seeds', '1-8');
  const m = /^(\d+)-(\d+)$/.exec(s);
  if (m) { const out = []; for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i); return out; }
  return s.split(',').map(Number);
})();
const WITH_DECOR = process.argv.includes('--decor');
const DECOR_ORDER = ['chair1', 'lights', 'chair2', 'picnic2', 'flowers', 'birdbath'];
const GEAR_ORDER = ['kettle2', 'cooler', 'buddy', 'bigtable', 'drum', 'tray', 'canopy'];
const COOKERS = ['kettle1', 'kettle2', 'drum'];

// ---- the bot, service side ------------------------------------------------------------------

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
  const st = s.stations.board.stacks.find((x) => x.meat === meat);
  if (st) return st.times.length + plates <= C.BOARD_STACK;
  return s.stations.board.stacks.length < C.BOARD_STACKS;
}
function chooseMeat(s) {
  const waiting = s.customers.filter((c) => c.mode === 'waiting' && c.queueIndex >= 0).sort((a, b) => a.queueIndex - b.queueIndex);
  for (const c of waiting) {
    const m = c.want;
    if (!(s.stock[m] > 0) || MEATS[m].drumOnly) continue;
    const onTable = s.stations.table.spots.some((x) => x && x.meat === m);
    const onBoard = s.stations.board.stacks.some((x) => x.meat === m);
    const onGrate = COOKERS.some((id) => s.stations[id].pieces.some((p) => p.meat === m && p.state !== 'burnt'));
    if (!onTable && !onBoard && !onGrate) return m;
  }
  let best = null;
  for (const m of MEAT_IDS) {
    if (MEATS[m].drumOnly || !(s.stock[m] > 0)) continue;
    if (best === null || s.stock[m] > s.stock[best] || (s.stock[m] === s.stock[best] && MEATS[m].cook < MEATS[best].cook)) best = m;
  }
  return best;
}
function decide(sim) {
  const s = sim.state;
  const c = s.player.carrying;
  const cookers = activeCookers(s);
  const fireOf = (id) => s.stations[id].fire;
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
    return stockLeft && s.clock < C.LAST_CALL;
  };
  if (s.charcoal > 0) for (const id of cookers) if (needsFire(id, 45)) return stationTile('pile');
  const stacks = s.stations.board.stacks;
  if (stacks.length && stacks.some((st) => tableFits(s, st.meat))) return stationTile('board');
  if (s.charcoal > 0) for (const id of cookers) if (needsFire(id, 54)) return stationTile('pile');
  if (pull) return stationTile(pull);
  if (stockLeft) {
    const m = chooseMeat(s);
    if (m) {
      const slotOk = cookers.some((id) => freeSlot(s.stations[id], MEATS[m].slots) && fireOf(id) >= C.FIRE_GOOD - 5);
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

// ---- the bot, morning side ------------------------------------------------------------------

function morning(sim) {
  const s = sim.state;
  const bought = [];
  if (s.broke) return { broke: true, bought };
  if (s.comingNext) sim.dismissComingNext();
  for (const m of MEAT_IDS) if (s.cart.meat[m]) sim.buy(m, -99);
  if (s.cart.charcoal) sim.buy('charcoal', -99);
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
    const cost = sausage * 4 + chicken * 6 + bags * 2;
    const wages = (s.hires.buddy ? C.BUDDY_WAGE : 0) + (s.hires.tender ? C.TENDER_WAGE : 0);
    return { sausage, chicken, bags, reserve: cost + wages + C.DAILY_COSTS };
  };
  for (const g of GEAR_ORDER) {
    const pl = plan();
    if (g === 'buddy') {
      if (s.hires.buddy) continue;
      if (s.day >= 2 && s.rep >= 45 && s.cash - pl.reserve - C.BUDDY_WAGE >= 0) { sim.hire('buddy'); bought.push('buddy'); continue; }
      break;
    }
    if (s.gear[g]) continue;
    const row = CATALOG.find((r) => r.id === g);
    if (row.needs && row.needs.gear && !s.gear[row.needs.gear]) break;
    if (s.cash - row.price >= pl.reserve && sim.buy(g, 1).ok) bought.push(g);
    else break;
  }
  if (WITH_DECOR && s.gear.kettle2) {
    for (const d of DECOR_ORDER) {
      if (s.decor[d]) continue;
      const row = CATALOG.find((r) => r.id === d);
      if (s.cash - row.price >= plan().reserve + 40 && sim.buy(d, 1).ok) bought.push(d);
    }
  }
  const pl = plan();
  if (pl.sausage) sim.buy('sausage', pl.sausage);
  if (pl.chicken) sim.buy('chicken', pl.chicken);
  if (pl.bags) sim.buy('charcoal', pl.bags);
  if (!sim.canOpen().ok) {
    if (s.charcoal === 0) sim.buy('charcoal', 1);
    if (!MEAT_IDS.some((m) => s.stock[m] > 0)) sim.buy('sausage', 1);
  }
  return { broke: false, bought, open: sim.openGate().ok };
}

function run(seed, days) {
  const sim = P.createSim(null, seed);
  sim.drainEvents();
  const rows = [];
  const firsts = {};
  for (let d = 1; d <= days; d++) {
    const start = sim.state.cash;
    const m = morning(sim);
    for (const b of m.bought) if (!(b in firsts)) firsts[b] = sim.state.day;
    if (m.broke) { if (!('broke' in firsts)) firsts.broke = sim.state.day; break; }
    sim.drainEvents();
    let guard = 0;
    while (sim.state.phase === 'service' && guard++ < 100000) { botTick(sim); sim.tick(); sim.drainEvents(); }
    const t = sim.state.till;
    rows.push({ day: t.day, start, cust: t.customers, served: t.served, seated: t.seated, togo: t.togo, walk: t.walkouts,
      past: t.past, close: t.close, burnt: t.burnt, rev: t.revenue, tips: t.tips, seat: t.seatTips,
      wages: t.wages + C.DAILY_COSTS, spoil: t.spoilCost, rain: sim.state.rain ? 'y' : '', rep: t.repEnd,
      cash: sim.state.cash, bought: m.bought.join(', ') });
    if (sim.state.cash >= C.DRIVEWAY_PRICE && sim.state.gear.drum && !('driveway' in firsts)) firsts.driveway = t.day;
    sim.continueFromTill();
    sim.drainEvents();
  }
  return { rows, firsts };
}

function table(rows) {
  const cols = ['day', 'start', 'cust', 'served', 'seated', 'togo', 'walk', 'past', 'close', 'burnt', 'rev', 'tips', 'seat', 'wages', 'spoil', 'rain', 'rep', 'cash', 'bought'];
  const lines = ['| ' + cols.join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|'];
  for (const r of rows) lines.push('| ' + cols.map((c) => String(r[c])).join(' | ') + ' |');
  return lines.join('\n');
}

const one = run(SEED, DAYS);
console.log('Competent bot' + (WITH_DECOR ? ' with decor' : '') + ', seed ' + SEED + ', ' + DAYS + ' days (wages includes the ' + C.DAILY_COSTS + ' daily costs; seat = seat tips)\n');
console.log(table(one.rows));
console.log('\nFirst bought: ' + Object.entries(one.firsts).map(([k, v]) => k + ' day ' + v).join(', '));

const summary = [];
for (const seed of SEEDS) {
  const r = run(seed, Math.max(DAYS, 25));
  summary.push({ seed, kettle2: r.firsts.kettle2, drum: r.firsts.drum, driveway: r.firsts.driveway, broke: r.firsts.broke });
}
console.log('\nSeeds ' + SEEDS[0] + ' to ' + SEEDS[SEEDS.length - 1] + ', up to 25 days: day of the second kettle, the drum, the driveway price, broke');
for (const s of summary) console.log('  seed ' + s.seed + ': kettle2 ' + (s.kettle2 || 'never') + ', drum ' + (s.drum || 'never') + ', driveway ' + (s.driveway || 'not in 25') + ', broke ' + (s.broke || 'never'));
