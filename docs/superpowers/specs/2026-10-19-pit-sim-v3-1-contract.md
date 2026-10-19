# Your Pit v3.1: crew cards, module contract

**Date:** 2026-10-19. **Round:** v3.1 only: the v3.1 row of design section 15 (Crew cards) with design section 6 in full, plus the four carry-forward items from the v3.0 playtests (X17). Nothing from v3.2 onward: no competition, no Offseason screen, no referrals, no moving on, no traits, no Prep Station or Crew Tent, no DRIVE or TILL, no Driveway rung.
**Rules:** `docs/superpowers/specs/2026-10-18-pit-sim-v3-season-design.md`, cited as [S n]. Section [S 19] wins over earlier sections. This file pins names, signatures, numbers, strings and DOM ids so four builders can work at the same time without talking. Where this file and [S] disagree on a name, a signature or a string, this file wins; where they disagree on a rule of play, [S] wins unless this file says the rule is an Overseer's call that overrides it (X18 lists every one), and the builder writes it under Deviations in their file header.
**Builds on:** v3.0 as committed at d479b64, contract `docs/superpowers/specs/2026-10-18-pit-sim-v3-0-contract.md` (W0 to W26, cited as [W n]), then `docs/superpowers/specs/2026-10-18-pit-sim-contract.md` (K, D and sections 0 to 7). Every name there stands unless an X section below names it. Where an X section and a W section disagree, the X section wins.
**Mocks:** `docs/superpowers/mocks/pit-sim-v3/screen-2-crew.png` and its `.html` source (Hiring Day and the crew cards), plus `screen-3-week.png` and `screen-4-report.png` for consistency. The mocks win on look; this file and [S 14] win on words and numbers. Mock content that breaks a rule is replaced: "HIRING WEEK 3" reads Hiring Day, "PIT" and "SERVE" read FIRE and RUN, the DRIVE role is not in v3.1, the "R" rookie badge reads NEW, "PAYROLL 160 / 300 A WEEK" reads "PAYROLL 38 / 60" (per event, the budget of [S 6.5]), the mock's names outside the fixed list (Keisha, Tomas, Omar, Lily) never appear, and the mock's 10 cards a page are 9 ([S 6.6]: 18 applicants on 2 pages of 9).
**Do not edit:** anything in `games/pit-sim/art3/` and `games/pit-sim/dev/look-proof.html` (the v3.4 art track).

---

## X0. Who owns what

| Builder | Owns (may edit) | Writes against | Must not touch |
|---|---|---|---|
| **Art** | `games/pit-sim/sprites.js`, `games/pit-sim/dev/sheet.html` | X12 | everything else |
| **Sim** | `games/pit-sim/sim.js`, `games/pit-sim/dev/econ.mjs` | X1 to X11, X16, X17 | everything else |
| **Game** | `games/pit-sim/game.js`, `games/pit-sim/index.html` (the style block and the `#panels` skeleton of X14; the three script tags, their order, `defer` and the head metas stay as they are) | X1, X4 to X10 (reads), X12 (calls only), X13, X14, X17 | everything else |
| **Harness** | `games/pit-sim/dev/smoke.mjs` | X15, every public name in this file | everything else |
| Overseer | the three spec docs and this file | | the builders' files |

The harness reads only public names: the `PitSim.*` surface, `sim.state`, DOM ids, the `PitSim.game` hooks. Its Node steps may write a headless sim's state as a fixture (as [W0] allows; X15 names every fixture). Its browser steps write state only through the page's own controls, `localStorage` save fixtures written before a reload, and the sim methods listed in X7; they never assign to `sim.state`. `sim.settle()` stays dev and harness only.

Every builder runs `node --check` on each script they edited, scans each edited file for U+2014 and U+2013 (none allowed), keeps zero inline script, `createElement` and `textContent` only (never `innerHTML`), one `localStorage` key `hs.pitsim.save`, no network.

Versions: `C.SAVE_VERSION` 5 (was 4). `PitSim.game.version` `'0.6.0'` (was `'0.5.0'`).

---

## X1. Names

| Name | Meaning |
|---|---|
| `RoleId` | `'run' \| 'fire' \| 'prep'` (`PitSim.ROLE_IDS`, in that order). Badges read RUN, FIRE, PREP. DRIVE and TILL arrive in v3.6 and v3.7. |
| `Card` | one crew member you hold (X4.2) |
| `Applicant` | one card offered on Hiring Day or as a walk-in, not yet hired (X4.3) |
| `OfferId` | `BookingId \| 'invite'`. An offer's `id` equals its `type`, except the top third's repeat invite, whose `id` is `'invite'` (X3.4). DOM ids follow the id (`offer-invite`, `book-invite`). |
| `LoopId` | gains `'hiring'`: Hiring Day, a morning screen before week 1 of every season (X8) |
| `Tier` | `'safe' \| 'stretch'`: the week's role of a booking card (X3). Independent of `Offer.safe`, which still means "the owned gear covers it, Load up and go can run". |
| the lineup | the cards with `bring === true`; at most one per role (X5.4) |
| payroll | the summed `wage` of the lineup, checked against the budget at Load up and go (X5.4) |

New top level names on `PitSim`, all attached by `sim.js`: `ROLE_IDS`, `genPool`, `genWalkins`, `cardStars`, `wageFor`, `skillValue`. Nothing else is added at the top level. `sprites.js` still attaches only `art`; `game.js` only `game`.

`state.buddy` and `state.tender` keep their names and v2 mover shape: `state.buddy` is the RUN card's mover, `state.tender` the FIRE card's. `state.prep` is new, the PREP card's mover. Each gains `cardId: int`.

---

## X2. `PitSim.C` additions and changes

New keys, read by name, never hard coded by `game.js`, the harness or the econ bot:

```js
// crew cards [S 6]
SKILL_CURVE: Object.freeze({                     // the value at 1, 3 and 5 effective stars; piecewise linear between [S 6.3]
  fireSense:  Object.freeze([45, 55, 65]),       // the fire level the FIRE card keeps cookers above
  firePace:   Object.freeze([5.0, 4.0, 2.5]),    // seconds between the FIRE card's adds (its cooldown)
  runSpeed:   Object.freeze([3.5, 4.0, 5.5]),    // the RUN card's walk, tiles a second
  runHandle:  Object.freeze([0.6, 0.4, 0.2]),    // the RUN card's pause at the board and at the table, seconds
  runSeatTip: Object.freeze([0, 0.1, 0.4]),      // extra share of the seat tip on a plate the RUN card carried
  prepKnife:  Object.freeze([1.4, 1.0, 0.6]),    // the PREP card's slice time as a share of MEATS[m].slice
  prepPace:   Object.freeze([3.5, 4.0, 5.5])     // the PREP card's walk, tiles a second
}),
ROLE_SKILLS: Object.freeze({                     // the curve keys each skill drives, skill 0 then skill 1
  run:  Object.freeze([Object.freeze(['runSpeed']), Object.freeze(['runHandle', 'runSeatTip'])]),
  fire: Object.freeze([Object.freeze(['fireSense']), Object.freeze(['firePace'])]),
  prep: Object.freeze([Object.freeze(['prepKnife']), Object.freeze(['prepPace'])])
}),
MOOD_STARS: Object.freeze([-1, -0.5, 0, 0, 0.5]),      // added to both skills during a cook, index mood + 2 [S 6.4]
WAGE_TABLE: Object.freeze([10, 13, 16, 20, 24, 29, 34, 40, 46]),   // overall stars 1, 1.5, 2, ... 5 [S 6.5]
ROLE_WAGE: Object.freeze({ run: 1.0, fire: 1.25, prep: 1.0 }),
PAYROLL: Object.freeze([60, 90, 140, 220]),            // by rung index; v3.1 is always index 0, the backyard
ROSTER_SLOTS: Object.freeze([2, 3, 4, 6]),
CREW_MAX: 8,                                           // cards a save may hold: the slots plus a full draft
BENCH_STREAK: 2,                                       // booked events left home in a row that cost a mood step
HIRE_ROUNDS: 3, POOL_SIZE: 18, POOL_PAGE: 9,
TAKEN_PER_ROUND: 3, TAKEN_SHORTLIST: 6,                // other outfits take 3 of the 6 best open cards after every round
TRYOUTS: 2,
WALKINS: Object.freeze([2, 2, 3]),                     // walk-ins a week by fan rating third
LEVEL_XP: 200, BANK_MAX: 9,
XP_RUN_PLATE: 3, XP_PREP_CUT: 3, XP_FIRE_BAG: 1, XP_FIRE_HOLD: 10,
TRAIN_XP: 40,
SETTLE_XP: 30,                                         // dev: XP each lineup card gets from settle(stars)
RAISE_FRAC: 0.2,
PREP_WAIT: 2,                                          // cooked pieces the board holds for the PREP card
// offers that vary week to week (X3, carry-forward 1 and 2)
SAFE_SIZES: Object.freeze([0.8, 0.9, 1.0]),            // the safe card's headcount factor, one draw
STRETCH_SIZE: 1.4, STRETCH_MIN: 1.15,                  // the stretch card's headcount factor: the largest that fits, from 1.4 down to 1.15
STRETCH_LOAD: 1.0,                                     // the stretch card fits the grate at this load instead of SAFE_LOAD
STRETCH_PAY: 1.15, STRETCH_PATIENCE: -5,
THIRD_PAY: Object.freeze([1.0, 1.1, 1.2]),             // fee factor by fan rating third
// booked arrivals (X5.10, carry-forward 3)
ARRIVAL_PULL_S: 3
```

Changed: `SAVE_VERSION: 5` (was 4).

Kept and now tied: `TENDER_THRESHOLD` 55 and `TENDER_CYCLE` 4 must equal the 3 star column of `fireSense` and `firePace`, `NPC_TILES_PER_S` 4 the 3 star `runSpeed` and `prepPace`, `BUDDY_HANDLE` 0.4 the 3 star `runHandle` (step 5 checks it). `BUDDY_WAGE` 20 and `TENDER_WAGE` 30 stay for the 6.10 migration and equal `wageFor(2.5, 'run')` and `wageFor(3, 'fire')`.

Fixed: `SAVE_VERSION`, `HIRE_ROUNDS`, `POOL_SIZE`, `POOL_PAGE`, `CREW_MAX`, the 3 star column of `SKILL_CURVE`, `ROLE_SKILLS`. Every other new number is a starting value the econ bot or the felt-difference check may move ([S 6.3]: widen the 1 and 5 star columns, keep the 3 star column); a builder who moves one records the old and new value under Deviations, and the harness reads it through `C`.

---

## X3. Offers that differ every week (carry-forward 1 and 2)

[W3] stands except as amended here. The finale (week 9) and the Yard day are untouched by X3.1 to X3.4 except the third pay of X3.3.

### X3.1 Menu pairs on the booking rows

`BOOKINGS` rows gain `menus: MeatId[][]` (frozen, each pair in `MEAT_IDS` order). `menu` stays and equals `menus[0]`.

| id | menus |
|---|---|
| `birthday` | `[['sausage', 'chicken'], ['sausage', 'ribs'], ['chicken', 'ribs']]` |
| `picnic` | `[['chicken', 'butt'], ['sausage', 'butt'], ['ribs', 'butt'], ['chicken', 'ribs']]` |
| `finale` | `null` (the finale menu of [W3.2]) |
| `yard` | `[]` |

A `types` row passed to `genOffers` without `menus` reads `[row.menu]`. No pair holds brisket, so the drum gate of [W3.2] never fires on a weekly card.

### X3.2 `Offer` additions

```ts
Offer = v3.0 Offer & {
  id: OfferId,
  tier: 'safe' | 'stretch',          // 'safe' for the finale and the Yard day
  invite: boolean,                   // true only on the top third's repeat card (X3.4 step 7)
  base: int,                         // the row's headcount at the length before X3.4's sizing (0 for the Yard day)
  menuIdx: int                       // index into the row's menus (0 for the finale and the Yard day)
};
```

### X3.3 Fees

Every booking fee, finale included, is `Math.round(headcount * avg * C.FEE_MULT * k / C.FEE_ROUND) * C.FEE_ROUND` with `k = C.THIRD_PAY[third] * (tier === 'stretch' ? C.STRETCH_PAY : 1)`, where `third` is `genOffers`' step 2 third and `avg` the mean plate price over the offer's menu. Deposit stays `Math.round(fee * C.DEPOSIT_FRAC)`. At the bottom third and the safe tier `k` is 1, so every v3.0 fee formula of [W3.2] still holds there.

### X3.4 `genOffers(input)`: the amended steps

Two more generators, both apart from `r` (so the [W3.4] host draws keep their order): `ry = mulberry32(mix32(seed ^ 0x4D454E55, year, 0))` (one per season) and `rv = mulberry32(mix32(seed ^ 0x56415249, year, week))` (one per week).

1. Week 9: unchanged (the finale alone, one host draw), with the X3.3 third pay.
2. Third, slots and invite: unchanged.
3. Menu rotation: for every row of `types` in input order, `m0 = Math.floor(ry() * menus.length)` (one draw per row, unlocked or not, so the draws never shift); the row's menu this week is `menus[(m0 + week - 1) % menus.length]`. With two or more pairs a type never shows the same menu two weeks running. Build each unlocked row's base offer with that menu at the base headcount (`Math.round(row.guests * L.factor)`), tier `'safe'`, `k` of the third only; `safe` and `needs` by [W3.2] and P-1 at `SAFE_LOAD`.
4. Low cash Birthday, the Fisher Yates shuffle with `r`, the slots and the "no picked offer is safe" swap: unchanged.
5. The stretch: if any picked offer has `needs !== ''`, the first such in picked order is the week's stretch and keeps its base headcount and Needs line. Otherwise one `rv()` draw picks it among the picked offers: `picked[Math.floor(rv() * picked.length)]`. The drawn stretch is sized: the largest `h` from `Math.round(base * C.STRETCH_SIZE)` down to `Math.ceil(base * C.STRETCH_MIN)` whose rail (`railSplit(h, menu, null)`) has `slotSeconds(rail) <= (C.KETTLE_SLOTS * (gear.kettle2 ? 2 : 1) + (gear.drum ? C.DRUM_SLOTS : 0)) * (C.GATE_OPENS + window) * C.STRETCH_LOAD + 1e-9` (the P-1 grate with `STRETCH_LOAD` in place of `SAFE_LOAD`); its `needs` stays `''` (Load up and go runs). When no `h` fits, the drawn card keeps its base size and tier `'safe'`, and the week has no stretch. Both kinds of stretch card (the gear stretch and the drawn one) get tier `'stretch'`, `patience = row.patience + C.STRETCH_PATIENCE`, `difficulty = Math.min(3, row.flames + 1)` and the stretch pay of X3.3.
6. The safe cards: for every other picked offer, in picked order, one `rv()` draw: `f = C.SAFE_SIZES[Math.floor(rv() * C.SAFE_SIZES.length)]`, headcount `Math.max(menu.length, Math.round(base * f))`, fee by X3.3. Smaller never breaks P-1, so a safe card stays safe.
7. The invite: when `invite` and [W3.4] step 6 found no unpicked safe type, add a repeat card: `id 'invite'`, the type of the highest pay loadable picked offer (ties by the row index), menu `menus[(menuIdx + 1) % menus.length]`, the base headcount, tier `'safe'`, `invite: true`, fee by X3.3. When step 6 found a type (the harness stub lists), that card is the invite as in v3.0 with `invite: true` and its `id` equal to its type.
8. Display order: loadable (`safe`) first; then tier `'safe'` before `'stretch'`; then `difficulty` ascending, then `pay` ascending, then the row index; the invite after every other booking card; then the Yard day. Hosts: the [W3.4] step 7 draws from `r`, in this display order. Every number on an offer is final before the hosts are drawn.
9. Build each `Offer` per [W3.3] and X3.2.

In v3.0's types with no extra gear, week 1 shows the Birthday (safe tier, sized by one `SAFE_SIZES` draw) and the Church picnic (the stretch: "Needs a second kettle.", base 20 guests at the stretch pay). From the week a second kettle is owned, both are loadable, one is drawn as the stretch and sized up, the other sized by a `SAFE_SIZES` draw, and the menus have rotated since last week.

`startWeek()`'s Q-7 preselect reads the offer's `type`, so last week's type is preselected when offered and loadable, whatever its size; else the first card, which step 8 makes a safe tier card when one is loadable. `validateSave` accepts `pick 'invite'` in weeks 1 to 8.

---

## X4. State

### X4.1 Additions to `sim.state`

```ts
state.crew: Card[];                      // 0 to C.CREW_MAX, in id order of hiring
state.crewSeq: int;                      // the next card id, 1 to 9999
state.hiring: null | Hiring;             // non null only in loop 'hiring' (X6.1)
state.prep: null | Mover & { cardId, task, t, carrying: null };   // the PREP card's mover during service
state.season: v3.0 Season & {
  drafted: boolean,                      // Hiring Day is done for this season
  trained: int | null,                   // the card id trained this week, null when the pick is open
  walkins: (Applicant & { hired: boolean })[]   // this week's walk-ins, 0 to 3
};
state.stations.board: v3.0 Board & {
  waiting: { meat: MeatId }[],           // cooked pieces left for the PREP card, 0 to C.PREP_WAIT
  slicing: null | { meat, t, total, who: 'player' | 'prep' }
};
state.stations.table.spots[i]: null | { meat, times: float[], run: boolean[] };   // run[j]: plate j was set down by the RUN card
Customer: v3.0 Customer & { runPlate: boolean };     // served a plate the RUN card set down
```

`state.hires` is removed. `hire(id)` stays on the sim object as a stub that always returns `{ ok: false, hired: false, message: '' }` and emits nothing ([S 6.10]: the v2 hire rows are gone; the clipboard's `#hire` container stays empty). `CATALOG` keeps its 21 rows unchanged (the `buddy` and `tender` rows stay as data; nothing renders them). `GOAL_ORDER` drops `'buddy'`: `['kettle2', 'drum', 'bigtable', 'driveway']` ([S 7.1]: v3.1 replaces that step with Hiring Day).

### X4.2 `Card`

```ts
Card = {
  id: int,                    // 1 to 9999, unique
  name: string,               // a STRINGS.names entry, unique on the crew
  role: RoleId,
  skills: [number, number],   // half steps, 1 to 5 each; ROLE_SKILLS order
  potential: number,          // half steps, max(skills) to 5; caps each skill
  xp: int,                    // 0 to C.LEVEL_XP - 1
  banked: int,                // levels earned and not yet spent, 0 to C.BANK_MAX
  mood: int,                  // -2 to 2
  wage: int,                  // per event worked, 1 to 999
  contract: int,              // seasons left, 1 or 2
  seasons: int,               // seasons finished with you, 0 to 99
  rookie: boolean,            // shows NEW; true only through the season it was drafted
  trait: null,                // always null in v3.1 (traits are v3.6)
  look: Look,                 // the six [W4.3] keys; how the card's portrait and in-yard sprite look (X12.3)
  bring: boolean,             // in the lineup
  raised: boolean,            // the raise of this contract is used
  notice: boolean,            // gave notice after the last event (only while mood is -2)
  worked: int,                // events worked, 0 to 9999 (a card at 0 leaves with no send-off)
  bench: int                  // booked events left home in a row, 0 to C.BENCH_STREAK - 1
};
```

Derived, never stored: overall stars `PitSim.cardStars(skills)`, effective skills (X5.2).

### X4.3 `Applicant`

```ts
Applicant = { name, role, skills: [number, number], potential: number, mood: 0 | 1, look: Look, stars: number, wage: int };
PoolEntry = Applicant & { idx: int, status: 'open' | 'mine' | 'taken', tried: boolean };   // idx 0 to 17
Hiring = { year: int, round: int, tryouts: int, pool: PoolEntry[] };   // round 1 to 3 while picks are open, 4 when done
```

`stars = cardStars(skills)`, `wage = wageFor(stars, role)`. A walk-in's signing fee is its `wage` ([S 6.6]: one event's wage).

### X4.4 `Today` and `Till` additions

```ts
Today: v3.0 Today & {
  crew: { [cardId: string]: { role, plates: int, cuts: int, bags: int, savedS: float } },   // one entry per lineup card
  fireGoodS: { kettle1: float, kettle2: float, drum: float },   // seconds after the gate at FIRE_GOOD or above
  fireDipped: { kettle1: boolean, kettle2: boolean, drum: boolean },   // under FIRE_GOOD at any tick from the gate on
  third: 0 | 1 | 2                                               // fan third when the event loaded up
};
Till: v3.0 Till & {
  crew: CrewRow[],            // one row per card on the crew when the event ended, lineup first, then by id
  left: { id, name }[],       // cards that moved on at this event's end (X5.8)
  crewSpent: int,             // signing fees and send-offs paid since the morning opened
  crewPaid: string[],         // the names behind crewSpent
  third: 0 | 1 | 2, thirdTo: 0 | 1 | 2
};
CrewRow = { id, name, role, worked: boolean, xpGain: int, xp: int, banked: int,
            moodFrom: int, moodTo: int, notice: boolean, line: string,
            stat: { plates: int, cuts: int, bags: int, goodPct: int, savedS: int } };
```

`till.net` is unchanged (wages are in it already). The R-4 ledger gains one term: week start + Take today + gear + crew spent + stock = Cash (X13.6).

---

## X5. Crew rules

### X5.1 `PitSim.cardStars`, `PitSim.wageFor`, `PitSim.skillValue` (pure)

- `cardStars(skills)`: `Math.floor(((s0 + s1) / 2) * 2) / 2` ([S 6.2]: the average, rounded down to the half). `cardStars([2.5, 3]) === 2.5`, `([3, 3]) === 3`, `([1, 1.5]) === 1`.
- `wageFor(stars, role)`: `Math.round(C.WAGE_TABLE[Math.round((stars - 1) * 2)] * C.ROLE_WAGE[role])`, stars clamped 1 to 5. `wageFor(3, 'fire') === 30`, `wageFor(2.5, 'run') === 20`, `wageFor(5, 'fire') === 58`, `wageFor(1, 'prep') === 10`.
- `skillValue(key, stars)`: `v = C.SKILL_CURVE[key]`, `s` clamped 1 to 5; `s <= 3 ? v[0] + (v[1] - v[0]) * (s - 1) / 2 : v[1] + (v[2] - v[1]) * (s - 3) / 2`. An unknown key returns `NaN`.

All three never throw; non numeric input reads as 1 star (and `role` other than a `RoleId` reads as `'run'`).

### X5.2 Effective skills

At `loadUp()` (and the tutorial never has crew) each lineup card's effective skills are fixed for the event: `eff[i] = clamp(skills[i] + C.MOOD_STARS[mood + 2], 1, 5)` ([S 6.4], effective skill clamped). The mover stores `eff` and the curve values it uses. `sim.crewView(id)` (X7) reports them.

### X5.3 The three role behaviors

Each runs in tick stage 3 after the player, in this order: `tickBuddy`, `tickTender`, `tickPrep`. None draws from `sim.rng()`.

**RUN (`tickBuddy`, the v2 buddy).** Unchanged route and tasks, with `skillValue('runSpeed', eff[0])` in place of `C.NPC_TILES_PER_S` and `skillValue('runHandle', eff[1])` in place of every `C.BUDDY_HANDLE`. `setDown(hands, byRun)` pushes `true` onto the spot's `run` array for each plate the RUN card places (the player pushes `false`); `serveFromTable` shifts `run` with `times` and sets `c.runPlate`. Each plate placed adds 1 to `today.crew[id].plates`. `payBonus(c)`: when `c.runPlate`, the bonus is `Math.round(seatBonus() * (1 + skillValue('runSeatTip', eff[1])))` of the card that worked; otherwise v2's.

**FIRE (`tickTender`, the v2 fire tender).** Unchanged tasks, with `skillValue('fireSense', eff[0])` in place of `C.TENDER_THRESHOLD` (in `cookerNeedingFire`) and `skillValue('firePace', eff[1])` in place of `C.TENDER_CYCLE`. The FIRE card works from the first kettle: `startService` creates `state.tender` whenever a FIRE card is in the lineup, drum or not ([S 5.3]). Each bag it adds adds 1 to `today.crew[id].bags` (and still to `today.bags`).

**PREP (`tickPrep`, new).** `state.prep` starts at `MAP.prepIdle` (2, 5) facing right and works at `MAP.prepUse` (4, 4) facing right (the board's use tile 3), walking at `skillValue('prepPace', eff[1])` by `playerBfs`. Tasks:
- `idle`: when `board.waiting` is not empty, `board.slicing === null` and `boardFits(waiting[0].meat, MEATS[m].plates)`: path to `prepUse`, task `walk`.
- `walk`: advance; on arrival face right, task `wait`.
- `wait`: when `board.slicing === null` and the first waiting piece fits: take it off `waiting`, `board.slicing = { meat, t: 0, total: MEATS[m].slice * skillValue('prepKnife', eff[0]), who: 'prep' }`, task `slice`. When `waiting` is empty: path home, task `return`.
- `slice`: `board.slicing.t += dt`; at `total`: `addToBoard(m, plates at the clock)`, emit `slice_done { meat, plates, by: 'prep' }`, `today.crew[id].cuts += 1`, `today.crew[id].savedS += MEATS[m].slice`, `board.slicing = null`, task `wait`.
- `return`: advance; at home, task `idle`.

The player's board verbs with a cooked piece in hand, in this order: when `state.prep` exists and `board.waiting.length < C.PREP_WAIT`: `Leave {label} for {name}` (auto on a tap): push `{ meat }` onto `waiting`, hands empty, emit `left_for_prep { meat, name }`. Else when `board.slicing !== null`: no-op `Board is busy`. Else the v3.0 rows (`Slice {label}`, R-2's full board). The player's own slice sets `board.slicing.who = 'player'`. A waiting piece is the PREP card's: the player cannot take it back ([S 16] "what happens when you and PREP reach for the same cut"). `soldOut()` is false while `waiting` holds a piece. At the end of the event each waiting piece and a PREP slice in progress add `MEATS[m].plates` to `today.wastePlates` and `MEATS[m].unit` to `today.wasteCost` (the Thrown out information row). `settle()` clears `waiting` and `state.prep` with the rest.

### X5.4 Wages, payroll budget, roster slots, the lineup

- `sim.payroll()` returns `{ now, budget, slots, count }`: `now` the summed wage of the lineup, `budget = C.PAYROLL[0]`, `slots = C.ROSTER_SLOTS[0]`, `count = crew.length` (v3.1 is always the backyard rung; v3.3 makes the index real).
- At most one card of each role is in the lineup. `setBring(id, true)` on a card whose role is already brought rests the other card of that role (swap) and reports it.
- `canLoadUp()` checks, after the Needs line and before the charcoal line: `payroll().now > payroll().budget` gives `{ ok: false, reason: STRINGS.ui.goPayroll }` filled.
- Wages are paid at the end of every event for every lineup card, booking or Yard day ([S 6.5]: per event worked; resting costs nothing). `today.wages` is that sum; `today.wageNames` the card names.
- A new card joins the lineup when no lineup card has its role and `payroll().now + wage <= budget`; otherwise it starts resting.

### X5.5 XP and levels

At the end of each event, for each lineup card: `xpGain = C.XP_RUN_PLATE * plates + C.XP_PREP_CUT * cuts + C.XP_FIRE_BAG * bags + (role === 'fire' ? C.XP_FIRE_HOLD * held : 0)`, where `held` counts active cookers with `fireDipped[id] === false` (lit at or above `FIRE_GOOD` at the gate and never under it after). `settle(stars)` gives each lineup card `C.SETTLE_XP` instead. `train(id)` gives `C.TRAIN_XP` at once. Whenever `xp >= C.LEVEL_XP`: `xp -= C.LEVEL_XP`, `banked = min(C.BANK_MAX, banked + 1)`, emit `level_ready { id, name, banked }`. Levels are only ever spent by `levelUp(id, skill)` ([S 6.7]: banked, spent from the report or the Crew sheet, several at once).

`levelUp(id, skill)`: when both skills are at potential, `mood = min(2, mood + 1)` and the level is spent (the `skill` argument is ignored); else when `skills[skill] >= potential`, refused with `STRINGS.ui.atPotential`; else `skills[skill] += 0.5`. The wage does not change until the contract renews (X5.9).

### X5.6 Mood after an event

Applied at the end of every event (not the tutorial day, which has no crew), in this order, from the moods as they stood when the event ended:

1. Booking stars: 5 stars, +1 to every lineup card; 4 stars, +1 to the lineup card with the largest `xpGain` (ties to the lowest id); 2 or 1 stars, -1 to every lineup card. Yard days are not starred: no change here.
2. Resting: a card not in the lineup gets +1 when the event was a Yard day; when it was a booking, `bench += 1`, and at `C.BENCH_STREAK` it gets -1 and `bench = 0`. A lineup card's `bench` resets to 0.
3. The drag: for each lineup card that was at -2 when the event ended, one other lineup card (chosen with `crewRng`, below) gets -1. With no other lineup card, nobody.
4. Clamp to -2 and 2.
5. Notice and leaving (X5.8).

`crewRng = mulberry32(mix32(season.seed ^ 0x43524557, year, week))`, created at the end of each event; one draw per drag, in lineup id order: `others[Math.floor(crewRng() * others.length)]`. A raise gives +1 when it is given (X7). Emits `crew_mood { changes: [{ id, from, to }] }` once, only when a mood moved.

### X5.7 Wages on the report and the Broke card

Wages stay in `till.net` as v3.0. The Broke test is unchanged.

### X5.8 Notice and moving on

After step 4 of X5.6: a card at -2 that already had `notice` moves on now (removed from the crew, `till.left`, emit `crew_left { id, name }`); a card at -2 without notice gets `notice = true` (emit `crew_notice { id, name }`); a card above -2 has `notice = false`. So a card that hits -2 works one more event, and leaves after it unless its mood rose ([S 6.4]: one week to fix it, no surprise walk-outs). Moving on at the offseason ([S 6.8]) is v3.2.

### X5.9 The season roll (`startSeason`)

For every card, in this order: `seasons += 1`; `rookie = false`; mood moves one step toward 0; `bench = 0`; `notice = false`; `contract -= 1`, and when it reaches 0 the card signs on again for 1 season at `wageFor(cardStars(skills), role)` with `raised = false` (the re-sign or let go choice of [S 6.7] is v3.2's Offseason screen; until then every contract renews). `season.drafted = false`, then Hiring Day opens (X8). `seasonEndPreview()` gains `crew: { id, name, wageFrom, wageTo, renews: boolean }[]`.

### X5.10 Booked arrivals pull forward (carry-forward 3)

`buildSchedule` keeps its draws and times and also records each guest's party index. In `tickBookedSpawns`, after the gate and while `pending > 0`: when no booked customer has been arriving or waiting in line for `C.ARRIVAL_PULL_S` seconds in a row and food is in progress (any active cooker holds a piece that is not burnt, the board holds a stack, a waiting piece or a slice, or the table holds a plate), the next party in the schedule whose time is later than the clock is moved to the clock, its members `C.PARTY_GAP_S` apart; later parties keep their times. No `rng()` draw. So the line is never empty for more than about 3 seconds while food is cooking and guests are still to come ([S 2.3]: the cook stays the game).

---

## X6. Hiring Day and walk-ins

### X6.1 `PitSim.genPool(input)` (pure)

`input = { seed, year, avoid?: string[] }`. Returns `Applicant[18]` with `idx`. `rp = mulberry32(mix32((seed ^ 0x504F4F4C) >>> 0, year, 0))`.

1. Roles: six `'run'`, six `'fire'`, six `'prep'` in that order, shuffled with Fisher Yates from index 17 down to 1, one `rp()` draw a swap.
2. Then per applicant in order: name (`i = Math.floor(rp() * 60)`, stepping forward one at a time, wrapping, past names in `avoid` and names already in the pool); `s0 = 1 + Math.floor(rp() * 5) / 2`; `s1` the same (1 to 3 in half steps); `potential = Math.min(5, Math.max(Math.max(s0, s1) + 0.5, 2 + Math.floor(rp() * 7) / 2))`; `mood = rp() < 0.5 ? 0 : 1`; the look, six draws in `LOOK_KEYS` order, `Math.floor(rp() * LOOK_COUNTS[k])`; `stars`, `wage` per X4.3.

Pool cards are 1 to 3 stars with potential 2 to 5 ([S 6.6]). All three roles are usable at the backyard, so the weighting is even. `openHiring()` calls it with `avoid` = the names on the crew, and stores the pool in `state.hiring` (saved, X11).

### X6.2 Rounds, picks, tryouts and other outfits

`state.hiring = { year, round: 1, tryouts: C.TRYOUTS, pool }`, every entry `status 'open'`, `tried false`.

- `tryout(idx)`: loop `'hiring'`, `tryouts > 0`, the entry open and not tried: `tried = true`, `tryouts -= 1`, emit `tryout { idx, name, potential }`. The potential shows as hollow stars on that card from then on; an untried pool card never shows its potential.
- `hireApplicant(idx)`: loop `'hiring'`, `round <= 3`, the entry open. Makes the card: next id, the applicant's name, role, skills, potential, mood and look; `xp 0`, `banked 0`, `wage` the applicant's, `contract 2`, `seasons 0`, `rookie true`, `trait null`, `raised false`, `notice false`, `worked 0`, `bench 0`, `bring` by X5.4. No signing fee ([S 6.6]). The entry becomes `'mine'`; emit `crew_hired { id, name, role, from: 'draft', fee: 0 }`; then the round ends.
- `passRound()`: loop `'hiring'`, `round <= 3`: the round ends with no pick.
- The end of a round: other outfits take `C.TAKEN_PER_ROUND` cards. `ro = mulberry32(mix32((seed ^ 0x52495641) >>> 0, year, round))`. The shortlist is the open entries sorted by `stars + potential` descending, then `idx` ascending, cut to `C.TAKEN_SHORTLIST`; three times (or as many as the shortlist holds) `j = Math.floor(ro() * list.length)`, that entry becomes `'taken'` and leaves the list. Then `round += 1`. Emit `round_done { round: the round that ended, taken: idx[], names: string[] }` and `save_wanted { reason: 'hiring' }`.
- Three rounds give at most three picks. A full roster may still draft ([S 6.6]); `finishHiring()` then asks to let someone go.
- `finishHiring()`: loop `'hiring'`, `round === 4`, `crew.length <= payroll().slots`, else `{ ok: false, message }` (`STRINGS.ui.tooMany` filled, or `''` while rounds remain). Sets `state.hiring = null`, `season.drafted = true`, emits `hiring_done { year }`, then runs the week transition (X8).
- `letGo(id)` works on Hiring Day too, and is free for a card with `worked === 0` ([S 6.6]: a season 1 draft never eats the starting 80).

The seed is `state.season.seed`; no new seed field ([S 11]'s `poolSeed` is folded into it, Overseer's call).

### X6.3 `PitSim.genWalkins(input)` (pure) and walk-in hires

`input = { seed, year, week, rep, avoid?: string[] }`. Returns `Applicant[]` of `C.WALKINS[third]` cards (2, 2 or 3). `rw = mulberry32(mix32((seed ^ 0x57414C4B) >>> 0, year, week))`. Per card: `role = ROLE_IDS[Math.floor(rw() * 3)]`; name as X6.1 against `avoid` and the list so far; `s0 = 2 + Math.floor(rw() * 5) / 2`, `s1` the same (2 to 4); `potential = Math.min(5, Math.max(s0, s1) + Math.floor(rw() * 3) / 2)`; mood as X6.1; the look as X6.1; `stars`, `wage`.

`startWeek()` stores `season.walkins = genWalkins({ seed, year, week, rep, avoid: crew names })` with `hired: false` each and `season.trained = null`. Walk-ins are not kept across weeks: a new week makes a new list ([S 6.6]: they leave at the end of the week). When `createSim(saved)` reopens a week, it restores the saved `walkins` (with their `hired` flags) and `trained` silently after `startWeek`, as [W22.3] restores the pick, so a reload never offers a hired walk-in again or reopens the training pick; a saved list that did not validate stays the fresh one.

`hireWalkin(i)`: week only (X7), `walkins[i]` exists and is not hired, `crew.length < payroll().slots` (else `STRINGS.ui.crewFull`), and the fee passes the R-1 gear rule (`fee <= cash` and `cash + picked deposit - cartTotal() >= fee`, else `'Not enough cash'`). Then `cash -= fee`, the fee joins `crewSpent` and its name `crewPaid`, the card is made as in X6.2 with `contract 1`, `rookie false` (walk-ins come trained) and `bring` by X5.4, `walkins[i].hired = true`, emit `crew_hired { id, name, role, from: 'walkin', fee }` and `save_wanted { reason: 'crew' }`.

---

## X7. Sim methods

Own properties of the sim object, fresh objects returned. "Week only" is [W5]'s rule (`loop 'week'`, `phase 'morning'`); "crew loops" means loop `'week'` or `'hiring'`, phase morning. Outside their loops they return `{ ok: false, message: '' }` and change nothing.

| Method | Returns | Semantics |
|---|---|---|
| `crewView(id?)` | `CardView[]`, or one `CardView \| null` with an id | fresh copies of the cards plus `stars`, `eff: [n, n]` (X5.2 at the current mood), `values: { [curveKey]: number }` at `eff`, `levelNeed: C.LEVEL_XP` |
| `payroll()` | `{ now, budget, slots, count }` | X5.4 |
| `hiringView()` | `null \| { year, round, tryouts, picksLeft, pool: PoolEntry[] }` | loop `'hiring'` only; `picksLeft = max(0, 4 - round)`; an untried entry's `potential` reads `null` |
| `tryout(idx)` | `{ ok, message, potential }` | X6.2 |
| `hireApplicant(idx)` | `{ ok, message, id }` | X6.2 |
| `passRound()` | `{ ok, message }` | X6.2 |
| `finishHiring()` | `{ ok, message }` | X6.2, then X8 |
| `hireWalkin(i)` | `{ ok, message, id }` | X6.3, week only |
| `setBring(id, on)` | `{ ok, message, swapped: int \| null }` | crew loops. X5.4 swap; message `STRINGS.ui.oneRole` filled when it swapped. Emits `bring_set { id, bring, swapped }` and `save_wanted { reason: 'crew' }` |
| `train(id)` | `{ ok, message }` | week only, `season.trained === null`: `+C.TRAIN_XP`, levels bank (X5.5), `season.trained = id`, emits `trained { id, name, xp }`, `save_wanted { reason: 'crew' }`. A second train in the week returns `ok: false`, `STRINGS.ui.trainDone` |
| `levelUp(id, skill)` | `{ ok, message, value }` | loops `'week'`, `'hiring'` (morning) and `'report'` (evening), `banked > 0`, X5.5. Emits `level_up { id, name, skill, value, mood }` (`skill` -1 when it lifted the mood) and `save_wanted { reason: 'crew' }` |
| `giveRaise(id)` | `{ ok, message, wage }` | week only, `raised === false`: `wage = Math.round(wage * (1 + C.RAISE_FRAC))`, `mood = min(2, mood + 1)`, `notice = false` when mood is above -2, `raised = true`; emits `raise { id, name, wage }`, `save_wanted { reason: 'crew' }` |
| `letGo(id)` | `{ ok, message, sendoff }` | crew loops. `sendoff = worked > 0 ? wage : 0`; refused with `STRINGS.ui.sendOffCash` when `sendoff > cash`. Removes the card, `cash -= sendoff`, joins `crewSpent` and `crewPaid` when above 0, emits `crew_let_go { id, name, sendoff }`, `save_wanted { reason: 'crew' }` |

Changed:

- `setPlayer(...)` from the creator: when `!season.drafted && season.results.length === 0`, opens Hiring Day (X8) instead of `startWeek()`.
- `startWeek()`: also sets `season.walkins` and `season.trained` (X6.3).
- `canLoadUp()`: the payroll check of X5.4.
- `startService(kind)`: builds `state.buddy`, `state.tender` and `state.prep` from the lineup (none on the tutorial day), each with `cardId` and `eff`; `today.crew` gets one entry per lineup card; `today.third = fanThird()`.
- `endDay()`: XP (X5.5), mood (X5.6), notice and leaving (X5.8), `worked += 1` for every lineup card, the `till` fields of X4.4.
- `startSeason()`: X5.9, then Hiring Day.
- `settle(stars)`: as [W8.4]; lineup cards get `SETTLE_XP`, wages and mood as for a played event, and their `CrewRow.line` is `crewSay.settled`.
- `hire(id)`: the stub of X4.1.
- `reset()`: `crew []`, `crewSeq 1`, `hiring null`, `season.drafted false`, `season.trained null`, `season.walkins []`.
- `goal()`: X4.1's `GOAL_ORDER`.

---

## X8. The loop: every transition (amends [W6])

| From (loop, phase) | Cause | To (loop, phase) | Notes |
|---|---|---|---|
| `creator`, morning | `setPlayer(...)`, Hiring Day owed | `hiring`, morning | owed: `!drafted && results.length === 0`. Events: `player_set`, `hiring_open`, `save_wanted { reason: 'player' }` |
| `creator`, morning | `setPlayer(...)`, not owed | `week`, morning | as v3.0 |
| `tutorial`, evening | `finishReport()`, profile exists, owed | `hiring`, morning | |
| `tutorial`, morning | `skipTutorial()`, profile exists, owed | `hiring`, morning | |
| `hiring`, morning | `tryout`, `hireApplicant`, `passRound`, `setBring`, `letGo`, `levelUp` | `hiring`, morning | |
| `hiring`, morning | `finishHiring()` | `week`, morning | events: `hiring_done`, `week_start { year, week: 1 }`, `offers_ready`, `save_wanted { reason: 'hiring' }`; no rain roll (the morning already rolled) |
| `week`, morning | `setBring`, `train`, `levelUp`, `giveRaise`, `letGo`, `hireWalkin` | `week`, morning | |
| `report`, evening | `levelUp` | `report`, evening | |
| `seasonEnd`, morning | `startSeason()` | `hiring`, morning | X5.9 and the [W11] carry-overs, then `beginMorning`, then `openHiring()`. Events: `season_start`, `hiring_open`, `save_wanted { reason: 'season' }` |

Every other [W6] row stands. `openHiring()` (internal) sets loop `'hiring'`, phase morning, `state.hiring` per X6.2, emits `hiring_open { year, n: 18 }`. The morning roll of `createSim(saved)` runs for `'hiring'` as for `'week'`. `beginMorning` skips the Broke test when the next loop is `'hiring'` (as for `'creator'` and `'week'`). `createSim(saved)` opens the loop from a save: tutorial owed gives `'tutorial'`; profile null gives `'creator'`; a saved `hiring` gives `'hiring'` with that pool; `!drafted && results.length === 0` gives `'hiring'` with a fresh pool; 9 results give `'seasonEnd'`; else `'week'`. A load into `'hiring'` emits nothing.

---

## X9. Events (rows added to [W14])

Payload keys never include `type` ([W23] I-1). Sentences are `game.js`'s, from `STRINGS.say` with `{token}` filled.

| type | payload | when | sentence (`#live`) |
|---|---|---|---|
| `hiring_open` | `year, n` | `openHiring()` | `say.hiringOpen` |
| `tryout` | `idx, name, potential` | `tryout()` | `say.tryout` (`{n}` the potential, `2.5` style) |
| `crew_hired` | `id, name, role, from: 'draft' \| 'walkin', fee` | `hireApplicant`, `hireWalkin` | `say.hired` |
| `round_done` | `round, taken: int[], names: string[]` | the end of a round | `say.roundDone` (`{list}` the names joined `', '` with `' and '` before the last) |
| `hiring_done` | `year` | `finishHiring()` | `say.hiringDone` |
| `bring_set` | `id, bring, swapped` | `setBring()` | none |
| `crew_let_go` | `id, name, sendoff` | `letGo()` | `say.letGo` |
| `trained` | `id, name, xp` | `train()` | `say.trained` |
| `level_ready` | `id, name, banked` | a level banks (end of event or `train`) | `say.levelReady` |
| `level_up` | `id, name, skill, value, mood` | `levelUp()` | `say.levelUp` (`{skill}` the skill name, lower case) or `say.levelMood` when `skill === -1` |
| `raise` | `id, name, wage` | `giveRaise()` | `say.raise` |
| `left_for_prep` | `meat, name` | the Leave verb (X5.3) | `say.leftFor` |
| `slice_done` | adds `by: 'player' \| 'prep'` | v2 | the v2 sentence for the player; none for the PREP card |
| `crew_mood` | `changes: { id, from, to }[]` | end of event, after `spoiled` | none |
| `crew_notice` | `id, name` | end of event | `say.notice` |
| `crew_left` | `id, name` | end of event | `say.left` |
| `save_wanted` | `reason` gains `'hiring' \| 'crew'` | as the methods say | none |

Order at the end of an event: `client_stars`, `spoiled`, `crew_mood`, `level_ready` (lineup id order), `crew_notice`, `crew_left`, `day_over`, `save_wanted { reason: 'till' }`.

---

## X10. `PitSim.STRINGS` additions (exact text)

Owned by `sim.js`. Every value obeys [S 14]. `{token}` filled by plain replacement; `game.js` picks a `One` key when the number is 1. Additions:

```js
role: Object.freeze({ run: 'RUN', fire: 'FIRE', prep: 'PREP' }),
roleName: Object.freeze({ run: 'Server', fire: 'Pit hand', prep: 'Prep cook' }),
roleJob: Object.freeze({
  run: 'Carries plates from the board to the table.',
  fire: 'Keeps every lit cooker fed with charcoal.',
  prep: 'Slices the cuts you leave on the board.'
}),
skill: Object.freeze({
  run: Object.freeze(['Speed', 'Friendliness']),
  fire: Object.freeze(['Fire sense', 'Pace']),
  prep: Object.freeze(['Knife', 'Pace'])
}),
skillHelp: Object.freeze({
  run: Object.freeze(['Walks plates over faster.', 'Hands plates over quicker. Seated guests tip more.']),
  fire: Object.freeze(['Keeps the fire hotter.', 'Checks the fires more often.']),
  prep: Object.freeze(['Slices faster than you do.', 'Walks to the board faster.'])
}),
mood: Object.freeze(['Done', 'Grumpy', 'OK', 'Happy', 'Fired up']),      // index mood + 2
crewSay: Object.freeze({
  run: '{name} ran {n} plates.',
  runOne: '{name} ran 1 plate.',
  fire: '{name} added {n} bags. The fire was hot enough to cook {p} percent of the time.',
  fireOne: '{name} added 1 bag. The fire was hot enough to cook {p} percent of the time.',
  prep: '{name} sliced {n} cuts and saved you {s} seconds.',
  prepOne: '{name} sliced 1 cut and saved you {s} seconds.',
  idle: '{name} had nothing to do this time.',
  settled: '{name} worked the event.',
  rested: '{name} rested.'
}),
hostThird: Object.freeze(['', 'Folks at the last event asked who cooked, {name}.', 'People ask for you by name now, {name}.']),
```

`say` gains:

```js
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
```

`ui` gains:

```js
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
costsDetail: 'meat, charcoal, wages and daily costs',
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
noticeCrew: 'Your save was updated. Your helpers are crew cards now.'
```

Changed text: `ui.crewLine` `'{n} of {s} on the crew'` (was `'{n} of 2 hired'`); `ui.crewSub` `'Payroll {p} / {b}'` (was `'Buddy and fire tender'`). `{list}` in `ui.rested` and `say.roundDone` is a generated list ([W22.26] (a)). Stars in text are numbers like `2.5` with `ui.starsMany` / `ui.starsOne`.

---

## X11. Save version 5

### X11.1 Shape

`v: 5`, exactly these keys and no others (the v4 keys of [W13.1] minus `hires`, plus `crew`, `crewSeq`, `hiring`, and three `season` keys):

```json
{ "v": 5, "day": 9, "cash": 340, "rep": 38,
  "stock": { "sausage": 0, "chicken": 2, "ribs": 0, "butt": 1, "brisket": 0 },
  "charcoal": 34, "wood": 0,
  "gear": { "kettle2": true, "cooler": true, "bigtable": false, "tray": false, "canopy": false, "drum": false },
  "decor": { "chair1": false, "chair2": false, "flowers": false, "birdbath": false, "lights": false, "picnic2": false },
  "stats": { "days": 8, "served": 120, "walkouts": 4, "past": 2, "burnt": 1, "seated": 60 },
  "drivewayShown": false,
  "tutorial": { "done": true },
  "season": { "year": 1, "week": 8, "seed": 123456789, "pick": "picnic", "addon": null, "weekCash": 340,
              "results": [ { "type": "birthday", "stars": 3 }, { "type": "picnic", "stars": 4 }, { "type": "yard", "stars": 0 },
                           { "type": "picnic", "stars": 3 }, { "type": "picnic", "stars": 5 }, { "type": "birthday", "stars": 2 },
                           { "type": "picnic", "stars": 4 } ],
              "drafted": true, "trained": 2,
              "walkins": [ { "name": "Opal", "role": "prep", "skills": [3, 2.5], "potential": 3.5, "mood": 1,
                             "look": { "skin": 4, "hair": 2, "hairColor": 0, "face": 0, "hat": 0, "apron": 2 }, "hired": false },
                           { "name": "Earl", "role": "fire", "skills": [2, 3.5], "potential": 4, "mood": 0,
                             "look": { "skin": 2, "hair": 5, "hairColor": 5, "face": 2, "hat": 1, "apron": 0 }, "hired": false } ] },
  "crew": [ { "id": 1, "name": "Rosa", "role": "run", "skills": [2.5, 3], "potential": 4, "xp": 120, "banked": 0, "mood": 1,
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
  "settings": { "length": "normal" } }
```

While Hiring Day is open, `hiring` is `{ "year": 1, "round": 2, "tryouts": 1, "pool": [ 18 entries of { name, role, skills, potential, mood, look, status, tried } ] }`. `stars`, `wage` and `idx` are derived on load, never saved. `serialize()` in loop `'hiring'` writes `week 1` and `pick null`.

### X11.2 `validateSave(obj)`

Accepts `v` 1 to 5 and always returns `v: 5`; anything else (including `v: 6`, `'5'`, missing) gives `null`; never throws, cyclic input included. Every [W13.3] rule (as amended by W22 to W26) for the keys it covers, plus:

- `crew`: the first `C.CREW_MAX` plain objects with `role` in `ROLE_IDS`, each card clamped field by field: `id` integer 1 to 9999 (a duplicate or bad id drops the card); `name` kept when it is a `STRINGS.names` entry not already used on the crew, else the first unused name from `names[id % 60]` stepping forward; `skills` two numbers, each rounded to the half and clamped 1 to 5 (default 1); `potential` rounded to the half, clamped `max(skills)` to 5 (default `max(skills)`); `xp` integer 0 to 199; `banked` 0 to 9; `mood` integer -2 to 2 (default 0); `wage` integer 1 to 999 (default `wageFor(stars, role)`); `contract` 1 or 2 (default 1); `seasons` 0 to 99; `rookie`, `bring`, `raised` booleans (default false); `trait` always `null`; `look` by `cleanLook`; `notice` true only when the value is true and mood is -2; `worked` 0 to 9999; `bench` 0 to `C.BENCH_STREAK - 1`. Then at most one `bring` per role (later ones in array order set false).
- `crewSeq`: integer, at least the largest id plus 1, at most 9999 (default the largest id plus 1, or 1).
- `season.drafted`: boolean; default `results.length > 0 || crew.length > 0`. `season.trained`: a crew id or `null`. `season.walkins`: up to 3 applicant objects validated like a card's name, role, skills, potential, look, plus `mood` 0 or 1 and `hired` boolean; an invalid entry drops the list to `[]`, which `startWeek` regenerates.
- `hiring`: kept only when `results.length === 0`, `drafted === false`, a profile exists, the tutorial is done, `round` is an integer 1 to 4, `tryouts` 0 to `C.TRYOUTS`, and `pool` holds exactly 18 entries that validate like walk-ins plus `status` in `'open' | 'mine' | 'taken'` and `tried` boolean; else `null` (and `createSim` opens a fresh Hiring Day when it is owed).
- `season.pick`: `'invite'` is a valid id in weeks 1 to 8.

### X11.3 From v1 to v4 ([S 6.10])

First every v4 rule as before, including the legacy tender check (a `hires.tender` without `gear.drum` is forced false, as [W13.3] and step 6 test). Then `crew` is built from the hires, buddy first:

- `hires.buddy`: a RUN card, `skills [2.5, 2.5]`, `potential 4`, `wage 20`, `contract 1`.
- `hires.tender`: a FIRE card, `skills [3, 3]`, `potential 4`, `wage 30`, `contract 1`.
- Both: ids 1 and up in that order; `mood 0`, `xp 0`, `banked 0`, `seasons 0`, `rookie false` (neither carries NEW), `trait null`, `bring true` (20 plus 30 is 50, inside 60), `raised false`, `notice false`, `worked 1` (they have worked for you, so letting one go costs a send-off), `bench 0`. Name: `names[mix32(season.seed, 0x4E414D45, n) % 60]` for card `n` (0 based), stepping forward past a name already given. Look: six draws from `mulberry32(mix32(season.seed, 0x4C4F4F4B, n))` in `LOOK_KEYS` order.
- `crewSeq` the next id; `hiring null`; `season.drafted = results.length > 0 || crew.length > 0` ([S 11]: a player who already has hires skips Hiring Day in season 1); `season.trained null`; `season.walkins []`.

`game.js` keeps its raw `parsed.v` read: a valid save with raw `v` 1 to 4 shows `ui.noticeCrew` when the migrated crew is not empty, else `ui.notice`, on the status line for `C.FX.NOTICE_S` and once in `#live`, then writes the save once. A v5 save loads silently.

---

## X12. `PitSim.art` (amends [W16])

### X12.1 Sprite changes

Replaced in place: `star` 9x9 grows to 4 frames (0 full yellow with an outline brown edge and 1 empty in `smokeD`, as now; 2 half: columns 0 to 4 of frame 0 and 5 to 8 of frame 1; 3 hollow: the outline in yellow `k` with a transparent body, for potential). New: `mood` 10x10, 5 frames, a round face with an outline brown `5` edge and near black `1` eyes two pixels tall, frame `2 - mood` (0 Fired up: yellow `k`, open grin with white `h` teeth; 1 Happy: yellow, smile; 2 OK: yellow, flat mouth; 3 Grumpy: orange `4`, frown; 4 Done: red `o`, frown and slanted brows, as the mock's grumpy face); `prep_down`, `prep_up`, `prep_side` 16x24, 3 frames each, and `prep_slice` 16x24, 2 frames (knife up, knife down, the `player_slice` pose), the PREP outfit of X12.3 on `PREP_DEFAULT_LOOK` until `setCrewLook('prep', ...)`.

**REQUIRED SPRITES v3.1**, 128 names, 352 frames; the harness copies this literal verbatim and it replaces the [W16.2] literal:

```js
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
```

No palette entry is added (36 stays, [W21] item 13 holds).

### X12.2 New `art` members

```ts
setCrewLook(role: RoleId, look: Look): string   // rebuilds that role's in-yard sprites in place (grids, canvases, flips):
                                                // run: buddy_down/up/side; fire: tender_down/up/side;
                                                // prep: prep_down/up/side and prep_slice. Same sizes and frame counts.
                                                // Returns crewKey(role). An invalid look index takes the DEFAULT_LOOK value.
crewKey(role: RoleId): string                   // role + ':' + 'skin-hair-hairColor-face-hat-apron' of the last setCrewLook,
                                                // '' for run and fire before any call, 'prep:' + PREP_DEFAULT_LOOK's key after build()
bustRows(look: Look, role: RoleId): string[]    // the 26 by 22 portrait bust in legend characters ('0' transparent), X12.3
portrait(look: Look, role: RoleId, opts: { scale: int, dpr: number }): HTMLCanvasElement
                                                // the bust drawn at scale CSS px per art pixel into a canvas of
                                                // max(1, round(scale * dpr)) device pixels per art pixel, smoothing off,
                                                // style width 26 * scale and height 22 * scale CSS px, aria-hidden="true"
CREW_OUTFIT: { run, fire, prep }                // frozen symbol maps per role (X12.3), palette characters only
```

`PREP_DEFAULT_LOOK` (inside sprites.js) is `{ skin: 2, hair: 4, hairColor: 0, face: 0, hat: 0, apron: 2 }`. `build()` keeps v2's buddy and tender grids exactly (so every v3.0 grid check holds until a `setCrewLook` call), builds `prep_*` from `PREP_DEFAULT_LOOK`, and still ends with `setLook(DEFAULT_LOOK)`. `sprites.js` still touches the DOM only through `document.createElement('canvas')`, now also in `setCrewLook()` and `portrait()`.

### X12.3 Crew looks: in the yard and on the card

One body system ([S 12.3], [S 19.2]): the in-yard crew sprite is the [W16.4] look compositor (`lookRows` with the card's hair, hat and face templates, the skin and hair color swaps) with the role outfit in place of the player's shirt and apron:

| Role | Shirt (T base, V light, U shade) | Apron (A, B) | Bust outfit (the mock's styles) |
|---|---|---|---|
| `run` | `f`, `h`, `g` (v2 buddy blue) | none: A and B take the shirt's `f` and `g` | polo with a white collar and a white name tag |
| `fire` | `o`, `p`, `r` (v2 tender red); cream `3`, `h`, `a` when the look's apron is 0 (Red) | `LOOK.apron[look.apron]` | the work apron with a neck strap and a chest pocket over the shirt |
| `prep` | `h`, `h`, `u` (white) | `LOOK.apron[look.apron]` | a white chef coat with a neckerchief in the apron color |

The bust is 26 wide by 22 tall, chest up, the mock's framing ([S 12.3] said 32 by 32; the mock wins on look): head rows 2 to 14 with ears, eyes, brows and mouth; shoulders from row 14 down to row 21; an outline pass in outline brown `5`. Parts are authored once at bust size, one per option: six hair styles (short, curly, long, buzz, bun, bald), three hats (cap, cowboy hat, bandana), three face options (mustache, beard, glasses), the three role outfits, and the [W16.4] skin and hair color swap tables, so a card's portrait and its in-yard sprite always agree. Every pixel is a legend character. Mood is never painted into the bust (the face badge shows it).

The Art builder's `dev/sheet.html` shows the 18 applicants of `genPool({ seed: 7, year: 1 })` as busts at 3x with their in-yard down frames beside them, and the five mood frames.

---

## X13. `game.js`

### X13.1 Panels

| Loop (phase) | Panel |
|---|---|
| `hiring` (morning) | `#hiring`, or `#card` over it, or `#sheet` (crew) over it |
| `week` | as [W17.1]; `#card` may open over `#sheet` (crew) |
| `report` | `#till`; `#card` (level mode) may open over it |

`PANEL_IDS` gains `hiring` and `card`. `#card` returns to the panel that opened it, with focus on the control that opened it, on `card-back` or Escape. On `#sheet` opened from `#hiring`, `sheet-back` returns to `#hiring`. Every new control is a real `button` 44 by 44 CSS px or larger, reachable by Tab, with the 2 px gold focus ring.

### X13.2 Hiring Day (`#hiring`), to `screen-2-crew.png`

The hub's blue striped screen (`.hub`), 2 columns of cards at every phone width (the mock; [S 12.3]'s 3 columns are replaced, Overseer's call), 1 column under 300 px panel width.

| id | element | content |
|---|---|---|
| `hiring-h` | `h2`, `tabindex="-1"` | `ui.hiringH` in the UI font at 3x with three small stars each side (red, white, navy, as the mock), text also in a `.sr` span |
| `hire-cash` | `div.pill` | coin and the cash number (the mock's top left chip) |
| `hire-info` | `button.alt` | the mock's "i" box, `aria-label` `ui.hireInfo`, `aria-expanded`; toggles `hire-help` |
| `hire-help` | `p` | `ui.hireHelp`, hidden until `hire-info` opens it |
| `hire-round` | `p` | `ui.hireRound`, or `ui.hireRoundsDone` once round is 4 |
| `hire-tryouts` | `p.muted` | `ui.tryoutsLeft` |
| `hire-page` | `p` | `hire-page-prev` (`button`, left arrow, `aria-label` `ui.pagePrev`), `ui.pageOf` in the UI font, `hire-page-next` (`button`, right arrow, `ui.pageNext`); the arrow with nowhere to go is disabled and dimmed as the mock's left arrow |
| `hire-grid` | `ol` | 9 `li`, each holding `app-{idx}` (idx 0 to 8 on page 1, 9 to 17 on page 2) |
| `app-{idx}` | `button.crewcard` | the card of X13.4 for an applicant; `aria-label` `ui.appAria` (or `ui.appTaken`); opens `#card` in applicant mode. A taken card is greyed, carries `ui.taken` across the band and is `aria-disabled="true"` (it still opens read only). A card you hired carries `ui.yours` |
| `hire-payroll` | `div`, `role="meter"` | the mock's payroll box: `ui.payroll` set into the top border in the UI font, a near black bar with the yellow fill (`#E9E23A`, a `#F7F27A` top line), orange past 80 percent, red past 95, ticks every 10; `aria-valuenow` payroll now, `aria-valuemin` 0, `aria-valuemax` budget, `aria-label` `ui.payrollAria` |
| `hire-crew` | `button` | the mock's Crew button with a two person pictogram drawn by `game.js`; opens `#sheet` kind `crew` |
| `hires-left` | `div` | `ui.hiresLeft` over `hires-left-n` (a framed box with `picksLeft`) |
| `hire-go` | `button.primary` | the mock's arrow button. While `round <= 3`: `aria-label` `ui.passRound`, calls `sim.passRound()`. Once round is 4: the arrow and the visible words `ui.startWeek`, calls `sim.finishHiring()` |
| `hire-why` | `p.muted` | `finishHiring()`'s refusal (`ui.tooMany`), empty otherwise |

The page shown is page 1 when the screen opens; `PitSim.game.hiringPage` reports it. The hub fits in one phone screen plus the bottom bar at 375 by 812 (the mock does at 390 by 844).

### X13.3 The card sheet (`#card`)

Modes: `applicant` (a pool entry), `walkin` (a walk-in), `crew` (a card you hold), `level` (spending a banked level).

| id | content |
|---|---|
| `card-h` | `h2`, `tabindex="-1"`: the name in the UI font at 3x, `.sr` text |
| `card-back` | `button`, a 44 px chevron, `aria-label` `ui.cardBack` |
| `card-portrait` | `art.portrait(look, role, { scale: 4, dpr })` on the role band color |
| `card-role` | the role badge (X13.4) and `roleName[role]`, then `roleJob[role]` muted |
| `card-mood` | the `mood` frame at 2x and `STRINGS.mood[mood + 2]`; `aria-label` `ui.moodAria` |
| `card-stars` | overall stars (`star` frames 0, 2 and 1) at 2x; potential as frame 3 after them when known; `ui.potential` or `ui.potentialHidden` |
| `card-skill-0`, `card-skill-1` | the skill name (`skill[role][i]`), five `star` frames for the skill (half steps), `skillHelp[role][i]` muted; `role="meter"` with `aria-valuenow` the skill, max 5, `aria-label` `ui.skillAria` |
| `card-wage` | coin and `ui.perEvent`; for a walk-in also `ui.hireFee` in the button |
| `card-contract` | a chip: `ui.contract2` or `ui.contract1` |
| `card-xp` | crew and level modes: a 10 segment meter, `role="meter"`, `aria-valuenow` xp, max `C.LEVEL_XP`, label `ui.xp`; `card-banked` (`p`) `ui.banked` when `banked > 0` |
| `card-notice` | crew mode, red: `ui.noticeLine` while `notice` |
| applicant mode | `card-tryout` (`button.alt`, `ui.tryout`; disabled with `ui.tryoutNone` when none are left, gone once tried), `card-hire` (`button.primary`, `ui.hire`, disabled on a taken or yours card or after round 3), `card-pass` (`button.alt`, `ui.pass`, closes the sheet) |
| walk-in mode | `card-hire` (`ui.hireFee`), `card-pass`; `card-why` (`p.muted`) the refusal |
| crew mode | `card-bring` (`button.alt`, `aria-pressed`, `ui.bring` or `ui.rest`); `card-train` (`ui.train`, disabled with `ui.trainDone` once anyone trained this week; week only); `card-level` (`ui.levelUp`, when `banked > 0`, opens level mode); `card-raise` (`ui.raise` with the raised wage, or disabled `ui.raiseDone`; week only); `card-letgo` (`ui.letGo`), which shows `card-letgo-sure` (`p`, `ui.letGoSure` or `ui.letGoFree`) with `card-letgo-yes` and `card-letgo-no` |
| level mode | `ui.levelH` as a heading; `card-pick-0` and `card-pick-1` (`button.primary`, `ui.levelPick` with the skill name), a pick at potential disabled with `ui.atPotential` as its title line; `ui.levelBoth` when both are; `card-banked` |

### X13.4 The crew card element (`.crewcard`)

Used for `app-{idx}`, `walkin-{i}` and `crew-{id}`, to the mock: a 1 px ink `#0B1640` edge over a `#E6EAF2` body with a `#9AA6C4` bottom edge and a `#1E4CC4` 3 px drop shadow; the portrait window in the role band (`fire` `#F0603C` with a `#F7835F` top line, `prep` `#5CC653` / `#7DD875`, `run` `#4EC2F5` / `#79D3FA`, the mock's colors, which win over [S 12.3]'s), the bust at 3x standing on the window's floor line; the role badge top left (`STRINGS.role`, white UI font on an ink box); the NEW badge under it while `rookie` (an ink box in a gold `#FFD23F` frame with `ui.newBadge` in gold); the `mood` frame top right at 2x (applicants show their mood too); the info panel `#585C6C` with a `#6E7284` top line: the name centered in white UI font at 2x, the overall stars at the left (`star` frames, half star frame 2), and `ui.wage` in pale `#CFDEFF`, the coin and the wage in `#FFF1B0` at the right. Every text on it is also in `.sr` spans or the button's `aria-label`. Contrast: white on the ink badge, white and pale on the panel are all above 4.5 to 1.

### X13.5 The crew sheet (`#sheet` kind `crew`, replaces [W17.3]'s crew rows)

| id | content |
|---|---|
| `crew-payroll` | the payroll meter of `hire-payroll`, same rules |
| `crew-slots` | `p`: `ui.slots`, or `ui.crewEmpty` with no crew |
| `crew-list` | `ul`; per card in id order: `crew-{id}` (`button.crewcard`, opens `#card` crew mode), then a row of `bring-{id}` (`button.alt`, `aria-pressed`, `ui.bring` or `ui.rest`, `aria-label` `ui.bringAria`) and `train-{id}` (`button.alt`, `ui.train`, disabled once anyone trained this week; week only); `crew-notice-{id}` (`p`, red, `ui.noticeLine`) while noticed |
| `crew-train-line` | `p.muted`: `ui.trainLine`, or `ui.trainedLine` after the pick |
| `crew-why` | `p.muted`: the last refusal (`ui.oneRole` after a swap, `ui.crewFull`, `ui.sendOffCash`) |
| `walkins-h` | `h3` `ui.walkinsH` and `walkins-line` (`p.muted`, `ui.walkinLine`); week only |
| `walkin-{i}` | `button.crewcard` per walk-in not hired, opening `#card` walk-in mode |

On Hiring Day the sheet shows the payroll, the slots and the list with `bring-{id}`; no train buttons and no walk-ins.

### X13.6 The week hub and the report

Week hub ([W17.2] as amended by W24 to W26):

- `card-crew`: `ui.crewLine` with `{n}` crew and `{s}` slots, `ui.crewSub` with the payroll; its window draws the lineup's in-yard down frames (after `art.setCrewLook` for each lineup card) at 2x, at most three; a red dot while any card has notice.
- `go-why` carries `ui.goPayroll`.
- Pit news gains `news-notice-{id}` (`p`, red, `ui.noticeLine`) per noticed card; Pit news shows when it holds one.
- `third-line` (`p.muted`, one line, under the pills): `ui.thirdNow[third]` (carry-forward 2).
- Each offer card's corner tag (the SAT and SUN tags of W26 Q-5 are gone) is `offer-{id}-tag`: `ui.tagInvite` on the invite, else `ui.tagStretch` or `ui.tagSafe` by tier.
- The fresh week 1 hub still fits `2 * innerHeight` at 375 by 812 ([W19] step 45), with the [W22.25] shrink order.

The report (`#till`, [W17.4] as amended):

- `rep-crew` box, titled `ui.crewH`, after the money and word of mouth boxes, only when the crew is not empty. Per lineup card `rep-crew-{id}`: `art.portrait` at 2x, the name, the `mood` frame for `moodTo` with `ui.moodWas` when it moved (and `aria-label` `ui.moodAria`), `rep-crew-{id}-xp` (a meter, `role="meter"`, `aria-valuenow` xp, max `C.LEVEL_XP`, label `ui.xp`), `rep-crew-{id}-line` (`p`, the till row's `line`), and `rep-crew-{id}-level` (`button.alt`, `ui.levelUp`) while `banked > 0`, opening `#card` level mode. Resting cards share one `rep-rested` line (`ui.rested`). `rep-notice-{id}` (red `ui.noticeLine`) and `rep-left` (`ui.leftLine` per card, joined) when they apply.
- `rep-host-third` (`p`, under the host quote): `hostThird[till.third]` with the player's name, hidden at third 0; `rep-third` (`p`) when `thirdTo !== third`: `ui.thirdUp[thirdTo]` going up, `ui.thirdDown` with the edge (34 or 67) going down (carry-forward 2).
- The compact money table (carry-forward 4). A booking's `rep-money` shows, in order: `ui.rowFee` (detail: the deposit), `ui.rowExtras` (tips, seat tips and the menu bonus), `ui.rowCosts` (food cost with raw waste, charcoal used, spoiled tonight, wages and daily costs; detail `ui.costsDetail`), `ui.rowTake` (bold, `till.net`), `ui.rowGear` when gear was bought, `ui.rowCrewPaid` when `crewSpent > 0` (detail: `crewPaid`), the W26 stock row when it is not 0, and `ui.rowCash`. A Yard day's shows the v2.1 Served row, `ui.rowExtras` (tips and seat tips), `ui.rowTake`, `ui.rowGear` and `ui.rowCrewPaid` when they apply, the R-4 `ui.rowShop` row and `ui.rowCash`. `rep-money-more` (`button.alt`, `aria-expanded`, `ui.moneyMore` / `ui.moneyLess`) opens `rep-money-detail`, which holds every v3.0 row with its v3.0 id and label. Week start + Take today + Gear bought + Signing and send-off + the stock row (or Paid at the shop) = Cash, read down the visible rows. The tutorial till is unchanged.
- The booking report with two crew rows and the detail closed fits `2 * innerHeight` at 375 by 812. If it does not, shrink in this order: (1) the hero band to 96 px; (2) the cooler and charcoal lines share one line; (3) the crew rows' portraits to 1x beside the name; (4) the word of mouth box beside the money box at 340 px and wider. Never drop a row of the compact table or go under 44 px controls.

The season end card gains `se-crew-{id}` (`p`, `ui.seCrew`) per card whose contract renews in `seasonEndPreview().crew`.

### X13.7 In the yard

At `yard_open`, `game.js` calls `art.setCrewLook(role, card.look)` for each lineup card and draws `state.prep` like the buddy and tender (layer 3, `prep_{facing}`, `prep_slice` while `board.slicing.who === 'prep'`). Up to two waiting pieces draw on the board as `hand_cooked_{meat}` at the board's left and right thirds. The hero band of the report keeps `buddy_down` (now the RUN card's look when one worked). `OVERFLOW_OK` gains `prep_`.

### X13.8 `PitSim.game` v3.1 (every [W17.7] member kept)

```ts
version: '0.6.0',
crew: { run: null | { id, key }, fire: null | { id, key }, prep: null | { id, key } },   // the movers drawn this frame and art.crewKey(role)
hiringPage: 1 | 2 | null                                                                // the Hiring Day page on screen
```

Both are getters. `captureFrame()` records `prep_*` sprites like any other.

---

## X14. `index.html`

Inside `#panels`, after `#season-end`, two sections built the v2 way:

```html
<section id="hiring" class="hub" role="dialog" aria-modal="true" aria-labelledby="hiring-h" hidden>
  <h2 id="hiring-h" tabindex="-1"></h2><div id="hiring-top"></div><div id="hiring-body"></div><div id="hiring-foot"></div>
</section>
<section id="card" class="hub" role="dialog" aria-modal="true" aria-labelledby="card-h" hidden>
  <h2 id="card-h" tabindex="-1"></h2><div id="card-body"></div>
</section>
```

and in the `<style>` block, before the reduced motion block: `--run #4EC2F5`, `--run-hi #79D3FA`, `--fire #F0603C`, `--fire-hi #F7835F`, `--prep #5CC653`, `--prep-hi #7DD875`, `--ink2 #0B1640`, `--card #E6EAF2`, `--card-edge #9AA6C4`, `--panel #585C6C`, `--panel-top #6E7284`, `--pale #CFDEFF`, `--wage #FFF1B0`, `--bar #E9E23A`, `--bar-hi #F7F27A`, `--gold2 #FFD23F`; the `.crewcard` rules of X13.4, the hiring grid (2 columns, 8 px gaps), the payroll meter, the bottom bar (Crew, Hires left, the arrow) and the card sheet rows. `SHELL_IDS` gains the eight new ids. No inline script, no handler attributes, no external resource, no dash characters; the script tags and head metas are unchanged.

---

## X15. Harness v3.1 (`games/pit-sim/dev/smoke.mjs`)

Run as before. Constants: `GAME_VERSION '0.6.0'`; `C_EXPECT.SAVE_VERSION 5`; the X12.1 literal; `Object.keys(SPRITES).length === 128`; `PALETTE.length === 36`; `COLOR` 35 keys; `SIM_SURFACE` gains the six X1 names; `SURFACE_COUNTS` unchanged (props 19, catalog 21). New screenshots: `hiring.png`, `card.png`, `crew.png`, `report-crew.png`. Every expectation built from a tunable value reads it from `C` and prints the literal when `C` holds its starting value ([W22.18]).

### X15.1 Changed steps

| # | change |
|---|---|
| 5 | the X2 keys and values (and the ties of X2: the 3 star column against `TENDER_THRESHOLD`, `TENDER_CYCLE`, `NPC_TILES_PER_S`, `BUDDY_HANDLE`); the six names; `ROLE_IDS` deep equals `['run', 'fire', 'prep']`; `BOOKINGS` rows with the X3.1 `menus`; every X10 key with its exact text and the two changed `ui` keys; the X7 methods; `MAP.prepIdle` deep equals `{ x: 2, y: 5, face: 'right' }` and `MAP.prepUse` `{ x: 4, y: 4, face: 'right' }`; `GOAL_ORDER` reaches no `buddy`; `state.hires` is undefined; `hire('buddy')` returns `{ ok: false, hired: false, message: '' }` |
| 6 | results at `v: 5`; `{ v: 6 }`, `{ v: '5' }` give `null`; the X11.1 sample round trips unchanged; v1, v2, v3 and v4 samples gain `crew []` (no hires), `crewSeq 1`, `hiring null`, `season.drafted` per X11.3, `trained null`, `walkins []`, and no `hires` key; `SAVE_DIRTY` (a tender without the drum) gives no FIRE card; dirty v5: a card with `role 'drive'` is dropped, `skills [0.3, 9]` gives `[1, 5]`, `potential 2` with skills `[3, 4]` gives 4, `mood 5` gives 2, `notice true` at mood 0 gives false, two `bring` RUN cards keep only the first, a duplicate id drops the second card, `name 'Striker'` gives an unused list name, `trait 'x'` gives `null`, `hiring` with 17 pool entries gives `null`, `pick 'invite'` in week 3 is kept |
| 7 | seat reachability also requires `MAP.prepIdle` and `MAP.prepUse` reachable from the spawn with every gear and decor state |
| 12 | the generator reference model follows X3.4 exactly (`ry`, `rv`, the rotation, the stretch rule, the sizes, the third and stretch pay, the invite); with seed 7, rep 20, cash 80 and no gear, week 1 is the Birthday (tier safe, `base` 12, a `SAFE_SIZES` headcount) and the Church picnic (tier stretch, `needs` `ui.needsKettle2`, headcount 20, fee with `STRETCH_PAY`), and weeks 2 to 8 with `gear.kettle2` show two loadable booking cards, exactly one of tier stretch whose headcount is above its `base`, and each type's `menuIdx` differs from the week before; rep 50 multiplies every booking fee by `THIRD_PAY[1]` before rounding; rep 80 adds a card with `id 'invite'`, `invite: true` after the other booking cards; hosts equal the v3.0 model's (the `r` draws are untouched); the finale and the stub list checks of [W19] step 12 still hold (stub rows have no `menus`) |
| 14 | `setPlayer` now lands in loop `hiring` with events `player_set`, `hiring_open`, `save_wanted`; then `passRound()` three times and `finishHiring()`: loop `week`, events `hiring_done`, `week_start { year: 1, week: 1 }`, `offers_ready`, `save_wanted`; the rest of the step reads the Birthday's numbers from the offer (its headcount is a variant now) |
| 16 | after `startSeason()` the loop is `hiring` (year 2); `passRound()` three times and `finishHiring()` give week 1; a fixture card with `contract 1` before the season end renews at `wageFor(cardStars(skills), role)` and `seasonEndPreview().crew` named it |
| 21 | the X12.1 literal; 128 names, 352 frames; `star` frame 2 is frame 0's columns 0 to 4 and frame 1's columns 5 to 8; `mood` 5 frames that all differ; `art.bustRows(DEFAULT_LOOK, r)` is 22 rows of 26 legend characters for each role, the three roles differ, and changing one look key at a time changes the rows for every index of that key; `art.crewKey('run') === ''` after `build()`, and `setCrewLook('run', look)` changes `buddy_down` frame 0 and returns `'run:' + key`; `art.portrait(DEFAULT_LOOK, 'fire', { scale: 2, dpr: 1 })` is a 52 by 44 canvas |
| 43 | `cr-go` lands on `#hiring` (loop `hiring`), not the week hub; X15.2 step 70 runs next |
| 45 | `#card-crew` reads `ui.crewLine` and `ui.crewSub` for the crew Hiring Day left; `#third-line` reads `thirdNow[0]`; the offer tags read `ui.tagSafe` and `ui.tagStretch`; still at most `2 * innerHeight` |
| 46 | the week's report (the Birthday, after the one kettle picnic's stretch check) shows `rep-crew-{id}` for the RUN card hired in step 70, its line equal to the till row's `line` and its XP meter; `#rep-money` visible rows are the X13.6 compact set and add up to Cash; `rep-money-more` opens `rep-money-detail` with the v3.0 rows in their [W24] / [W25] order |
| 50 | `season-next` lands on `#hiring` for year 2; `hire-go` four times gives the week 1 hub |
| 51, 53 | a migrated save with no hires and no results lands on `#hiring` after `cr-go`; `hire-go` four times gives the week 1 hub; the status notice is `ui.notice` |
| 55 | skipping the tutorial still lands on the creator |
| 60 | adds `#hiring` (both pages), `#card` in each mode and the crew sheet from fixtures at 375 by 740: no horizontal scroll, every visible control at least 44 by 44 |

### X15.2 New steps

The console step moves from 63 to 76. Steps 63 to 69 are headless; 70 to 75 run in the page (70 right after step 43). Fatal: add 70.

| # | step | asserts |
|---|---|---|
| 63 | crew rules, headless | `skillValue` for every curve key at 1, 2, 3, 4, 5 stars (e.g. `fireSense` 45, 50, 55, 60, 65; `firePace` 5, 4.5, 4, 3.25, 2.5); `cardStars` and `wageFor` examples of X5.1; X5.2's clamp (skill 1 at mood -2 reads 1; skill 5 at mood 2 reads 5; 3 at mood -1 reads 2.5); `payroll()` budget 60, slots 2; `setBring` swaps two RUN cards and reports `swapped`; a fixture lineup of a 5 star FIRE (58) and a 2.5 star RUN (20) makes `canLoadUp()` give `ui.goPayroll` with 78 and 60; XP: fixture xp 190 then `train` gives banked 1, xp 30, `level_ready`; `levelUp(id, 0)` adds 0.5; at potential refuses with `ui.atPotential`; both at potential lifts mood by 1; `giveRaise` once (`wage` x 1.2 rounded, mood +1), twice refused; `letGo` free at `worked 0`, a send-off of the wage at `worked 1`, refused with `ui.sendOffCash` above cash |
| 64 | Hiring Day, headless | `genPool({ seed: 7, year: 1 })` twice deep equals; 18 entries, six of each role; every `stars` 1 to 3 and `potential` 2 to 5 and at least `max(skills) + 0.5`; names from the list, distinct, none in `avoid`; on a sim in loop `hiring`: `tryout` twice ok, a third refused, `hiringView()` hides untried potential; `hireApplicant(i)` makes a card with `contract 2`, `rookie true`, no fee, then exactly 3 entries turn `taken`, all from the 6 best open by `stars + potential` (the `ro` model), `round` 2, `round_done` with their names; `passRound()` twice gives round 4 and 6 more taken; with a fixture roster of 3, `finishHiring()` refuses with `ui.tooMany`; `letGo` of the unworked card is free; `finishHiring()` gives loop `week` with the X8 events; a reload mid-Hiring Day (serialize, validate, createSim) restores the same pool, statuses and round |
| 65 | walk-ins, headless | `genWalkins` counts 2, 2, 3 at rep 20, 50, 80; stars 2 to 4; deterministic; `startWeek` fills `season.walkins`; `hireWalkin(0)` takes the fee from cash, makes a `contract 1`, `rookie false` card, joins the lineup by X5.4, marks the walk-in hired, and `till.crewSpent` after the event equals the fee; a full roster refuses with `ui.crewFull`; the next week's list is new |
| 66 | mood, notice and leaving, headless | by `settle`: a 5 star booking lifts every lineup card one step; a 4 star booking lifts only the card with the most XP gained (equal under settle, so the lowest id); a 2 star booking drops every lineup card; a resting card gains on a Yard day and drops after two benched bookings; a fixture card at mood -1 dropped to -2 gets `notice` and `crew_notice`, works the next event at -2 and is gone after it with `crew_left` and `till.left`; the same card given a raise between the two events stays; the drag rule moves exactly one other lineup card, the one the `crewRng` model names |
| 67 | felt difference, headless (fatal) | the three scenarios of X15.3, each run at skills `[1, 1]` and `[5, 5]`, mood 0; FIRE: good seconds at 5 stars at least 1.25 times 1 star; RUN: plates set down in 10 s at least 1.25 times, guests fed within 4 s at least 1.25 times, and the mean wait of the three waiting guests at most 0.75 times; PREP: the time to slice both pieces at most 0.75 times; plus carry-forward 3: in the 5 star RUN run, from the fixture until the last booked guest spawns, no stretch longer than `C.ARRIVAL_PULL_S + 0.1` s with no booked guest arriving or waiting while food is in progress |
| 68 | thirds and offers, headless | a sim at rep 40: offers carry `THIRD_PAY[1]`; a settled 4 star booking that moves rep from 30 to 34 gives `till.third 0`, `thirdTo 1`; at rep 70 the week has an `invite` card and `C.WALKINS[2]` walk-ins |
| 69 | v2.1 and v3.0 saves migrate to cards, headless | a v3 sample (v2.1) and a v4 sample (v3.0 W13.1 shape) with `hires { buddy: true, tender: true }` and `gear.drum` validate to a RUN card (`skills [2.5, 2.5]`, `potential 4`, `wage 20`, `contract 1`) and a FIRE card (`[3, 3]`, 4, 30, 1), both `bring`, `rookie false`, `worked 1`, names distinct and in the list, `season.drafted true`; `payroll()` reads 50 of 60; `serialize()` has no `hires` |
| 70 | Hiring Day by real taps (fatal) | after `cr-go`: `#hiring` visible, `#hiring-h` `.sr` text `Hiring Day`, `#hire-round` `Round 1 of 3`, `app-0` to `app-8` present, `hires-left-n` 3; click `hire-page-next`: page 2 (`PitSim.game.hiringPage === 2`), `app-9` to `app-17`; click `hire-page-prev`; click a card: `#card` visible with `card-portrait`, `card-skill-0`, `card-skill-1`, `card-hire`, `card-pass`; screenshot `card.png`; click `card-tryout`: hollow star shown, `#hire-tryouts` `Tryouts left: 1`; click `card-pass`: back on `#hiring` with focus on that card; open the first RUN card on page 1 whose wage is at most 60 and click `card-hire`: `crew_hired`, `#hire-payroll` `aria-valuenow` equals its wage, `#hire-round` `Round 2 of 3`, exactly three cards read `Hired elsewhere` (another outfit took them) and that card reads `On your crew`; screenshot `hiring.png`; click `hire-go` twice (passes), then once more: the week 1 hub |
| 71 | crew sheet, walk-in and training by real taps | reload into a v5 fixture (week 2, cash 300, one RUN card in the lineup, `trained null`, the walk-ins as `startWeek` makes them); `card-crew`: `#crew-payroll` and `#crew-slots` `1 of 2 on the crew`; the card's `mood` frame matches its mood (`aria-label` `ui.moodAria`); `walkin-0` opens `#card` walk-in mode with `ui.hireFee`; `card-hire`: cash down by the fee, `#crew-slots` `2 of 2 on the crew`, the payroll meter grows by the wage when it joined the lineup; `train-{id}` on the first card: its XP meter rises by `C.TRAIN_XP`, `#crew-train-line` reads `ui.trainedLine`, every `train-` button is disabled; screenshot `crew.png` |
| 72 | level-up choice by real taps | reload into a v5 fixture (week 2, one RUN card with `banked 1`, skills `[2.5, 3]`, potential 4); crew sheet, the card, `card-level`: level mode with `card-pick-0` and `card-pick-1`; click `card-pick-0`: `level_up`, the card's `skills[0]` is 3, `card-banked` gone |
| 73 | crew rows on the report, thirds on screen | reload into a v5 fixture (week 3 with two results, rep 40, `gear.kettle2`, a RUN and a FIRE card both in the lineup, payroll 50); `#third-line` reads `thirdNow[1]`; the two tap week (first offer, `go`), advance to the report: `rep-crew-{id}` for the RUN and the FIRE with their lines equal to `till.crew[i].line`, mood faces per `moodTo`, no `rep-rested`, `rep-host-third` reads `hostThird[1]` with the player's name; the compact money table adds up; `#till` content at most `2 * innerHeight` with `rep-money-detail` closed; screenshot `report-crew.png` |
| 74 | v2.1 and v3.0 saves migrate in the page | reload into step 69's v3 sample: the creator, `#status` `ui.noticeCrew`; `cr-go`: the week hub (no Hiring Day: the save had hires), `#card-crew` `2 of 2 on the crew`, `Payroll 50 / 60`; reload into step 69's v4 sample: the week hub directly with the same two cards and the same notice |
| 75 | the crew in the yard | reload into a v5 fixture (week 2, a FIRE and a PREP card in the lineup); load up the first offer: `PitSim.game.crew.fire.key` and `.prep.key` equal `art.crewKey('fire')` and `art.crewKey('prep')`, which name the cards' looks; `captureFrame()` holds a `tender_` record and a `prep_` record; the FIRE card lights kettle 1 before the gate with no player input (`fire > 0` within 10 s). The Leave verb and the PREP slice are covered headless in step 67 |
| 76 | zero console errors across the run | as before |

### X15.3 The felt-difference scenarios (step 67)

Each starts the same way: `createSim(null, seed)`, `skipTutorial()`, `setPlayer(DEFAULT_LOOK, 'Pitmaster', 'Your Pit')`, `passRound()` three times, `finishHiring()`, then the fixture `sim.state.crew = [card]` with `card = { id: 1, name: 'Rosa', role, skills: [s, s], potential: 5, xp: 0, banked: 0, mood: 0, wage: wageFor(s, role), contract: 1, seasons: 0, rookie: false, trait: null, look: DEFAULT_LOOK, bring: true, raised: false, notice: false, worked: 0, bench: 0 }`, `bookOffer` of the Birthday offer, `loadUp()`, and the player never acts. `sim.tick()` drives the clock.

- **FIRE (seed 72):** fixture `state.charcoal = 60` right after `loadUp()`. Tick to the end of the event. Metric: `today.fireGoodS.kettle1` at the end.
- **RUN (seed 71):** tick until three booked customers are in mode `waiting` at once (fail the step if the clock passes 70 first; the Harness builder may move to the first seed from 71 up where three wait together, and records it). Fixture at that tick: `state.stations.board.stacks` = one stack per rail meat in `MEAT_IDS` order holding `today.rail[m]` plates stamped with the clock. Metrics: `today.crew['1'].plates` 10 s later; `today.fed` 4 s later; for the three guests waiting at the fixture, the mean of (the clock at their `served` event minus the fixture clock).
- **PREP (seed 73):** tick to the gate; fixture `state.stations.board.waiting = [{ meat: 'sausage' }, { meat: 'chicken' }]`. Metric: the clock at the second `slice_done` with `by: 'prep'` minus the fixture clock.

At the starting values the hand estimates are: FIRE about 72 percent of the time in the good band at 1 star and all of it at 5 (1.37 times); RUN a plate every 2.34 s at 1 star and every 1.13 s at 5 (plates in 10 s: 4 and 9; fed in 4 s: 2 and 3; mean wait about 3.5 s and 1.7 s); PREP about 10.7 s and 4.8 s. If a role misses, the Sim builder widens that role's 1 and 5 star columns in `SKILL_CURVE` (the 3 star column never moves) until it passes and records the values ([S 6.3]).

---

## X16. The econ bot (`games/pit-sim/dev/econ.mjs`)

Kept: every v3.0 mode and check of [W20] as amended through W26, driving only public methods. Changed for crew cards:

- **Start and Hiring Day (every season):** after `setPlayer` the bot is on Hiring Day. Round 1 hires the open FIRE applicant with the most stars (ties to the lower wage, then the lower `idx`); round 2 the open RUN applicant the same way; round 3 passes. From season 2, it hires in a round only for a role the crew lacks, and passes otherwise. When the roster is over the slots it lets go the card with the fewest stars until it fits. Then `finishHiring()`. No tryouts.
- **The lineup each week** (the v3.0 hire rules turned into Bring and Rest, so the bands compare with v3.0's results): the FIRE card is brought from the week the cooler is owned, the RUN card from the week the drum is owned and week start cash is 200 or more; on a Yard day nobody is brought (they rest and gain mood); and nobody is brought when week start cash is under the reserve plus the lineup's wages. The reserve of [W22.19] adds the lineup's wages.
- **Keeping the crew:** a card with notice gets `giveRaise` when it has not had one, else `letGo`. When the lineup rule wants a role the crew lacks, the bot hires the walk-in of that role with the most stars when `cash - fee >= reserve + 2 * wage`. It trains the lowest id card each week and spends every banked level on skill 0, then skill 1.
- **Day runs** (`econ.mjs` without `--season`): pass Hiring Day; the v2.1 "buddy at word of mouth 45" step hires the best RUN walk-in instead and brings it.

Checks (Normal, 50 seeds, 5 seasons), enforced unless marked information:

1. The [S 10.3] drum bands with wages: sharp S1W4, steady S1W8, rough S2W9.
2. Never stuck and rough never under 0 ([W20], [W22.21]), with wages in the pre-clamp sum.
3. Never idle ([W22.20]).
4. **Payroll in budget:** every event's lineup wages are at most `C.PAYROLL[0]`.
5. **Payroll is a real sink:** for sharp and steady, the median wages paid per season over seasons 2 to 5 are at least 8 percent of the median pay plus tips per season (enforced), and at most 40 percent (enforced). The output prints the share, the median wages per season and each policy's median cash at every season end next to v3.0's (sharp 827, 2361, 3895, 5429, 6963) as information, so the hand-off can say how much less sharp holds with nothing to buy. The Driveway (v3.3) is the sink that ends the hoard; this check proves wages are paid every week, not that they absorb the surplus.
6. Driveway affordable against S1W9, S2W4, S3W9: information until v3.3, as before.
7. Information: the Birthday played tick by tick by the competent bot on seeds 1 to 8: fed, stars, and the longest stretch with an empty line while food was in progress and guests were still to come (carry-forward 3; expected at most `C.ARRIVAL_PULL_S` plus a tick).

If a band fails, the Sim builder tunes in this order and records each move: `STRETCH_PAY`, then `THIRD_PAY[1]` and `[2]`, then `STRETCH_SIZE`, then `SAFE_SIZES`. The wage table, `ROLE_WAGE` and `PAYROLL` are [S 6.5]'s numbers and move only if nothing else passes (then it goes in the hand-off). The bot's rules above are fixed. The Sim builder records the run (median weeks per policy, payroll share, median cash at season ends) under Deviations in `sim.js`, and the Overseer copies it into a new [S 10.8] at integration.

---

## X17. The carry-forward items, answered

1. **Weeks 2 to 8 offered nearly the same two cards.** Each booking type now rotates through menu pairs week to week (X3.1, X3.4 step 3: a type never repeats its menu two weeks running), every week has one stretch card that is bigger (the largest headcount up to 1.4 times that fits the grate at full load), riskier (5 s less patience, one more flame) and pays 15 percent more on the formula, and the other card is a safe bet sized at 0.8, 0.9 or 1.0 of the base (X3.4 steps 5 and 6). Hosts keep their v3.0 draws. Week 1 on one kettle keeps the v3.0 shape: the Birthday is the safe bet and the Church picnic is the stretch with its Needs line. The cards carry a SAFE BET or STRETCH tag. Variety by season scaling and picky hosts stays in v3.2.
2. **Crossing a word of mouth third changed nothing visible.** The hub shows the third and what it brings on `#third-line` (X13.6). The middle third pays a tenth more on every booking fee and the top third a fifth more (`C.THIRD_PAY`, X3.3), which replaces [S 9]'s tip multiplier (tips are one to three coins and nobody would see 15 percent of them). The top third adds a third booking card, a repeat invite of the best paying type with the next menu (X3.4 step 7), and a third walk-in. The report adds a host line for the third (`hostThird`) and a line when a third is crossed (`rep-third`).
3. **The Birthday still had idle stretches.** Booked guests pull forward: when the line has been empty for 3 seconds while food is in progress and guests are still to come, the next party arrives now (X5.10). Nothing in the schedule's draws changes; step 67 and econ check 7 measure it.
4. **The report ran long on a phone.** The money table shows six to nine rows (fee, tips and bonus, costs, take, the gear, crew and stock rows when they are not 0, cash) with the full v3.0 rows one tap away under Show every row (X13.6), and the booking report with two crew rows fits two phone screens, with a pinned shrink order.

---

## X18. Decisions made in this contract (Overseer's calls for the hand-off)

1. Roles in v3.1 are RUN, FIRE and PREP; one card of each role works a cook, and turning a second card of a role on rests the first.
2. Skills map to the [S 6.3] curves through `skillValue`; RUN Friendliness drives both the handle pause and the seat tip share on plates the RUN card carried.
3. The FIRE felt metric counts seconds at `FIRE_GOOD` or above, not between `FIRE_GOOD` and `FIRE_HOT` as [S 6.3] says: the hot band cooks faster and burns no faster (`HOT_BURN_MULT` 1.0), so a 5 star FIRE that runs hot is the better cook, and the [S] band would score it lower. Overrides [S 6.3].
4. The RUN felt check is measured with guests already waiting and the board loaded, so the RUN card is the only way plates reach the table; with a working player its one tile job hides the stars. The check is plates set down, guests fed and the line's wait.
5. The PREP card slices only pieces you leave on the board; leaving is the board's tap verb while it has room for two, and a piece you leave is the PREP card's. When the board is busy you wait.
6. The FIRE card works from the first kettle; `validateSave` keeps the drum check only for a legacy v2 tender being migrated.
7. A new card joins the lineup when its role is free and the payroll fits; otherwise it starts resting.
8. Mood steps apply in a fixed order from the moods at the end of the event; the drag and the 4 star pick use their own seeded generator, so no crew rule moves `sim.rng()`.
9. A card at -2 gives notice, works one more event, and moves on after it unless its mood rose; a raise is the quickest way to keep them.
10. Levels are always banked and spent by hand from the report or the Crew sheet; the wage changes only when a contract renews.
11. Until v3.2's Offseason screen, every expiring contract renews for one season at the table wage for the card's current stars.
12. Hiring Day pools are 6 of each role, saved while Hiring Day is open; other outfits take 3 of the 6 best open cards after every round, by a seeded draw.
13. The pool and walk-ins draw from the save's season seed; no `poolSeed` field ([S 11]).
14. Walk-ins come trained (not NEW), sign for one season, cost one event's wage as a signing fee, and go at the end of the week.
15. Hiring Day shows 9 cards a page in 2 columns (the mock), not [S 12.3]'s 3 columns; the mock's role colors replace [S 12.3]'s band colors.
16. The portrait bust is 26 by 22 (the mock's framing) instead of [S 12.3]'s 32 by 32, drawn from the same look parts as the in-yard sprite, and the in-yard crew now wear their own looks with a role outfit.
17. A migrated v2 or v3.0 hire has `worked 1`, so letting it go costs a send-off; it skips Hiring Day in its season.
18. `state.hires` and the `hires` save key are gone; `hire()` stays as an inert stub so the surface and old callers do not break.
19. Offers vary by menu pair, size and tier inside the two v3.0 types; the stretch card is the gear stretch when there is one, else a drawn card sized to fit at full grate load.
20. The word of mouth third pays on the fee (`THIRD_PAY` 1.0, 1.1, 1.2) instead of [S 9]'s tip multiplier. Overrides [S 9].
21. The top third's extra card repeats a type with id `'invite'` when no new type is unlocked. Overrides [S 3.2]'s "no booking type appears twice in one week" for the invite only.
22. Booked guests pull forward when the line sits empty for 3 s while food is cooking.
23. The report's money table is compact by default with every v3.0 row one tap away.
24. The crew lineup lives on the Crew tile and sheet, not a row on the hub, so the hub keeps its two screen limit ([S 4.2] item 4 is met by the tile, the sheet and `go-why`).
25. Every builder writes the calls above that touch their file under Deviations; items 3, 20 and 21 also go in [S 17] as overrides of [S].

### X18.1 Builder questions answered (2026-10-19, Overseer's calls)

Each item below is an Overseer's call that settles a question the builders raised against this contract. Nothing here adds scope; each one pins a rule the sections above left open. Where an item and an earlier section disagree, the item wins. Item 25 applies to these too: every builder writes the items that touch their file under Deviations.

26. **Menu rotation never makes a row unloadable (X3.4 step 3).** Overseer's call. If the rotated pair makes a row unsafe but `menus[0]` is safe on the owned gear, step forward k = 1, 2, ... to `menus[(m0 + week - 1 + k) % len]` until one is safe (no extra `ry()` draw). If none is, use `menus[0]`. `menuIdx` records the pair actually used. With the Birthday's 3 pairs the chosen pair still differs from last week's. At Normal nothing changes: every Birthday pair is safe on one kettle and every Church picnic pair still needs the second kettle, so harness step 12 holds as written. Separately, a picked card with `needs !== ''` that is not the week's stretch gets tier `'stretch'` too (never SAFE BET over a Needs line), and it gets no stretch pay or sizing.
27. **One `ry()` draw per array index of types (X3.4 step 3).** Overseer's call. One `ry()` draw for every array index of `types`, in order, before any filtering. Entries step 3 skips (not a plain object, id `'yard'`, a duplicate id, the finale) still use up their draw, so the sim and the harness reference model stay in step. A row with no `menus` reads `[row.menu]`. A row with an empty `menus` array draws and then uses its `row.menu` (no modulo by 0).
28. **An unsizable stretch (X3.4 steps 5 and 6).** Overseer's call. When no h fits, the drawn stretch keeps its base headcount exactly and gets no `SAFE_SIZES` draw. Step 6 draws only for the other picked offers, in picked order. The window in the grate formula is the offer's length scaled window (`offerFields`' `win`, the same one P-1 uses). For every resized card, recompute rail, pay and deposit at the new headcount. Do not recompute `safe` or `needs`, except that a sized stretch's `needs` stays `''`.
29. **The invite card (X3.4 step 7).** Overseer's call. (a) "The highest pay loadable picked offer" compares final pay after steps 5 and 6, ties by row index; that is usually the sized stretch's type. (b) If the next menu pair is not safe, step forward through that type's pairs (as in item 26) until one is safe at the base headcount; if none is, there is no invite card this week. (c) Both kinds of invite (this one and a v3.0 style invite found by step 6's stub type lists) sit outside `picked` for steps 5 and 6: base headcount, tier `'safe'`, `invite: true`, the X3.3 fee, no `rv()` draw.
30. **Preselect and tags (Q-7, X3.2).** Overseer's call. Preselect the first card in display order whose type matches last week's and is loadable. That is never the invite, which sorts after the other booking cards. Tags (`offer-{id}-tag`) appear only on booking cards in weeks 1 to 8. The finale card and the Yard day carry no tag.
31. **When serialize writes `season.walkins` and `season.trained` (X11).** Overseer's call. Same live rule as `pick` and `addon` (loop `'week'` and `week === s.week`): serialize writes `walkins` (with hired flags) and `trained` only when live, and otherwise writes `walkins: []` and `trained: null`. `createSim` restores the saved list only when it is non-empty and validated, and restores `trained` only when the list was restored or loop is `'week'`. An empty list always means regenerate: `WALKINS` is never under 2, and hired walk-ins stay in the list.
32. **`crewSpent` and `crewPaid` (X4.4).** Overseer's call. Keep them in a closure accumulator like `morningBuys`, not saved. Clear it in `beginMorning` and again in `startWeek`. `finishHiring` calls `startWeek()` with no argument, so `weekCash` is the cash after Hiring Day send-offs, and Hiring Day spending shows only in `#live`, never on the week 1 report. A reload between a crew spend and the event loses the row exactly as `gearSpent` does in v3.0; that is recorded as a known v3.0 limit. The harness never reloads in that window.
33. **Letting go a card drafted the same Hiring Day.** Overseer's call. The pool entry turns `'taken'` (they sign with another outfit) and reads `ui.taken`. It never reopens, and its name is free for later walk-ins. Picks used stay used, because the round already ended at the hire.
34. **Pool and walk-in name validation (X11.2).** Overseer's call. Pool and walk-in names are checked only for being a `STRINGS.names` entry and distinct within their own list. A bad or duplicate name takes the first unused list name from `names[idx % 60]` stepping forward (walk-ins use `names[i % 60]`), skipping only names already in that list. No check against crew names. `hiring` is kept only when `hiring.year === season.year`.
35. **Where potential shows.** Overseer's call. Potential is always shown on crew cards (hiring reveals it, so no new field). Walk-ins also show potential, because they come trained and have no tryout. Only untried Hiring Day pool entries hide it (`hiringView` null and `ui.potentialHidden`). The sim's `crewView` and `season.walkins` always carry the number; only `hiringView` masks it.
36. **NEW badges.** Overseer's call. No NEW badge on pool cards or walk-ins. NEW shows only on held cards with `rookie: true`. The mock's mixed badges are mock content, replaced like its 4.5 star and 60 wage cards.
37. **The crew row `line` text and the FIRE percent (X4.4, X10).** Overseer's call. The sim builds `CrewRow.line`. Lineup RUN: `crewSay.run` or `runOne` with n = plates. FIRE: `fire` or `fireOne` with n = bags, p = `goodPct`. PREP: `prep` or `prepOne` with n = cuts, s = `Math.round(savedS)`. When that role's count is 0: `crewSay.idle`. Settle: `crewSay.settled`. Non-lineup rows: `crewSay.rested`. `goodPct = Math.round(100 * sum over owned (stationActive) cookers of fireGoodS / (owned count * max(tick, endClock - gateAt)))`, clamped 0 to 100, and 0 when the event ended before the gate. The FIRE card feeds every owned cooker (`cookerNeedingFire` loops them all), so owned is the right base. `fireGoodS` and `fireDipped` are sampled once a tick, after `tickFire`, on ticks with `clock >= gateAt`, whether or not a FIRE card works.
38. **The pull-forward timer (X5.10).** Overseer's call. A closure timer, not saved. On a booking, each tick with `clock >= gateAt` and `pending > 0`, it adds dt when no `c.booked` customer is in mode `'arriving'` or `'waiting'`, and resets to 0 otherwise. The pull fires on the first tick where timer `>= C.ARRIVAL_PULL_S` and food is in progress at that tick; the timer then resets to 0. "Food in progress" is exactly the X5.10 list: an active cooker piece not burnt, a board stack, a waiting piece, a slice, or a table plate. Hands do not count. Harness step 67 and econ check 7 use the same predicate. The pulled party is the one starting at `schedIdx`, if its time is later than the clock. Out-of-order later times are fine, because spawns go in index order.
39. **The PREP Leave verb (X5.3).** Overseer's call. Leave appears only when `boardFits(meat, MEATS[meat].plates)` holds, counting the plates of pieces already waiting for that meat. Otherwise it falls through to the v3.0 row "Board is full. Use the trash". The verb label is `'Leave ' + MEATS[m].label + ' for ' + name`. The game fills `say.leftFor` `{label}` with `MEATS[m].label` lower cased. `rollOrder`'s `cookW` counts each waiting piece the way it counts a slice. `soldOut()` is false while `waiting` holds a piece.
40. **The FIRE card's pauses and walk do not scale.** Overseer's call. The FIRE card keeps literal `C.BUDDY_HANDLE` pauses and `C.NPC_TILES_PER_S` walk ([S 6.3]: the FIRE card keeps v2's 0.4). Only `cookerNeedingFire`'s threshold (`fireSense` at `eff[0]`) and the cooldown (`firePace` at `eff[1]`) change. Only `tickBuddy` swaps in `runSpeed` and `runHandle`.
41. **Where `eff`, `today.crew` and `today.third` are set.** Overseer's call. In `startService(kind)` for both `'booking'` and `'yard'` (the tutorial makes no movers). Each mover stores `eff` and a `vals` map, with `cardId` (`state.buddy.eff`, `state.buddy.vals`, and the same on `tender` and `prep`). `payBonus` with `c.runPlate` reads `state.buddy.vals.runSeatTip`; if `state.buddy` is null at that moment, it pays v2's bonus. `canLoadUp`'s payroll check applies to Yard days too.
42. **Placeholders the sim fills.** Overseer's call. `ui.oneRole`: `{role}` = `STRINGS.roleName[role].toLowerCase()`, `{name}` = the card that now rests (example: "One server works a cook. Rosa rests."). `ui.goPayroll`: `{p}` = `payroll().now`, `{b}` = budget. `ui.tooMany`: `{s}` = slots. `ui.appAria` (filled by the game): `{role}` = `roleName` and `{stars}` = the `ui.starsMany` or `ui.starsOne` text.
43. **XP at `BANK_MAX` (X5.5).** Overseer's call. When banked is already 9 and xp crosses `LEVEL_XP`, `xp -= LEVEL_XP` still happens (the level is lost, which keeps xp at 199 or under). `level_ready` fires only when banked actually rose. The check loops, so 2 levels in one event bank 2.
44. **Validating `season.trained` (X11.2).** Overseer's call. `trained` is valid as any integer 1 to `crewSeq - 1`, or null, not necessarily a current crew id. `letGo` never clears it.
45. **Crew caps on hiring (X6).** Overseer's call. `hireApplicant` refuses with `ui.crewFull` when `crew.length >= C.CREW_MAX`. That cannot happen in v3.1 (2 slots + 3 picks = 5) but guards the save clamp. `hireWalkin` keeps the slots check.
46. **Crew looks at every drawing site (X12.3).** Overseer's call. When `till.crew` has no worked RUN row, the report hero band draws no buddy. `game.js` calls `art.setCrewLook('run', card.look)` before drawing it whenever one worked. Every drawing site (yard, hub crew tile, report) calls `setCrewLook` for the card it draws first, and never relies on the last call.
47. **The eager econ policy (X16).** Overseer's call. The X16 bot rules stay fixed. Add one information-only policy, `'eager'` (steady stars, brings its Hiring Day lineup to every booking from week 1, otherwise the steady rules), and print its stuck count, under-0 count and median season 1 cash. Also print, as information, the number of `crew_left`, send-offs and walk-in hires per policy in season 1. If eager steady is stuck in more than 0 of 50 seeds, it goes in the hand-off as a Joel playtest watch item. Nothing in `C` moves for it.
48. **Felt difference margins (X15.3).** Overseer's call. If step 67's FIRE ratio is under 1.30 at starting values, widen only the 1 star column first: `fireSense` 45 to 40, then `firePace` 5.0 to 6.0, keeping the 3 star 55 and 4.0. Old and new values go under Deviations. `runSeatTip`'s rounding stays as specified (the 3 star value must equal v2 at every `seatBonus`). The RUN felt difference comes from `runSpeed` and `runHandle`, and the hand-off notes that the tip perk only shows at charm 10 and up.

---

## X19. Integration record (2026-10-19)

The four builders built against X0 to X18.1 and the round was integrated the same day. Nothing past v3.1 was added, and nothing in `games/pit-sim/art3/` or `dev/look-proof.html` changed.

**Result.** `node --check` passes on `sim.js`, `game.js`, `sprites.js`, `dev/smoke.mjs` and `dev/econ.mjs`. No edited file holds U+2014 or U+2013 (the three spec docs included), and the scripts hold no `innerHTML`, inline script or handler attribute. `node games/pit-sim/dev/smoke.mjs` passes 76 of 76 at 375 by 812 (seed 1) and with `--desktop --seed 3`, with zero console errors in both runs. `node games/pit-sim/dev/econ.mjs --season` passes every enforced check at Normal, Short and Long, and the day runs pass; the numbers are in [S 10.8].

**The one tuned value.** `SKILL_CURVE.fireSense` at 1 star moved from 45 to 40 (X18.1 item 48). At 45, step 67's FIRE scenario (seed 72) gave 74.95 good seconds against 95.05, 1.27 times; at 40 it gives 59.95, 1.59 times. `firePace` and every 3 star value are unchanged, and step 5 prints the move as tuned.

**Seams checked at integration.** Against the built modules: every `STRINGS.ui` key `game.js` reads (215), every `STRINGS.say` key (29), every `C` and `FX` key, every `sim` method, `PitSim` name, `art` member and literal sprite name exists, and every X13 and X14 DOM id is built. In the page, beyond the harness: three Hiring Day picks make Start week 1 refuse with `ui.tooMany` until a card is let go from the crew sheet (free, and its pool entry turns taken, item 33); a level banked by training is spent from the report's `rep-crew-{id}-level`, and Back returns to the report; the season end card and the year 2 Hiring Day open in turn, and the year 2 pool holds no name already on the crew. `dev/sheet.html` now draws `genPool({ seed: 7, year: 1 })` instead of its fallback, and its X12 check line passes.

**Integrator edits.** One stale comment in the `sim.js` header (it said `dev/econ.mjs` still read `state.hires`); it now records the integrated econ run. No seam needed a code fix.

**Builder deviations.** Each is written out in its file's header; this list points to them.

- `sim.js`: X-1 to X-14 restate the X18 and X18.1 calls as built. V-1 a tryout is saved at the round's end; V-2 a level's mood lift also clears notice above -2; V-3 the stub list's second Needs card keeps its `rv()` draw unsized; V-4 `train()` emits `level_ready` before `trained`; V-5 the pull forward runs before the spawn loop, so a pulled party joins that tick; V-6 a load into Hiring Day drops every event the load made; V-7 `hireWalkin()` also guards `CREW_MAX`; V-8 `goodPct` rides on every lineup row; V-9 defensive clamps (stars, walk-in list length, a duplicate name); V-10 `setLength()` stays week and tutorial only. `genOffers` also skips a `'finale'` row inside a types list, using up its `ry()` draw (item 27).
- `game.js` and `index.html`: items 43 to 56. `#card` and the crew sheet replace the panel that opened them and rebuild it on Back; a hire closes `#card`; in level mode both picks stay enabled under `ui.levelBoth`; half and hollow stars; the card aria labels; `#hire-go` in the mock's blue framed style and `#hiring-foot` pinned at the bottom on phones; Bring, Train, an XP meter and the banked line beside each crew sheet card; the compact money table's details; `rep-third` and the crew box order; the report shrink steps; the offer tags on the card's corner; `ensureCrewLook`; `#third-line` wrapping (below); the NEW badge and band on the card sheet portrait.
- `sprites.js` and `dev/sheet.html`: the RUN bust's name tag takes the apron color; `CREW_OUTFIT` also holds the legs; the bust wears one calm face; hair shows under every hat (the bun's knot hides under the cowboy hat); round glasses with light lenses; the shirt's light tone as a shoulder rim; `setCrewLook` caches 24 looks a role; mood face shading.
- `dev/smoke.mjs`: 21 to 34 and the step 6 and 46 notes. Steps run out of number order, and the log numbers them in run order: X15 steps 63 to 69 print as 18 to 24, step 70 as 51, and steps 71 to 75 as 71 to 75 (steps 18 to 62 shift to make room). Step 12's model accepts both readings item 26 leaves open on stub lists; the W19 literals that X3 moved are asserted only on draws that keep the v3.0 shape; v4 fixtures that need the week 1 hub use a v5 fixture with `drafted true`.
- `dev/econ.mjs`: 4 to 9. Pay and tips count the deposit, the rest of the pay, the menu bonus, tips, seat tips and plate sales; the lineup brings FIRE first, then RUN while the budget holds, and trims PREP, then RUN, then FIRE after a walk-in hire (without that order, renewed wages break the 60 budget and Load up and go refuses); a refused Load up and go falls back to a Yard day with everyone resting; the exit code is 2 when `sim.js` lacks the v3.1 surface.

**Known gaps, for the hand-off.**

1. Hiring Day at 375 by 812 scrolls one card row: the content is 976 px against an 812 px screen. The bottom bar is pinned, so Crew, Hires left and the arrow stay on screen, but X13.2's "fits in one phone screen plus the bottom bar" is missed by about 28 px. The mock fits 10 cards at 390 by 844 without the round and tryouts line and the 44 px page arrows this contract adds.
2. `#third-line` wraps to a second line on a phone (X13.6 says one line): `ui.thirdNow[0]` is 61 characters and the hub's 12 px monospace holds about 48 at 375.
3. Wages do not slow the sharp player: sharp ends season 5 with 12492 against v3.0's 6963 ([S 10.8]). The Driveway in v3.3 is the sink.
4. The eager policy (both cards at every booking from week 1, 3 stars) never owns the drum at Normal and its cash stays near 130 ([S 10.8]). Watch item for Joel's playtest.
5. RUN Friendliness's seat tip share only shows at charm 10 and up (`seatBonus` 2 or 3); below that the RUN felt difference is speed and handling (item 48).
6. Harness steps 13 and 62 buy the second kettle from cash 103 leaning on the picnic's deposit. After the buy the picnic can be redrawn as the sized up stretch (28 guests); it loaded in every run here, but the margin is draw dependent.
7. A reload between a crew spend and the event drops the Signing and send-off row from that event's report (item 32, the v3.0 `gearSpent` limit).
8. The art director has not yet passed the new screens (Hiring Day, the card sheet in its four modes, the crew sheet, the report's crew box, the in-yard crew looks). The integrator compared the harness screenshots with `screen-2-crew.png`, `screen-3-week.png` and `screen-4-report.png`: the role bands, badges, mood faces, payroll meter and bottom bar follow the mock; the differences are item 1 and the contract's own word and number changes.

---

## X20. Review round 1 (2026-10-19)

The art director's and the playtesters' first pass over v3.1 (45 findings, many of them one finding seen by two readers) was applied in the v3.1 files. Each item below is an Overseer's call; where it changes a number, a string or a rule written earlier in this file or in [S], it says which, and it wins. Item 25 of X18 applies: every builder file carries its items under Deviations. Nothing past v3.1 was added, and nothing in `games/pit-sim/art3/` or `dev/look-proof.html` changed. Every `C` value that moved prints in harness step 5 as tuned (old to new), because the harness's `C_X2` keeps the X2 starting values.

### X20.1 RUN: Friendliness pays on every plate the RUN card carries

The playtest found a 1 star and a 5 star RUN card played the same in a real booking: the board to table hop is one tile and never on the critical path, and `Math.round(seatBonus() * (1 + runSeatTip))` rounded the seat perk to nothing under charm 10 (X19 known gap 5).

- New curve `C.SKILL_CURVE.runTip: [-0.25, 0, 1.0]`, driven by Friendliness: `C.ROLE_SKILLS.run[1]` is `['runHandle', 'runSeatTip', 'runTip']`. The 3 star value 0 keeps v2's plate tip (the review suggested `[0, 0.25, 1.0]`, which would have moved the fixed 3 star column).
- `serveFromTable`: a plate the RUN card set down tips `Math.round(m.price * C.TIP_RATE * (1 - frac) * (1 + vals.runTip))` plus the hot plate tip, and the tip adds to `today.crew[id].tips` (a new field of the crew record, 0 at the start).
- `payBonus` on a RUN plate: `bonus = seatBonus() + Math.round(2 * vals.runSeatTip)`, one more coin from 4 stars at every charm level (none at 3 stars and under, so v2's bonus there). It adds to `today.crew[id].tips` too. Replaces the X5.3 formula.
- `CrewRow.stat.tips`; `crewSay.run` and `runOne` name the tips (X20.12); `skillHelp.run[1]` changes (X20.12).

### X20.2 FIRE: the hot band and a walk that follows Pace

A one kettle model put the cook rate at 0.948 at the 1 star values and 1.050 at the 5 star values, 11 percent apart: the 5 star card never held the hot band, where food cooks `HOT_MULT` faster and burns no faster.

- `C.SKILL_CURVE.fireSense` is `[40, 55, 88]` (5 stars 65 to 88; 4 stars now 71.5). `firePace` is unchanged.
- The FIRE card walks at `clamp(C.NPC_TILES_PER_S * C.TENDER_CYCLE / vals.firePace, C.FIRE_WALK[0], C.FIRE_WALK[1])` with the new `C.FIRE_WALK: [3.5, 5.5]`: 4 tiles a second at 3 stars (v2), 3.5 at 1 star, 5.5 at 5. Overrides X18.1 item 40 for the walk only; the grab and add pauses stay `C.BUDDY_HANDLE`.
- `prefill()` on a booking with a FIRE card in the lineup buys, per owned cooker, the larger of the v3.0 count and `Math.ceil(seconds * C.KETTLE_DECAY / clamp(C.FIRE_MAX - fireSense, 1, C.FIRE_ADD))` bags at the card's effective Fire sense: 11 a cooker at Normal for a 5 star card; unchanged up to 4 stars.
- `today.fireHotS: { kettle1, kettle2, drum }`, seconds after the gate at `FIRE_HOT` or above, sampled with `fireGoodS`. `CrewRow.stat.hotS` is the rounded mean over owned cookers. The FIRE line is `crewSay.fireHot` (or `fireHotOne`) when `hotS >= 1`, else the X10 line.
- XP: `C.XP_FIRE_BAG` 1 to 3 and `C.XP_FIRE_HOLD` 10 to 15, so a FIRE card banks about what a RUN card does (a Birthday about 24, a two kettle picnic about 54).

### X20.3 The STRETCH card always pays the most

In weeks 4, 5 and 8 of the playtest the STRETCH Birthday paid less than the SAFE BET picnic beside it and fed no more guests.

- `C.STRETCH_SIZE` 1.4 to 1.2, `C.STRETCH_MIN` 1.15 to 1.1, `C.STRETCH_PAY` 1.15 to 1.1, new `C.STRETCH_EDGE: 1.0`. At 1.4 the two kettle picnic stretch was 28 guests and fed 20 in the playtest; at 1.2 it is 24.
- X3.4 steps 5 and 6 for a week with no Needs card (a gear stretch week is unchanged): one `rv()` draw `u` first, then one `SAFE_SIZES` draw for every picked card in picked order (its safe size). A picked card is a candidate when its largest stretch headcount that fits the grate at `STRETCH_LOAD` (from `Math.round(base * STRETCH_SIZE)` down to `Math.ceil(base * STRETCH_MIN)`) pays, at the stretch pay, more than `STRETCH_EDGE` times the safe size pay of every other picked card. `u` picks one candidate in picked order (`cands[Math.floor(u * cands.length)]`); it becomes the stretch at that size, and every other card takes its safe size. With no candidate the week has no stretch. Replaces the `picked[Math.floor(rv() * picked.length)]` draw.
- Harness step 12's reference model follows it and asserts the stretch pays the most in every two kettle week; the econ bot checks it every week of every run (X20.10).

### X20.4 A gear buy keeps the cards on the hub

Buying the second kettle in week 3 turned the picnic the player saved for from 20 guests at 360 into 28 at 505, with no notice. After a gear buy in the week (the W22.11 regeneration; a decor buy regenerates nothing), every offer whose `id` and `type` are still offered keeps everything it showed (headcount, menu, `menuIdx`, pay, deposit, host, tier, patience, difficulty, `base`, `invite`); only `needs` and `safe` follow the new gear (`needsFor`, then the P-1 grate test on its own rail and window). A card the buy adds (the top third's invite) comes in fresh. `setLength()` still regenerates every card. Closes X19 known gap 6.

### X20.5 Mood: Fired up is a burst you earn

Both playtest cards sat at Fired up for seven straight events, so mood asked for no choice. X5.6 step 1 becomes, from the end of event moods:

- Step 0: a lineup card at +2 when the event ended gets -1.
- Step 1: 5 stars, +1 to every lineup card below Happy, or to every lineup card when the booking was tier `'stretch'`; 4 stars, +1 to the lineup card with the largest `xpGain` (ties to the lowest id) only when it is below Happy; 2 or 1 stars, -1 to every lineup card.

Resting, the drag, the clamp and notice are unchanged. Fired up comes from a 5 star stretch, a raise or a rested Yard day, and a card that works an ordinary event while Fired up eases back a step. Overrides the first two rows of [S 6.4]'s cause table. The hub's Pit news gains `news-fired-{id}` (`ui.firedUp`) for each lineup card at +2.

### X20.6 Wages in view, and the money table one line a row

- The Next event card gains `next-crew` under the deposit line: `ui.crewNext` with the lineup's names and the payroll, or `ui.crewNone`.
- The compact money table (X13.6): Costs is food with raw waste, charcoal, spoilage and the daily costs, with no detail line; the wages get their own row after it (`ui.rowWages`, the names as its detail, when wages are above 0). Every compact row stays on one line at 14 px, a long detail ending in an ellipsis; the money column is `minmax(0, 1fr)`, so a long row never pushes Word of mouth past the screen edge.
- Each report crew row: the role badge, the name, the mood face and the XP meter on one line (`.rc-xpt` 13 characters wide with tabular numbers, so every bar ends at the same x), the till line, then the mood words, `ui.wageRow` and a gold Level up chip; the portrait is 40 by 34.
- `ui.costsDetail` and `ui.rowDrawn` change (X20.12).

### X20.7 Hiring Day pools, walk-ins and names

- `C.HEADLINER: [2.5, 2]`: the first card of each role in pool order draws each skill as `2.5 + Math.floor(rp() * 2) / 2` (2.5 or 3) in place of X6.1's `1 + Math.floor(rp() * 5) / 2`, with the same number of draws. Every pool holds one 2.5 to 3 star card a role, the cards the other outfits go after first.
- `genWalkins`: none in week 1 (Hiring Day was that morning); a walk-in comes at its ceiling, `potential = Math.max(s0, s1)` (the X6.3 potential draw is still made, so the mood and look draws keep their place). The crew sheet's walk-in line reads `ui.walkinsLater` while the list is empty. Overrides [S 6.6]'s weekly walk-ins for week 1.
- Names: `genPool`, `genWalkins` and `genOffers` take `avoid` = the crew's names plus the pitmaster's (`offerInput()` carries it; `genOffers` seeds its host set with it), so no applicant, walk-in or host shares a name with the crew or the player.

### X20.8 Crew looks

- `C.HAT_SHARE: 0.25`. Pool, walk-in and migrated looks share one draw (`drawLook`, six draws in `LOOK_KEYS` order): the hat draw `u` is no hat under `1 - HAT_SHARE`, else hat `1 + Math.min(2, Math.floor((u - (1 - HAT_SHARE)) / HAT_SHARE * 3))`; long hair never goes under a cap (that pair drops the cap). The harness's X11.3 and X6 models follow it.
- `sprites.js`: a crew card's cap takes one of four ramps by `look.apron % 4` (rust, navy, forest, grey; palette characters only), on the bust and in the yard; under a cap, long hair shows only from bust row 7 down. The player's own cap stays rust.

### X20.9 The practice day never costs the season

When the tutorial day hands over (its `finishReport()`, or `skipTutorial()` in the morning), `cash = Math.max(cash, C.START_CASH)` and `rep = Math.max(rep, C.START_REP)`. The tutorial till shows `tut-floor` (`ui.tutorialFloor`).

### X20.10 Harness and econ

- Step 67 (printed 22) keeps the staged X15.3 legs as unit checks and adds full booking legs: for each role (seeds 71, 72 and 73) at skills 1 and 5, a Birthday on kettle 1 and the week's picnic on two kettles (fixture `gear.kettle2`, cash 2000), played tick by tick by the competent bot ported from `econ.mjs`, which leaves that role's job to the card ('run' never carries plates off the board, 'fire' never fetches charcoal, 'prep' leaves cooked pieces while the board has room); settle is off. It requires 25 percent on the player's number: RUN the tips on the plates it ran (5 stars at least 1.25 times 1 star), FIRE and PREP the mean wait of every booked guest over both legs (5 stars at most 0.75 times).
- The felt fixtures' wage is `Math.min(wageFor(s, role), C.PAYROLL[0])` (a no-op at 60), so the check can never trip on the budget.
- Every step that reads these rules follows X20.1 to X20.9 and X20.11 (the reference models of steps 12, 64, 65 and 69, the mood step 66, the report rows of steps 46 and 73, the Hiring Day taps of step 70, which reads `#hire-news` and answers the empty crew pass confirm); step 63's over budget fixture reads the budget through `C`.
- `econ.mjs` adds the enforced check "the stretch pays the most" per policy: every week the hub opens, a tier `'stretch'` card pays more than `STRETCH_EDGE` times every tier `'safe'` card beside it (the invite, the Yard day and the finale aside).

### X20.11 The screens

- **Hiring Day.** The top row holds the cash, then `hire-round` and `hire-tryouts` in the UI font (no tryouts line once every round is done), then the info box; the old status row is gone, so the grid starts higher. `#hire-news` above the bottom bar shows the last `say.roundDone` sentence and a gold `ui.tryoutTaken` line for each card you tried out that went elsewhere. A page arrow toward a page where cards were just taken carries `hire-page-taken` (`ui.takenBadge`, aria `ui.takenPageAria`). `#hire-go` shows the visible word PASS beside its arrow while rounds are open (its label stays `ui.passRound`); with nobody on the crew a pass asks once (`#hire-why` reads `ui.passEmpty`, with `hire-pass-yes` and `hire-pass-no`). Once round 4 is reached the bar is `.hire-bar.done`: no Hires left box, and START WEEK 1 takes the room beside Crew.
- **The card and crew sheets.** Every action button (`card-tryout`, `card-hire`, `card-pass`, `card-pick-{i}`, `bring-{id}`, `train-{id}`, `card-train`, `card-raise`, `card-letgo`, the yes and no confirm, `rep-crew-{id}-level`) draws its words in the uppercase UI font with a shadow, as `#go` does; the accessible name stays in sentence case. Pass is a quiet outlined button. Bring shows a state: a check and COMING (`ui.bringOn`) when the card is in the lineup, RESTING (`ui.bringOff`) when not, with `aria-pressed` and `ui.bringAria` unchanged; a resting card is dimmed on the crew sheet and on the hub tile.
- **Level up.** Each pick has a line under it naming what changes in the cook (`ui.levelWhat`: the skill's curve value now and a half star up). After a pick `#card-why` reads `say.levelUp` and, when the overall stars rose, `ui.levelStars`; the skill row that rose gets a gold outline (`.lvl-new`, static, so reduced motion keeps it).
- **The hub crew tile.** Up to three portrait busts on their role bands with the mood face in the corner (the lineup first, resting cards dimmed) on a flat ink window, as `screen-3-week.png` draws it. Amends X13.6's in-yard down frames.
- **Cards.** Grid stars are the mock's 11 px outlined star and the coin its 6 by 6 pixel coin at 2x; the half potential star is one clean glyph (the empty star with the hollow frame's left half).
- **In the yard.** A tip or seat tip landing within 12 px across and 8 px up or down of a fresh one of the same kind adds into it (`+4 TIP`) and restarts it; one that overlaps any other fresh number sits 9 px higher per number; a tip keeps 6 px clear of the right fence posts.

### X20.12 `STRINGS` changes (exact text)

Changed: `crewSay.run` `'{name} ran {n} plates. Guests tipped {t}.'`; `crewSay.runOne` `'{name} ran 1 plate. Guests tipped {t}.'`; `skillHelp.run[1]` `'Hands plates over quicker. Guests tip more on the plates they carry.'`; `ui.costsDetail` `'meat, charcoal, spoilage and daily costs'`; `ui.rowDrawn` `'Bought earlier'` (Q-11's longer text did not fit one line).

Added to `crewSay`: `fireHot: '{name} added {n} bags and kept the fire hot for {s} seconds. Food came off faster.'` and `fireHotOne: '{name} added 1 bag and kept the fire hot for {s} seconds. Food came off faster.'`.

Added to `ui`:

```js
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
  prepPace: 'Walks {b} tiles a second instead of {a}.'
}),
levelStars: 'Now {n} stars. The wage stays {w} this contract.',
firedUp: '{name} is fired up for this one.',
walkinsLater: 'Walk-ins start next week.',
bringOn: 'Coming',
bringOff: 'Resting',
tutorialFloor: 'Practice day. Season 1 starts at {c} cash.'
```

### X20.13 Levels, PREP, and the payroll budget

- `C.LEVEL_XP` 200 to 120, so a busy card levels about four times a season ([S 6.7]'s "about one star a season" needs four levels). `validateSave` clamps `xp` to `C.LEVEL_XP - 1`. Overrides [S 6.7]'s 200.
- PREP's saved seconds count the knife: each cut adds `MEATS[m].slice * (2 - vals.prepKnife)` (your own slice time, plus what the card's knife is faster or slower than yours), so a 1 star and a 5 star PREP card no longer read the same on the report.
- **The payroll budget stays 60.** The review suggested 50 so that two headliners would not fit together. A scratch econ run at 50 failed X16 check 5 for sharp (wages 353 a season, 7.8 percent of 4525), and X16 moves `PAYROLL` only when nothing else passes. With the built headliners (2.5 or 3 stars) two of them cost 40 to 54, so 50 would bind only for a 3 star FIRE beside a 3 star RUN or PREP card, and it would leave a 5 star FIRE card (58) or a raised 4 star FIRE card (52) unable to work at the backyard at all. The budget binds today once a walk-in or a level lifts a card: a 4 star FIRE walk-in (43) and a 3 star RUN card (24) are 67. Joel playtest watch item.

### X20.14 Not taken this round, and why

- **Taken applicants out of the walk-in and host draws.** The pool is dropped when Hiring Day ends, so this needs a new saved field (save version 5 is "exactly these keys"), and X18.1 item 33 frees a let go card's name for later walk-ins. The crew and pitmaster names are avoided (X20.7).
- **A confirm on every pass.** Only the pass that would leave an empty crew asks (X20.11); the visible PASS word answers the "big arrow reads as Next" finding without a second tap every round.
- **NEW on applicants.** X18.1 item 36 stands: NEW means a card's first season on your crew and shows only on held cards.
- **Overall stars to the quarter.** Not done; the level lines name the change in the cook instead, and `ui.levelStars` names a rise in overall stars.
- **The player idle with a crew.** With RUN and FIRE working, the scripted player idled 55 to 65 percent of an early Birthday. A tuning item for the next step that changes the week ([S 19.6], the Days build); the harness boredom metric still measures a crewless day.
- **`#third-line` on one line** (X19 known gap 2) is unchanged.

### X20.15 Result

`node --check` passes on `sim.js`, `game.js`, `sprites.js`, `dev/smoke.mjs` and `dev/econ.mjs`; no edited file holds U+2014 or U+2013. `node games/pit-sim/dev/smoke.mjs` passes 76 of 76 at 375 by 812 and with `--desktop`, with zero console errors in both runs. Step 67 (printed 22): staged FIRE good seconds 59.5 against 95.05 (1.6 times), RUN plates in 10 s 4 against 8, fed in 4 s 2 against 3, mean wait 3.8 s against 2.0 s, PREP 10.85 s against 4.9 s, the longest empty line 2.95 s; full bookings, 1 star against 5: RUN tips on its plates 62 against 126 (2.03 times), FIRE mean wait 8.76 s against 6.23 s (0.71 times; fed 11 of 11 and 22 of 24 both), PREP mean wait 4.2 s against 2.71 s (0.65 times).

`node games/pit-sim/dev/econ.mjs --season` passes every enforced check at Normal, Short and Long (the new stretch check included), and the day runs pass. Normal, 50 seeds, 5 seasons: drum medians sharp S1W4, steady S1W5, rough S1W6 (bands S1W4, S1W8, S2W9); Driveway affordable (information) S1W7, S2W4, S2W9; stuck, idle, rough under 0 and over budget 0 of 50. Wages, share of pay and tips over seasons 2 to 5: sharp 10.2 percent (461 of 4525 a season), steady 16.2 (467 of 2880), rough 16.1. Median cash at the season ends: sharp 1523, 4180, 6843, 9568, 12265; steady 317, 1259, 2288, 3412, 4454; rough 195, 563, 1075, 1668, 2261. The eager policy (information): never stuck, never under 0, season ends 130 to 151, never owns the drum, wages 41.0 percent of its pay and tips (the X19 watch item stands). Short: drum S1W4, S1W8, S1W8; Long: S1W3, S1W4, S1W5. The Birthday's longest empty line with food cooking stays 2.95 s.
