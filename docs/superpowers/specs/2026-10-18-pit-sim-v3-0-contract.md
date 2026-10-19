# Your Pit v3.0: the season, module contract

**Date:** 2026-10-18, night. **Round:** v3.0 only (the v3.0 row of design section 15, plus section 19.2 the character creator and 19.3 the inventory, as 19.5 orders). Nothing from v3.1 onward.
**Rules:** `docs/superpowers/specs/2026-10-18-pit-sim-v3-season-design.md`, cited here as [S n]. Section [S 19] wins over earlier sections. This file pins names, signatures, numbers and strings so four builders can work at the same time without talking. Where this file and [S] disagree on a name, a signature or a string, this file wins; where they disagree on a rule of play, [S] wins and the builder writes it under Deviations in their file header.
**Builds on:** v2.1 at commit 282f980, contract `docs/superpowers/specs/2026-10-18-pit-sim-contract.md` sections K0 to K14 (v2.1), then D0 to D16 (v2), then sections 0 to 7 (v1). Everything there stands unless a W section below names it.
**Mocks:** `docs/superpowers/mocks/pit-sim-v3/screen-1-season.png`, `screen-3-week.png`, `screen-4-report.png`, `screen-6-creator.png` (and their `.html` sources). The mocks win on look; this file and [S 14] win on words and numbers. Mock content that breaks a rule (12 weeks, "Fans", letter grades, peppers, "60 people", "Lake park", 14 miles) is replaced by the content pinned here.
**Builder questions:** section W22 answers 27 questions the builders raised. Each answer is an Overseer's call. Where W22 and an earlier W section disagree, W22 wins. W22.9 also overrides two [S] rules of play, which is recorded there and in W21.
**Playtest round 1:** section W24 (2026-10-19) records the fixes from the first playtest. Where W24 and an earlier W section disagree, W24 wins.
**Do not edit:** anything in `games/pit-sim/art3/` and `games/pit-sim/dev/look-proof.html` (the v3.4 art track).

---

## W0. Who owns what

| Builder | Owns (may edit) | Writes against | Must not touch |
|---|---|---|---|
| **Art** | `games/pit-sim/sprites.js`, `games/pit-sim/dev/sheet.html` | W16, W15 (the look labels only, for the sheet) | everything else |
| **Sim** | `games/pit-sim/sim.js`, `games/pit-sim/dev/econ.mjs` | W1 to W15, W20 | everything else |
| **Game** | `games/pit-sim/game.js`, `games/pit-sim/index.html` (style block and the `#panels` skeleton of W18; the three script tags, their order, `defer` and the head metas stay as they are) | W1, W4 to W7 (reads), W14 sentences, W15, W16 (calls only), W17, W18 | everything else |
| **Harness** | `games/pit-sim/dev/smoke.mjs` | W19, every public name in this file | everything else |
| Overseer | the three spec docs and this file | | the builders' files |

The harness reads only public names: the `PitSim.*` surface, `sim.state`, DOM ids, the `PitSim.game` hooks. Its Node steps may write a headless sim's state as a test fixture (as K11 step 10 does). Its browser steps write state only through the page's own controls, `localStorage` save fixtures written before a reload, and the sim methods listed in W5; they never assign to `sim.state`. `sim.settle()` is a dev and harness method: `game.js` never calls it (W5, W19 step 5 greps for it).

Every builder runs `node --check` on each script they edited, scans each edited file for U+2014 and U+2013 (none allowed), and keeps zero inline script, `createElement` and `textContent` only (never `innerHTML`), one `localStorage` key `hs.pitsim.save`, no network.

Versions: `C.SAVE_VERSION` 4 (was 3). `PitSim.game.version` `'0.5.0'` (was `'0.4.0'`).

---

## W1. Names

| Name | Meaning |
|---|---|
| `BookingId` | `'birthday' \| 'picnic' \| 'finale' \| 'yard'`. In v3.0 no type repeats in a week, so an offer's `id` equals its `type`. |
| `LoopId` | `'tutorial' \| 'creator' \| 'week' \| 'prep' \| 'cook' \| 'report' \| 'seasonEnd'`, stored in `state.loop` (W4, W6) |
| `LengthId` | `'short' \| 'normal' \| 'long'` (`C.LENGTH_ORDER`) |
| `EventKind` | `'tutorial' \| 'yard' \| 'booking'`, stored in `state.today.kind` |
| `Look` | `{ skin, hair, hairColor, face, hat, apron }`, six integer indexes (W4.3) |
| `Offer` | one card on the phone (W3.3) |
| `Result` | `{ type: BookingId, stars: int }`, one per played season week, `stars` 0 for a Yard day and 1 to 5 for a booking |
| booked guest | a customer with `booked === true`, spawned from a booking's arrival schedule (W7) |
| the rail | the ticket rail: plates booked per meat for a booking, plates sold per meat on a Yard day (W7.4) |

New top level names on `PitSim`, all attached by `sim.js`: `BOOKINGS`, `BOOKING_IDS`, `LOOK_KEYS`, `LOOK_COUNTS`, `DEFAULT_LOOK`, `genOffers`, `scoreEvent`, `cleanName`, `filterName`. Nothing else is added at the top level. `sprites.js` still attaches only `art`; `game.js` only `game`.

`phase` keeps its v2 meaning (`'morning' | 'service' | 'evening'`, the engine phase that gates `buy`, `step` and the till). `loop` is the season screen the player is on. Both are always set; W6 lists every pair.

---

## W2. `PitSim.C` additions and changes

> Amended by W22.18 (Overseer's calls) and W24 (playtest round 1: SAFE_LOAD, COLD_PENALTY, PAY_BASE 0.3, PAY_PER_STAR 0.14).

New keys, read by name, never hard coded by `game.js`, the harness or the econ bot:

```js
// season and week [S 3]
SEASON_WEEKS: 9,
YEAR_MAX: 99,
LENGTHS: Object.freeze({
  short:  Object.freeze({ seconds: 90,  window: 55,  factor: 0.7 }),
  normal: Object.freeze({ seconds: 125, window: 80,  factor: 1.0 }),
  long:   Object.freeze({ seconds: 160, window: 105, factor: 1.3 })
}),
LENGTH_ORDER: Object.freeze(['short', 'normal', 'long']),
BASE_WINDOW: 80,                      // the Normal window every booking window is written in
LAST_CALL_GUARD: 5,                   // last call is never later than the hard end minus this
// fees and pay [S 3.2], [S 3.3], [S 5.4]
FEE_MULT: 1.25, FEE_ROUND: 5,         // fee = round to 5 of headcount x average plate price of the asked meats x 1.25
DEPOSIT_FRAC: 0.3,                    // deposit = Math.round(fee * 0.3), credited at loadUp()
PAY_BASE: 0.5, PAY_PER_STAR: 0.1,     // pay at the end = Math.round(fee * (0.5 + 0.1 * stars)) - deposit
ADDON_SHARE: 0.25,                    // share of the guests who order the add-on meat
MENU_BONUS: 0.1,                      // Math.round(fee * 0.1) when the add-on was served with none burnt
SPARE_FRAC: 0.1,                      // the cart prefill covers booked plates plus 10 percent
BAGS_PER_COOKER: 5,                   // prefill bags per owned cooker, less the bags in the pile
LOW_CASH_BIRTHDAY: 60,                // cash under this at week start: a Birthday is always offered
// offers by fan rating third [S 9]
THIRD_EDGES: Object.freeze([34, 67]), // rep >= 34 is the middle third, rep >= 67 the top third
OFFER_SLOTS: Object.freeze([2, 3, 3]),// booking slots per third, before the dedupe by type
INVITE_THIRD: 2,                      // the top third adds one invite
// client stars [S 5.4], [S 9]
SCORE_FED: 60, SCORE_WAIT: 20, SCORE_QUALITY: 20,
WAIT_FULL_S: 20, WAIT_ZERO_S: 60,     // average wait at or under 20 s scores full, at 60 s zero; an unfed booked guest counts 60 s
BURNT_PENALTY: 4, OFFMENU_PENALTY: 2,
STAR_EDGES: Object.freeze([40, 60, 75, 90]),   // score >= 90 is 5 stars, >= 75 is 4, >= 60 is 3, >= 40 is 2, else 1
STAR_FANS: Object.freeze([-5, -2, 2, 4, 6]),   // word of mouth change for 1 to 5 stars
// booked arrivals [S 3.3]
ARRIVAL_CURVE: 1.3, ARRIVAL_SPAN: 0.9,         // party k of P arrives at gateAt + 0.9 * window * ((k + 0.5) / P) ^ 1.3
PARTY_MIN: 1, PARTY_MAX: 4, PARTY_GAP_S: 0.6,  // party size 1 to 4; members arrive 0.6 s apart
// inventory [S 19.3]
COOLER_CAP: Object.freeze([0, 12, 24, 40]),    // overnight units by cooler level; v3.0 level = gear.cooler ? 1 : 0
CHARCOAL_MAX: 200, WOOD_MAX: 100,
// names [S 19.2]
NAME_MAX: 14,
NAME_PUNCT: " '.-",                   // allowed besides ASCII A to Z, a to z and 0 to 9
// season end [S 3.6]
SEASON_CARRY_REP: 0.75, SEASON_REP_FLOOR: 20,
// the driveway goal [S 7.1]
DRIVEWAY_REP: 34
```

Changed values: `SAVE_VERSION: 4` (was 3); `DRIVEWAY_PRICE: 400` (was 1000). Every other key keeps its v2.1 value, including `GATE_OPENS: 30`, `LAST_CALL: 110`, `DAY_SECONDS: 125` (the tutorial day still runs on these three, W7.1), `STEPPER_MAX: 99` (still the cap per meat line), `START_CASH: 80`, `START_REP: 20`. `C.FX` is unchanged.

Every number above except `SAVE_VERSION`, `SEASON_WEEKS`, `NAME_MAX`, `NAME_PUNCT`, `COOLER_CAP[0]` and the `LENGTHS` table is a starting value the econ bot may move inside the [S 10.3] bands (W20); a builder who moves one records the old and new value under Deviations, and the harness reads every one of them through `C`, never as a literal.

---

## W3. Bookings and the offer generator

### W3.1 `PitSim.BOOKINGS` and `PitSim.BOOKING_IDS`

`BOOKING_IDS = Object.freeze(['birthday', 'picnic', 'finale', 'yard'])`. `BOOKINGS` is a frozen object of frozen rows:

| id | label (`STRINGS.booking[id]`) | guests | menu | patience | window | flames | venue | icon | offered |
|---|---|---|---|---|---|---|---|---|---|
| `birthday` | Birthday | 12 | `['sausage', 'chicken']` | 45 | 80 | 1 | `'backyard'` | `ev_birthday` | weeks 1 to 8 |
| `picnic` | Church picnic | 20 | `['chicken', 'butt']` | 50 | 80 | 2 | `'backyard'` | `ev_picnic` | weeks 1 to 8 |
| `finale` | Season finale | 40 | `null` (W3.2) | 50 | 80 | 3 | `'backyard'` | `ev_finale` | week 9 only |
| `yard` | Yard day | 0 | `[]` | `C.PATIENCE_BASE` | 80 | 1 | `'backyard'` | `ev_yard` | weeks 1 to 8 |

Row shape: `{ id, label, guests, menu, patience, window, flames, venue, icon, unlock }` where `unlock` is `null` for all four (v3.0 has no gated type; the field exists so v3.3 adds types without a shape change, and `genOffers` honors `{ rep: int }` and `{ gear: GearId }` when present). Menus are in `MEAT_IDS` order. Every booking plays in the backyard in v3.0 ([S 3.3]: until a venue is built); `venue` is the place it plays, so it reads `'backyard'` for all four and the card says Backyard.

### W3.2 Derived numbers (pure, used by `genOffers` and the sim)

> Amended by W24.1 P-1 (a booking is a stretch when its rail needs more grate time than the owned cookers give).

- **Headcount** at length `L`: `Math.round(row.guests * C.LENGTHS[L].factor)`. Birthday 8, 12, 16; Church picnic 14, 20, 26; Season finale 28, 40, 52 (short, normal, long).
- **Window** at length `L`: `row.window * C.LENGTHS[L].window / C.BASE_WINDOW` (55, 80, 105 for every v3.0 row).
- **Finale menu:** every meat the owned gear can cook, in `MEAT_IDS` order: the four non-brisket meats, plus `brisket` when `gear.drum`. [S 15] v3.0 row.
- **Fee:** `Math.round(headcount * avg * C.FEE_MULT / C.FEE_ROUND) * C.FEE_ROUND`, where `avg` is the mean of `MEATS[m].price` over the menu. Normal length: Birthday 100, Church picnic 275, Season finale 475 without the drum and 560 with it. Short: 65, 195, 335 or 390. Long: 130, 360, 620 or 730. The Yard day fee is 0.
- **Deposit:** `Math.round(fee * C.DEPOSIT_FRAC)`: 30, 83, 143 or 168 at Normal.
- **Rail split** (`railFor(offer, addon)`, W5): with no add-on, the headcount split evenly over the menu, the first `headcount % menu.length` meats in menu order getting one more. With an add-on (a cookable meat not on the menu), `a = Math.round(C.ADDON_SHARE * headcount)` plates go to the add-on and `headcount - a` are split over the menu the same way. Birthday 6 and 6, or with ribs as the add-on 3 ribs, 5 sausage and 4 chicken. Church picnic 10 and 10, or with ribs 5 ribs, 8 chicken and 7 pork butt. Season finale 10 each of four, or 8 each of five.
- **Safe:** every menu meat is cookable with the owned gear (brisket needs `gear.drum`) and `unlock` is met. In v3.0 every offer is safe (the finale menu adapts), so `needs` is always `''`; the field and the disabled Load up and go path exist for v3.3.

### W3.3 The `Offer` object

> Amended by W22.13 (Overseer's calls).

```ts
Offer = {
  id: BookingId,                       // equals type in v3.0
  type: BookingId,
  label: string,                       // STRINGS.booking[type]
  venue: 'backyard',
  host: string | null,                 // a STRINGS.names entry; null for the Yard day
  headcount: int,                      // W3.2; 0 for the Yard day
  menu: MeatId[],                      // MEAT_IDS order; [] for the Yard day
  rail: { [m in MeatId]: int },        // railFor(offer, null): plates booked per meat, all five keys, zeros off the menu
  pay: int,                            // the fee, paid in full at 5 stars; 0 for the Yard day
  deposit: int,                        // W3.2; 0 for the Yard day
  difficulty: 1 | 2 | 3,               // the row's flames
  window: float,                       // W3.2 at the length in effect
  patience: float,                     // the row's patience
  safe: boolean,
  needs: string                        // '' when safe, else the Needs line text
};
```

Offers are plain frozen objects. The sim never mutates one; a length change replaces them (W5 `setLength`).

### W3.4 `PitSim.genOffers(input)`

> Amended by W22.11, W22.13 (Overseer's calls).

Pure and deterministic. `input = { seed: uint32, year: int, week: int, rep: int, cash: int, gear: { [g in GearId]: boolean }, length: LengthId, types?: Row[] }`. `types` defaults to the rows of `BOOKINGS` with `id !== 'finale' && id !== 'yard'`; the harness passes a stub list of extra rows to test slots, dedupe and the invite (W19 step 12). Returns `Offer[]` in display order. The generator's only randomness is `r = mulberry32(mix32(seed, year, week))` with

```js
function mix32(a, b, c) {
  let h = (a >>> 0) ^ Math.imul(b | 0, 0x9E3779B1) ^ Math.imul(c | 0, 0x85EBCA77);
  h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D); h ^= h >>> 15; h = Math.imul(h, 0x846CA68B); h ^= h >>> 16;
  return h >>> 0;
}
```

Steps, in order:

1. **Week 9:** return exactly one offer, the Season finale, with its host drawn as in step 7. No Yard day in week 9 ([S 3.5]: the finale is never missed).
2. `third = rep >= C.THIRD_EDGES[1] ? 2 : rep >= C.THIRD_EDGES[0] ? 1 : 0`; `slots = C.OFFER_SLOTS[third]`; `invite = third === C.INVITE_THIRD`.
3. `unlocked` = the `types` whose `unlock` is met (`rep >= unlock.rep`, `gear[unlock.gear] === true`).
4. `picked = []`. If `cash < C.LOW_CASH_BIRTHDAY` and `birthday` is unlocked, push it first.
5. Shuffle the rest of `unlocked` with Fisher Yates from the last index down, one `r()` draw per swap (`j = Math.floor(r() * (i + 1))`), then append in that order while `picked.length < slots`. No type twice. If no picked offer is safe and some unlocked type is safe, replace the last picked with the lowest fee safe type.
6. If `invite`: append the highest fee unlocked type that is safe and not yet picked, if any.
7. Display order: safe offers by `difficulty` ascending, then `pay` ascending, then stretch offers the same way; then the Yard day. Hosts: one `r()` draw per booking offer in display order, `STRINGS.names[Math.floor(r() * names.length)]`, stepping forward by one (wrapping) past a name already used this week.
8. Build each `Offer` per W3.2 and W3.3 with `input.length`.

In v3.0 the default `types` are Birthday and Church picnic, so every week 1 to 8 shows exactly `['birthday', 'picnic', 'yard']` in that order (Birthday first: 1 flame), in every third. The third slot and the invite stay empty until v3.3 adds types; the slots, dedupe and invite rules are still built and are tested with the stub list. The first offer is preselected (W5 `startWeek`).

---

## W4. State

### W4.1 Additions to `sim.state`

> Amended by W22.1 (Overseer's calls).

```ts
state.loop: LoopId;
state.season: {
  year: int,                     // 1 to C.YEAR_MAX
  week: int,                     // 1 to 9, the week on the phone or being played
  seed: uint32,                  // the save's offer seed (W13)
  weekCash: int,                 // cash when this week opened, the cash input of genOffers
  offers: Offer[],               // this week's cards; [] after loadUp() and outside 'week'
  booking: Offer | null,         // the picked offer; kept through prep, cook and report; null in 'tutorial', 'creator', 'seasonEnd'
  addon: MeatId | null,          // the add-on meat for the picked booking; null on a Yard day
  results: Result[]              // one per played week this season, length 0 to 9
};
state.player: null | { name: string, look: Look };   // null until the creator has been finished once
state.pitName: string;           // default STRINGS.defaultPit 'Your Pit'
state.settings: { length: LengthId };
state.wood: int;                 // 0 to C.WOOD_MAX; nothing in v3.0 adds or burns wood, so it stays 0
Customer: v2 Customer & { booked: boolean };
```

`state.charcoal` now clamps 0 to `C.CHARCOAL_MAX` (was 99). `state.day` keeps counting events played plus one (the tutorial day is day 1, season 1 week 1 is day 2); it still drives `RAIN_FROM_DAY` and the K6 tutorial rule.

### W4.2 `Today` and `Till` additions

> Amended by W24.1 P-2, P-3, P-6 (`cold`, `rawWaste`, `soldOutMiss`; a booking's net takes off what the cook used).

```ts
Today: v2.1 Today & {
  kind: EventKind,
  gateAt: float, lastCallAt: float, endAt: float,   // W7.1
  booking: Offer | null,                            // a copy of season.booking for a booking, else null
  addon: MeatId | null,
  rail: { [m in MeatId]: int },                     // booking: railFor(booking, addon); yard and tutorial: all 0
  sold: { [m in MeatId]: int },                     // plates served per meat, every kind
  booked: int,                                      // headcount; 0 for yard and tutorial
  pending: int,                                     // booked guests not yet spawned
  fed: int,                                         // booked guests served
  missed: int,                                      // booked guests who never got into the line (W7.3)
  waitSum: float,                                   // sum of c.wait over served booked guests, at serve time
  offMenu: int,                                     // plates of a meat not on the rail served to a booked guest (a guard; W7.2 makes it 0)
  addonServed: int, addonBurnt: int,
  deposit: int                                      // credited at loadUp
};
Till: v2.1 Till & {
  kind: EventKind, label: string, host: string | null, year: int, week: int,
  booked: int, fed: int, missed: int, avgWait: int,  // avgWait rounded to whole seconds, W8
  score: int, parts: { fed: int, wait: int, quality: int }, stars: int,   // 0 when not a booking
  fee: int, deposit: int, payRest: int, menuBonus: int,
  repReason: 'stars' | 'serves',                    // 'stars' for a booking, 'serves' for yard and tutorial
  coolerCap: int, coolerAfter: { [m in MeatId]: int }, charcoalAfter: int,
  spoilReason: 'none' | 'nocooler' | 'full'
};
```

`Till.net` for a booking is `deposit + payRest + menuBonus + tips + seatTips - wages - DAILY_COSTS`; for yard and tutorial it stays the v2 formula. Revenue for a booking is 0 (booked guests pay nothing per plate, [S 5.4]); the fee rows carry the money.

### W4.3 Looks: `PitSim.LOOK_KEYS`, `LOOK_COUNTS`, `DEFAULT_LOOK`

```js
LOOK_KEYS: Object.freeze(['skin', 'hair', 'hairColor', 'face', 'hat', 'apron']),
LOOK_COUNTS: Object.freeze({ skin: 6, hair: 6, hairColor: 6, face: 4, hat: 4, apron: 6 }),
DEFAULT_LOOK: Object.freeze({ skin: 1, hair: 0, hairColor: 1, face: 0, hat: 1, apron: 0 })
```

Index meanings (labels in W15 `STRINGS.look`): hair 0 short, 1 curly, 2 long, 3 buzz, 4 bun, 5 bald; face 0 none, 1 mustache, 2 beard, 3 glasses; hat 0 none, 1 cap, 2 cowboy hat, 3 bandana; skin, hair color and apron are the six swatches of W16.4 in mock order. The default is the v2 pitmaster (light skin, short dark hair, orange cap) with the red apron, the creator's first apron swatch ([S 19.2]: the v2 cream apron is not a swatch). A look is valid when every key holds an integer in `0 .. LOOK_COUNTS[key] - 1`; `setPlayer` and `validateSave` replace anything else by the default for that key.

### W4.4 Names: `PitSim.cleanName(str, fallback)` and `PitSim.filterName(str)`

Pure, never throw (any input, including `undefined`, numbers and objects, is read through `String()` in a try).

- `filterName(str)`: replace U+2018 and U+2019 with `'`; drop every character that is not ASCII `A` to `Z`, `a` to `z`, `0` to `9` or one of `C.NAME_PUNCT`; collapse runs of spaces to one; cut to `C.NAME_MAX` characters. No trim. `game.js` applies it on every `input` event so a typed trailing space survives.
- `cleanName(str, fallback)`: `filterName`, then trim, then cut to 14 again, then trim; empty gives `fallback`. `setPlayer` and `validateSave` use it with `STRINGS.defaultName` (`'Pitmaster'`) and `STRINGS.defaultPit` (`'Your Pit'`).

Examples the harness checks: `cleanName('  Ana<b>!  Q  ', 'X') === 'Anab Q'`; `cleanName('Marty’s Pit', 'X') === "Marty's Pit"`; `cleanName('ABCDEFGHIJKLMNOPQRST', 'X') === 'ABCDEFGHIJKLMN'`; `cleanName('', 'Your Pit') === 'Your Pit'`; `cleanName('\u{1F600}', 'Pitmaster') === 'Pitmaster'`; `filterName('Bo  b ') === 'Bo b '`. No profanity filter ([S 19.2] Overseer's call).

---

## W5. Sim methods

All are own properties of the sim object (destructuring works) and return fresh objects. "Week only" means `state.loop === 'week' && state.phase === 'morning'`; outside that they return `{ ok: false, message: '' }` (or `false`/`null` as the row says) and change nothing.

### W5.1 New

> Amended by W22.1, W22.2, W22.3, W22.4 (Overseer's calls).

| Method | Returns | Semantics |
|---|---|---|
| `bookOffer(id: BookingId)` | `{ ok, message }` | Week only, `id` among `season.offers`. Sets `season.booking` to that offer, `season.addon = null`, replaces the cart with `prefill()` (W10.3), emits `booking_picked { id, type }` and `save_wanted { reason: 'book' }`. Picking the booked offer again is `ok: true` and re-prefills. Legal for a stretch offer (Load up and go then explains why it is disabled). |
| `setAddon(meat: MeatId \| null)` | `{ ok, message }` | Week only, a booking picked (not the Yard day). `null` always ok. A meat is ok when it is not on the booking's menu and the gear cooks it (brisket needs the drum); else `ok: false`, message `STRINGS.ui.addonNo`. Sets `season.addon`, replaces the cart with `prefill()`, emits `save_wanted { reason: 'addon' }`. |
| `railFor(offer: Offer, addon: MeatId \| null)` | `{ [m in MeatId]: int }` | W3.2 split. All five keys. For the Yard day all zeros. |
| `canLoadUp()` | `{ ok, reason }` | Week only, else `{ ok: false, reason: '' }`. Checks in this order: no booking picked: `STRINGS.ui.goPick`; `!booking.safe`: `booking.needs`; `charcoal + cart.charcoal === 0`: `'Buy at least one bag of charcoal.'`; no unit of a rail meat in stock plus cart (a booking) or of any meat (the Yard day): `'Buy at least one unit of meat.'`; `cartTotal() > cash + booking.deposit`: `STRINGS.ui.goCash`. Else `{ ok: true, reason: '' }`. |
| `loadUp()` | `{ ok, message }` | Week only and `canLoadUp().ok`. In order: `cash += booking.deposit` (`today.deposit`), then v2 `openGate()`'s cart commit and service setup, with these changes: `today.kind` is `'booking'` or `'yard'`; timings per W7.1; for a booking `today.booking`, `today.addon`, `today.rail = railFor(booking, addon)`, `today.booked = today.pending = headcount`, the arrival schedule per W7.2 (party draws from `sim.rng()` happen here, before any spawn draw), `spawnAt = Infinity` (booked arrivals do not use `spawnAt`); for the Yard day v2 arrivals with `spawnAt = gateAt`; `season.offers = []`; `selected` = the quickest rail meat in stock (the Yard day: v2 rule); `state.loop = 'prep'`. Emits `deposit { amount }` (only when amount > 0), `save_wanted { reason: 'open' }`, then `yard_open { kind }`. |
| `finishReport()` | `undefined` | Evening only. From loop `'tutorial'`: `beginMorning()` (the v2 morning roll), then loop `'creator'` when `player === null`, else `startWeek()`. From loop `'report'`: when `results.length < 9`, `season.week += 1`, `beginMorning()`, `startWeek()`, emit `week_start { year, week }`; when `results.length === 9`, `state.loop = 'seasonEnd'`, `state.phase = 'morning'` with no morning roll (no `rng()` draw), emit `season_end { year, stars }` (`stars` the nine result stars in week order). `continueFromTill()` is kept as an alias that calls `finishReport()`. |
| `startSeason()` | `boolean` | Loop `'seasonEnd'` only, else `false`. Applies W11 carry-overs, `season.year = min(YEAR_MAX, year + 1)`, `week = 1`, `results = []`, `beginMorning()`, `startWeek()`, emits `season_start { year }`, `week_start { year, week: 1 }`, `save_wanted { reason: 'season' }`; returns `true`. |
| `seasonEndPreview()` | `null \| { year, stars: int[], cash, repFrom, repTo, spoiled: { [m]: int }, charcoal }` | Loop `'seasonEnd'` only: what `startSeason()` will apply (W11), computed without changing state. |
| `setPlayer(look, name, pitName)` | `{ ok: true, look, name, pitName }` | Legal in any loop and phase (the creator also opens from the pause panel). Validates `look` per W4.3, cleans both names per W4.4, sets `state.player = { name, look }` and `state.pitName`. From loop `'creator'` it then runs `startWeek()` and sets the loop to `'week'`. Emits `player_set { name, pitName }`, then (from the creator) `week_start { year, week }`, then `save_wanted { reason: 'player' }`. Returns the cleaned values. |
| `randomLook()` | `Look` | A random valid look from a generator separate from `sim.rng()`: `mulberry32((seed ^ 0x4C4F4F4B) >>> 0)` created once per sim, six draws per call in `LOOK_KEYS` order (`Math.floor(r() * count)`). Changes no state, so tapping Random never moves the game's own random stream. |
| `look()` | `Look` | `player ? player.look : DEFAULT_LOOK`, a fresh copy. |
| `setLength(len: LengthId)` | `{ ok, message }` | Morning in loop `'week'` or `'tutorial'` only. Sets `settings.length`. In `'week'`: regenerates `season.offers` with `genOffers` (same seed, year, week, `weekCash`), keeps the pick by id (falls back to the first offer), keeps the add-on when still legal, replaces the cart with `prefill()`, emits `offers_ready`, then `save_wanted { reason: 'settings' }`. The tutorial day itself always runs at Normal (W7.1). |
| `fanThird()` | `0 \| 1 \| 2` | W3.4 step 2 on `state.rep`. |
| `offerSlots()` | `{ slots: int, invite: boolean }` | W3.4 step 2. |
| `coolerCap()` | `int` | `C.COOLER_CAP[gear.cooler ? 1 : 0]`. |
| `inventory()` | `{ charcoal, wood, meat: { [m]: int }, units, cap, over }` | `units` = stock total, `cap = coolerCap()`, `over = max(0, units - cap)`. |
| `meatRoom()` | `int` | W10.2: units the shop still allows across all meats, never negative. |
| `prefill()` | `{ meat: { [m]: int }, charcoal: int }` | W10.3, computed without changing state. `bookOffer`, `setAddon`, `setLength` and `startWeek` copy it into the cart. |
| `settle(stars: 1..5)` | `boolean` | **Dev and harness only.** Service, `today.kind === 'booking'`, not paused; else `false`. Ends the booking at once with a forced result (W8.4) through the normal end of event, events included. `game.js` never calls it. |

`startWeek()` is internal: `season.weekCash = cash`; `season.offers = genOffers({ seed, year, week, rep, cash, gear, length })`; `season.booking = offers[0]`, `season.addon = null`; cart = `prefill()`; `state.loop = 'week'`; emits `offers_ready { year, week, ids }`.

### W5.2 Changed

> Amended by W22.1, W22.11, W22.12, W22.17, W22.23 (Overseer's calls).

- `openGate()`: legal only in loop `'tutorial'` (morning, as v2.1). Everywhere else it returns `{ ok: false, message: '' }`; the week uses `loadUp()`.
- `buy(id, qty)`: legal in the morning in loops `'tutorial'` and `'week'` only. Meat and charcoal lines may spend up to `cash + (loop === 'week' && booking ? booking.deposit : 0) - cartTotal of the other lines`. Charcoal lines cap at `C.CHARCOAL_MAX - charcoal`; meat lines keep the per line cap (`STEPPER_MAX - stock[m]`) and also stop at `meatRoom()` for increases (W10.2); a refused increase returns `ok: false` with `message` `STRINGS.ui.coolerFull` filled (W15). Gear and decor still need `cash - cartTotal() >= price` (the deposit is not cash yet). `'driveway'` refuses with `'Not built yet.'`.
- `hire(id)`: morning in loops `'tutorial'` and `'week'`. Unchanged otherwise (wages still paid per event worked at the till, [S 6.10]).
- `skipTutorial()`: in the morning it now also sets `state.loop = 'creator'` (when `player === null`; else `startWeek()`), before its `save_wanted { reason: 'tutorial' }`. In service it stays on the tutorial day, which plays out as a Yard day with v2.1 timings; its till leads to the creator through `finishReport()`.
- `reset()`: a new game. `state.player = null`, `pitName = 'Your Pit'`, `settings.length = 'normal'`, `wood = 0`, `season = { year: 1, week: 1, seed: (Math.floor(rng() * 4294967296)) >>> 0, weekCash: START_CASH, offers: [], booking: null, addon: null, results: [] }`, loop `'tutorial'`, then the v2.1 order of events.
- `createSim(saved, seed)`: builds the loop from the save (W13.3). A new game (`saved === null`) seeds `season.seed = (seed ^ 0x5EA5011D) >>> 0` without drawing from `rng()`, so the v2.1 morning roll and the tutorial's draws stay where the K11 steps expect them.
- `expectedCrowd()`: uses `C.LENGTHS[settings.length].window` instead of `LAST_CALL - GATE_OPENS` (v2.1 values on the tutorial day).
- `goal()`: unchanged order (`kettle2`, `buddy`, `bigtable`, `drum`, `driveway`); the driveway row is 400 and also names word of mouth 34 (W10.5).
- `serialize()`: W13.2.
- `verbAt()`, `interact()`, `walkTo()`, `move()`, `step()`, `tick()`: unchanged semantics; `interact()` and `tick()` run the tutorial checks of W12 as before.

---

## W6. The week loop: every transition

> Amended by W22.2, W22.4, W22.10 (Overseer's calls).

| From (loop, phase) | Cause | To (loop, phase) | Notes |
|---|---|---|---|
| none | `createSim(null)`, `reset()` | `tutorial`, morning | the v2.1 clipboard, `#open` |
| `tutorial`, morning | `openGate()` | `tutorial`, service | v2.1 tutorial day, Normal timings |
| `tutorial`, morning | `skipTutorial()` | `creator`, morning | [S 19.2]: skipping goes straight to the creator |
| `tutorial`, service | `skipTutorial()` | `tutorial`, service | plays on as a Yard day |
| `tutorial`, service | the end of the day | `tutorial`, evening | the v2.1 till (`Day 1 till`) |
| `tutorial`, evening | `finishReport()` | `creator`, morning | `week` if a player already exists |
| `creator`, morning | `setPlayer(...)` | `week`, morning | `startWeek()` for season 1 week 1 |
| `week`, morning | `bookOffer`, `setAddon`, `setLength`, `buy`, `hire` | `week`, morning | |
| `week`, morning | `loadUp()` | `prep`, service | deposit in, cart charged |
| `prep`, service | clock reaches `today.gateAt` (in the tick that emits `gate_open`) | `cook`, service | |
| `prep` or `cook`, service | the end of event (W7.3) or `settle()` | `report`, evening | till built, results pushed |
| `report`, evening | `finishReport()`, `results.length < 9` | `week`, morning | `week + 1`, new offers |
| `report`, evening | `finishReport()`, `results.length === 9` | `seasonEnd`, morning | no morning roll |
| `seasonEnd`, morning | `startSeason()` | `week`, morning | W11 carry-overs, year + 1 |

The Broke card of v2 can still open over the week (it is a morning state): in loop `'week'` the Broke test adds the largest deposit on offer to cash, so with a Birthday on the phone it never fires. Pause (`setPaused`) is legal in service only, as v2. The creator reopened from the pause panel does not change `loop`.

---

## W7. The cook

### W7.1 Timings

At `loadUp()`, with `L = C.LENGTHS[settings.length]`:

- `today.gateAt = C.GATE_OPENS` (30; DRIVE seconds join in v3.5).
- booking: `today.lastCallAt = min(gateAt + booking.window, L.seconds - C.LAST_CALL_GUARD)`; Yard day: `min(gateAt + L.window, L.seconds - C.LAST_CALL_GUARD)`.
- `today.endAt = L.seconds`.

The tutorial day (`openGate()`) sets `gateAt = C.GATE_OPENS`, `lastCallAt = C.LAST_CALL`, `endAt = C.DAY_SECONDS` whatever the setting, so every v2.1 rule and K11 number holds. Every v2 use of `C.GATE_OPENS - 10`, `C.LAST_CALL` and `C.DAY_SECONDS` in the tick reads `today.gateAt - 10`, `today.lastCallAt` and `today.endAt` instead (the tutorial's own clock hold keeps `C.GATE_OPENS`, which is equal there). `gate_soon`, `gate_open` and `last_call` fire at those times. `game.js` draws the clock box, GATE OPENS IN and the open gate from these three fields.

### W7.2 Booked arrivals and orders

> Amended by W22.6 (Overseer's calls).

Schedule, built in `loadUp()` from `sim.rng()`: party sizes `PARTY_MIN + Math.floor(rng() * (PARTY_MAX - PARTY_MIN + 1))`, each capped at the guests still unassigned, until the headcount is covered (`P` parties). Party `k` (0 based) arrives at `gateAt + C.ARRIVAL_SPAN * window * ((k + 0.5) / P) ^ C.ARRIVAL_CURVE`; member `j` of it `j * C.PARTY_GAP_S` later. The schedule is internal to the sim (never saved, never on `state`); `today.pending` counts what is left of it.

Spawn, in tick stage 6, while `today.kind === 'booking'`: every scheduled guest whose time has come spawns, one by one in schedule order, as long as the line has a free spot (`queueSpotCount()` minus customers with `queueIndex >= 0`). A guest who finds the line full is not turned away: they stay first in the schedule and spawn on the first later tick with a free spot. A booked guest never walks past. Per spawn, `rng()` draws in this order: patience, order branch, order weight (no jitter draw). Patience is `offer.patience + (r * 2 - 1) * C.PATIENCE_SPREAD`. The spawned customer has `booked: true`, `today.pending -= 1`, `today.customers += 1`, and emits `customer_arrived { id, meat }` as v2.

Orders follow the rail. `tickets` (internal) start equal to `today.rail`. A booked guest's order is v2's order roll (table first, then cooking, then stock, then hands) with every weight of a meat whose ticket count is 0 set to 0; when every weight is 0, the meat with the most tickets left (ties in `MEAT_IDS` order). Its ticket count drops by one. Guests therefore only order rail meats, and the split is exact ([S 3.3]: the add-on counts as on the menu).

Serve: a booked guest pays no plate price. `tip` is v2's formula on `MEATS[want].price`; `cash += tip`; `today.revenue` unchanged; `today.tips += tip`; `today.fed += 1`; `today.waitSum += c.wait`; `today.sold[want] += 1`; `today.addonServed += 1` when `want === today.addon`; `today.offMenu += 1` when `today.rail[want] === 0`; `served` carries `price: 0, booked: true`. Seats, seat tips, the heart and to go work as v2. The per serve word of mouth counters (`happy`, `ok`, `togoQuick`) are not counted for booked guests. A Yard day serve is v2's with `today.sold[want] += 1` and `booked: false` on `served`.

Walk outs work as v2 (patience), and still emit `walk_out`. A burnt piece of the add-on adds `today.addonBurnt += 1` when it enters `burnt`.

### W7.3 When a booking ends

> Amended by W22.7, W22.8 (Overseer's calls).

- At `lastCallAt` (the `last_call` tick) every guest still pending gives up: `today.missed += today.pending`, `today.pending = 0`, emit `guests_missed { n }` when n > 0.
- v2's sold out rule still applies (nothing left to sell anywhere): it closes out the line as v2 and also turns every pending guest into `missed` with the same event.
- The event ends early on the first tick where `clock >= gateAt`, `today.pending === 0` and no customer is `arriving`, `waiting`, `toSeat` or `eating`. Otherwise it ends at `today.endAt` by v2's hard end (close out the line, pay unpaid seat tips, stand everyone up).
- A Yard day ends by v2's rules on the W7.1 times. The tutorial day is v2.1, untouched.

At the end of a booking the sim scores it (W8), pays it, moves word of mouth (W9), handles spoilage (W10.4), pushes `{ type, stars }` onto `season.results` (Yard day: `stars: 0`), builds the till with the W4.2 fields, sets loop `'report'` and phase `'evening'`, and emits in this order: `client_stars` (bookings only), `spoiled` (only when something spoiled), `day_over`, `save_wanted { reason: 'till' }`. The tutorial day pushes no result.

### W7.4 The rail (drawn by `game.js`)

[S 5.2]. During service on a booking, from the first frame of prep, a rail sits across the top of the canvas in pass 8 in place of v2's clock box: an umber box from (1, 1), 11 px tall, as wide as its content plus 4 (at most 174), holding the clock (whole seconds left, `ceil(endAt - clock)`, cream) and then, for each rail meat with a non zero target in `MEAT_IDS` order, a 2 px gap, `icon_{meat}` at y 2, and the plates still to serve (`rail[m] - sold[m]`, never under 0) in the pixel font, yellow while above 0 and `lawnA` at 0 (`art.textTinted`). On a Yard day the rail holds the clock and, for each meat with `sold[m] > 0`, its icon and `sold[m]` in white. On the tutorial day nothing changes: the tutorial banner replaces the rail while it shows (K10), and after it the v2 clock box shows. GATE OPENS IN and LAST CALL at (2, 183) stay. `PitSim.game.rail` (W17.5) reports what was drawn.

---

## W8. Client stars and the fee

### W8.1 `PitSim.scoreEvent(input)`

> Amended by W22.9 (Overseer's calls) and W24.1 P-2 (quality by the share fed, cold plates).

Pure. `input = { booked, fed, waitSum, burnt, offMenu }` (ints, `waitSum` a float). Returns `{ score: int, stars: int, parts: { fed: int, wait: int, quality: int }, avgWait: int }`:

```
unfed    = max(0, booked - fed)
avgWait  = booked > 0 ? (waitSum + C.WAIT_ZERO_S * unfed) / booked : C.WAIT_ZERO_S
fedPts   = booked > 0 ? C.SCORE_FED * fed / booked : 0
waitPts  = C.SCORE_WAIT * clamp((C.WAIT_ZERO_S - avgWait) / (C.WAIT_ZERO_S - C.WAIT_FULL_S), 0, 1)
qualPts  = max(0, C.SCORE_QUALITY - C.BURNT_PENALTY * burnt - C.OFFMENU_PENALTY * offMenu)
score    = Math.round(fedPts + waitPts + qualPts)
stars    = score >= E[3] ? 5 : score >= E[2] ? 4 : score >= E[1] ? 3 : score >= E[0] ? 2 : 1   (E = C.STAR_EDGES)
parts    = { fed: Math.round(fedPts), wait: Math.round(waitPts), quality: qualPts }
avgWait  is returned as Math.round(avgWait)
```

`burnt` is `today.burnt` (every piece that burnt during the event, served or thrown out or left on the grate, [S 5.4]). The sim calls it with `{ booked: today.booked, fed: today.fed, waitSum: today.waitSum, burnt: today.burnt, offMenu: today.offMenu }`.

Table the harness checks (W19 step 13): all fed, waitSum 15 per guest, nothing burnt: 100 and 5 stars; nobody fed: wait 0, quality 20, score 20, 1 star; 12 booked, 12 fed, average wait 40, 1 burnt: 60 + 10 + 16 = 86, 4 stars; 20 booked, 15 fed, waits 30 each, 0 burnt: 45 + 20 * (60 - 37.5) / 40 = 11.25, so 45 + 11.25 + 20 = 76, 4 stars; 20 booked, 12 fed, waits 45 each, 2 burnt: 36 + 20 * (60 - 51) / 40 = 4.5, 36 + 4.5 + 12 = 52.5, rounds to 53, 2 stars.

### W8.2 Pay

> Amended by W22.7, W22.9 (Overseer's calls) and W24.1 P-2 (1 star pays 44 percent, 3 stars 72, 5 stars 100).

At the end of a booking: `payRest = Math.round(fee * (C.PAY_BASE + C.PAY_PER_STAR * stars)) - deposit` (never under 0); `menuBonus = (addon !== null && addonServed >= 1 && addonBurnt === 0) ? Math.round(fee * C.MENU_BONUS) : 0`; `cash += payRest + menuBonus` before wages and daily costs come off (v2 order). One star pays 60 percent of the fee in all, three pays 80, five pays 100.

### W8.3 The Yard day and the tutorial

Not starred: `stars 0`, `score 0`, parts zero, v2 per plate revenue, v2 till rows.

### W8.4 `settle(stars)` (dev and harness)

> Amended by W22.27 (Overseer's calls).

Ends the current booking at once as if it had scored `stars`, for the econ bot (W20) and the harness fast path (W19 step 16):

1. `fed = stars >= 3 ? booked : Math.round(booked * (stars === 2 ? 0.6 : 0.3))`; `today.fed = fed`; `today.pending = 0`; `today.missed = booked - fed`.
2. Stock is eaten: for each rail meat, `plates = Math.round(fed * rail[m] / booked)`, `units = min(stock[m], ceil(plates / MEATS[m].plates))`, `stock[m] -= units`, `today.foodCost += units * MEATS[m].unit`, `today.sold[m] = plates`.
3. Fuel: `bags = min(charcoal, C.BAGS_PER_COOKER * ownedCookers)`, `charcoal -= bags`, `today.bags += bags`.
4. Tips: `tip = Math.round(avgPrice * C.TIP_RATE * [0, 0.2, 0.4, 0.6, 0.8][stars - 1])` per fed guest (`avgPrice` the mean plate price of the rail meats weighted by `rail`), `today.tips = fed * tip`, `cash += today.tips`. No seat tips, nothing burnt.
5. Customers, grates, board and table are cleared (no waste, nothing left on the grate).
6. The end of event of W7.3 runs with the score and stars forced: `stars` as given, `score = [20, 40, 60, 75, 90][stars - 1]`, `parts = { fed: Math.round(60 * fed / booked), wait: 0, quality: 20 }`, `avgWait` 0. Pay, word of mouth, spoilage, results and events follow as for a played event.

---

## W9. Fan rating

The v2 word of mouth number `state.rep`, still labeled "Word of mouth" everywhere ([S 9]). After a booking: `repDelta = clamp(C.STAR_FANS[stars - 1], C.REP_DAY_MIN, repMax())`, `repCapped` when the clamp changed it, `repReason 'stars'`. After a Yard day or the tutorial day: v2's per serve rule, `repReason 'serves'`. Thirds by `C.THIRD_EDGES`, names `STRINGS.thirdName` (Neighbors, Word's out, In demand). The third sets `offerSlots()` (W3.4). The tip multiplier by third of [S 9] is not in v3.0 (it would move every tip number the v2 harness checks); it is listed for the Overseer in W21.

---

## W10. Inventory ([S 19.3])

### W10.1 Rollover

Charcoal and wood never spoil. Meat keeps up to `coolerCap()` units overnight (W10.4). `state.charcoal` and `state.wood` and `state.stock` carry from event to event and across the creator, the report and the season end (except the season end meat rule, W11).

### W10.2 Caps

- Charcoal: `charcoal + cart.charcoal <= C.CHARCOAL_MAX` (200).
- Wood: `wood <= C.WOOD_MAX` (100); no v3.0 control changes it.
- Meat, all meats together: `stockUnits + cartMeatUnits <= coolerCap() + eventUnits`, where `eventUnits` for a booking is the sum over rail meats of `Math.ceil(rail[m] * 1.5 / MEATS[m].plates)` (half again the booked plates), and for the Yard day and the tutorial day `expectedCrowd()`. `meatRoom()` is that bound minus stock and cart units, never under 0. Each meat line also keeps `STEPPER_MAX - stock[m]`. The shop says so on the line (W17.3 `#shop-room`) instead of silently stopping.

On the tutorial morning this allows the v2.1 prefill (5 units) and the K11 buys (2 more sausage): `expectedCrowd()` there is 7.

### W10.3 `prefill()`

> Amended by W22.14 (Overseer's calls) and W24.1 P-5 (the spare only with a cooler).

The cart that makes the two tap week work ([S 2.3]):

- Booking: for each meat with `r = railFor(booking, addon)[m] > 0`: `need = Math.ceil(r * (1 + C.SPARE_FRAC)) - stock[m] * MEATS[m].plates`; `units = need > 0 ? Math.ceil(need / MEATS[m].plates) : 0`.
- Yard day: `plates = Math.ceil(1.1 * expectedCrowd()) + 1` minus the plates already in stock (all meats); `units = Math.ceil(plates / 2)` (0 when none needed); chicken `Math.floor(units / 2)`, sausage the rest.
- Charcoal: `max(0, C.BAGS_PER_COOKER * ownedCookers - charcoal)`, and at least 1 when `charcoal === 0`.
- Caps: each line within W10.2.
- Affordable: while `total > cash + deposit`, first recompute without the spare, then take one unit at a time off the meat line with the highest unit price that has more than one unit (or more than zero when another meat line is non zero), then one bag at a time down to `max(0, 1 - charcoal)`.

### W10.4 Spoilage at the end of an event

`cap = coolerCap()`. When stock units exceed `cap`, keep units by unit cost, highest first (brisket, butt, ribs, chicken, sausage), up to `cap`; the rest spoil into `today.spoiled[m]` and `today.spoilCost` (unit cost each). `spoilReason` is `'none'`, `'nocooler'` (cap 0 and something spoiled) or `'full'` (cap above 0 and something spoiled). This replaces v2's "no cooler, everything spoils; cooler, everything keeps". `till.coolerAfter` is the stock after spoilage, `till.charcoalAfter` the charcoal left. Emits `spoiled { units, meat }` (meat: per meat counts) when anything spoiled.

### W10.5 Catalog changes

- `cooler` effect: `Keeps 12 units of raw meat overnight. Without it, meat left after a cook spoils.`
- `driveway`: price 400, effect `The next rung. Not built yet.`, needs `{ gear: 'drum', rep: 34 }`, needsText `Needs the drum smoker and word of mouth 34.`. `needs` gains the `{ rep: int }` form (game.js `lockedBy` reads it). The Coming next test becomes `gear.drum && rep >= C.DRIVEWAY_REP && cash >= C.DRIVEWAY_PRICE`; its sentence and card copy keep the v2 words with the new price. Still a goal line only ([S 7.1]: buyable in v3.3).
- Everything else in `CATALOG` is unchanged (length 21, order unchanged).

---

## W11. Season end ([S 3.6], v3.0 card)

`startSeason()` applies, in order: cash carries in full; `rep = max(C.SEASON_REP_FLOOR, Math.floor(rep * C.SEASON_CARRY_REP))`; every unit of stock spoils (no money moves, no till row; `seasonEndPreview().spoiled` showed it); charcoal and wood keep; gear, decor, hires, player, pit name, settings and stats keep; `season.year + 1`, `week 1`, `results []`, new offers. No season scaling in v3.0 ([S 3.6]: v3.2).

---

## W12. Tutorial strand fixes (K13 known issues 1 and 2)

> Amended by W22.16 (Overseer's calls) and W24.1 P-6 (the full grate points at the cooler).

### W12.1 Raw meat over a full grate

A new tutorial row, checked before every other row of [T 2.3] except `open` and `customer`: hands hold a `raw` piece and `freeSlotFor(kettle1, MEATS[m].slots) < 0` (kettle 1 lit or not). Its step id is:

- `'fullGrate'` when another active cooker (`kettle2`, then `drum`, owned) has a free slot for that meat and, for brisket, is the drum; the target is that cooker's id.
- `'full'` otherwise; the target is `'trash'`.

Both ids are off the happy path: they are not in `STRINGS.tutorialOrder` (which stays the 11 ids of K1), and the K11 check "distinct consecutive ids equal `tutorialOrder`" still holds on the happy path. `tutorialStep().text === STRINGS.tutorial[id]` for both (W15). `TutorialStepId` gains the two ids. The arrow points at the target station and `#act` pulses when it is in reach and enabled (K10 rules), so at the trash the pulsing button reads `Throw away {label}`. Once the piece is gone the rows recompute.

### W12.2 Refill instead of a strand

At the start of every tutorial check while the tutorial runs and the phase is service:

- **Meat:** stock total is 0, and no raw, cooking or done piece is on any grate, nothing is on the board or the table, and the player and the buddy carry nothing but charcoal or burnt: add one unit of `sausage` to stock (no cash moves) and emit `tutorial_refill { kind: 'meat', meat: 'sausage' }`.
- **Charcoal:** `charcoal === 0`, kettle 1's fire is under `C.COLD_UNDER`, and the player is not carrying charcoal: add one bag (no cash) and emit `tutorial_refill { kind: 'charcoal' }`.

Each fires at most once per check. Neither touches `rng()`. The refill is what keeps a player who threw away their only sausage (a button only action) from being stranded; the charcoal rule covers the same strand for the bag.

---

## W13. Save

### W13.1 Version 4 shape

`SAVE_KEY` unchanged. `v: 4` is the v3 shape (v2 keys plus `tutorial`) with these changes and additions, exactly these keys and no others:

```json
{ "v": 4, "day": 9, "cash": 340, "rep": 31,
  "stock": { "sausage": 0, "chicken": 2, "ribs": 0, "butt": 1, "brisket": 0 },
  "charcoal": 34, "wood": 0,
  "gear": { "kettle2": true, "cooler": true, "bigtable": false, "tray": false, "canopy": false, "drum": false },
  "decor": { "chair1": false, "chair2": false, "flowers": false, "birdbath": false, "lights": false, "picnic2": false },
  "hires": { "buddy": false, "tender": false },
  "stats": { "days": 8, "served": 120, "walkouts": 4, "past": 2, "burnt": 1, "seated": 60 },
  "drivewayShown": false,
  "tutorial": { "done": true },
  "season": { "year": 1, "week": 8, "seed": 123456789, "pick": "picnic", "addon": null, "weekCash": 340,
              "results": [ { "type": "birthday", "stars": 3 }, { "type": "picnic", "stars": 4 }, { "type": "yard", "stars": 0 },
                           { "type": "picnic", "stars": 3 }, { "type": "picnic", "stars": 5 }, { "type": "birthday", "stars": 2 },
                           { "type": "picnic", "stars": 4 } ] },
  "player": { "name": "Marty", "look": { "skin": 3, "hair": 1, "hairColor": 1, "face": 1, "hat": 2, "apron": 0 } },
  "pitName": "Marty's Pit",
  "settings": { "length": "normal" } }
```

`offers` and `booking` are not saved; `createSim` regenerates the offers from `seed`, `year`, `week`, `rep`, `weekCash`, `gear` and `length`, and restores the pick by id.

### W13.2 `serialize()`

> Amended by W22.1, W22.5 (Overseer's calls).

Always `v: 4`. Writes the season the next load should open: `week = results.length === 9 ? 9 : results.length + 1`; `pick` and `addon` are written only when that week equals `state.season.week` and the loop is `'week'` (else `null`); in loop `'report'` `weekCash` is the cash after the till. Charcoal clamps to 200, wood to 100. `player` is `null` or the cleaned object. Service state, seats, charm, offers and the tutorial step are never saved. Saves still happen only on morning screens and the till (`save_wanted` reasons of W14).

### W13.3 `validateSave(obj)`

> Amended by W22.1, W22.3, W22.15 (Overseer's calls).

Accepts `v` 1, 2, 3 and 4 and always returns `v: 4`; anything else (including `v: 5`, `'4'`, missing) gives `null`; never throws, cyclic input included.

- Every v3 rule for the v3 keys, except `charcoal` clamps 0 to `C.CHARCOAL_MAX`.
- `wood`: integer 0 to 100, default 0.
- `season`: `year` 1 to 99 (default 1); `seed` `Number(x) >>> 0` when finite, else `mix32(day, cash, stats.served)`; `weekCash` 0 to `MAX_CASH`, default `cash`; `results`: the first 9 entries that are plain objects with `type` in `BOOKING_IDS`, each `{ type, stars }` with `stars` 0 for `'yard'`, else an integer clamped 1 to 5, `'finale'` kept only as the ninth entry; `week`: integer clamped 1 to 9, then made consistent: `results.length === 9` forces `week = 9`; otherwise `results` is cut to `week - 1` entries and `week = results.length + 1`; `pick`: kept when it is a valid id for that week (`'finale'` in week 9; `'birthday'`, `'picnic'` or `'yard'` in weeks 1 to 8) and the season is not complete, else `null`; `addon`: a `MeatId` (brisket only with `gear.drum`) or `null`.
- `player`: `null` unless a plain object; then `{ name: cleanName(name, 'Pitmaster'), look }` with each look key per W4.3.
- `pitName`: `cleanName(pitName, 'Your Pit')`.
- `settings.length`: one of `C.LENGTH_ORDER`, default `'normal'`.
- `tutorial.done`: v3 rule (owed only on day 1); when owed, `player` is forced `null`, `season.results` `[]` and `week` 1.
- From `v` 1, 2 or 3: every kept value as before, plus `season = { year: 1, week: 1, seed: mix32(day, cash, stats.served), pick: null, addon: null, weekCash: cash, results: [] }`, `player: null`, `pitName: 'Your Pit'`, `settings: { length: 'normal' }`, `wood: 0`. A v3 day 1 save that still owes the tutorial keeps owing it.

`createSim(saved)` sets the loop from a validated save: tutorial owed gives `'tutorial'`; else `player === null` gives `'creator'` (the creator shows once, prefilled with `DEFAULT_LOOK`, `'Pitmaster'` and the saved pit name, [S 19.2]); else `results.length === 9` gives `'seasonEnd'` (phase morning, no morning roll); else `'week'` with `startWeek()` using the saved `weekCash`, then the saved pick and add-on restored when still legal. The morning roll runs for `'tutorial'`, `'creator'` and `'week'` as v2.

`game.js` keeps its `parsed.v` read: any valid save with raw `v` 1, 2 or 3 shows `STRINGS.ui.notice` (`Your save was updated for the season.`) on the status line for `C.FX.NOTICE_S` and once in `#live`, then writes the save once. A v4 save loads silently.

---

## W14. Events (rows added to or changed in the D10 and K7 tables)

> Amended by W22.2, W22.7 (Overseer's calls).

`L = MEATS[meat].label`. Sentences are `game.js`'s, built from `STRINGS.say` (W15) with `{token}` filled.

| type | payload | when | sentence (`#live`) | status |
|---|---|---|---|---|
| `offers_ready` | `year, week, ids: BookingId[]` | `startWeek()` and `setLength()` in the week | none | **new** |
| `booking_picked` | `id, type` | `bookOffer()` | `say.picked` (booking) or `say.pickedYard` | **new** |
| `deposit` | `amount` | `loadUp()` with a deposit | `say.deposit` | **new** |
| `yard_open` | `kind: EventKind` | `openGate()` or `loadUp()` | tutorial: K7 rule; booking: `say.open`; Yard day: the v2 sentence | `kind` **new** |
| `served` | adds `booked: boolean` | v2 | booked: `say.servedBooked` (`tip > 0`) or `say.servedBookedNoTip`; else v2 | changed |
| `guests_missed` | `n` | W7.3 | `say.missed` (`n === 1`: `say.missedOne`) | **new** |
| `client_stars` | `stars, score, fed, booked, pay, bonus` | end of a booking, before `day_over` | `say.stars` (`stars === 1`: `say.starsOne`) | **new** |
| `spoiled` | `units, meat: { [m]: int }` | W10.4, before `day_over` | none | **new** |
| `day_over` | | end of any event | tutorial and Yard day: v2 sentence; booking: `say.reportOpen` | changed |
| `week_start` | `year, week` | `finishReport()` into a new week, `setPlayer()` from the creator, `startSeason()` | `say.week` | **new** |
| `season_end` | `year, stars: int[]` | `finishReport()` after week 9 | `say.seasonEnd` | **new** |
| `season_start` | `year` | `startSeason()` | none | **new** |
| `player_set` | `name, pitName` | `setPlayer()` | none | **new** |
| `tutorial_refill` | `kind: 'meat' \| 'charcoal', meat?: MeatId` | W12.2 | `say.refillMeat` or `say.refillCharcoal` | **new** |
| `tutorial_step` | `id` may be `'full'` or `'fullGrate'` | W12.1 | `text` (K7 rule) | changed |
| `save_wanted` | `reason` gains `'book' \| 'addon' \| 'settings' \| 'player' \| 'week' \| 'season'` | as the methods say | none | changed |

`week_start` from `finishReport()` is followed by `offers_ready` and `save_wanted { reason: 'week' }`. Every other D10 and K7 row is unchanged. `walk_past` never fires for a booked guest.

---

## W15. `PitSim.STRINGS` additions (exact text)

> Amended by W22.26 (Overseer's calls) and W24.2 (new and changed keys listed there).

Owned by `sim.js`; `game.js` and the harness read them by key and fill `{token}` placeholders by plain replacement. Every value obeys [S 14]: no em or en dashes, no rule of three, no hype, invented first names only from `names`. The v2 and v2.1 keys are unchanged. Additions:

```js
tutorial: { /* the 11 K8 entries, plus */
  full: 'The grate is full. Take this piece to the trash and tap Throw away.',
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
  book: 'Book',
  booked: 'Booked',
  bookAria: 'Book the {label}',
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
  coolerRoom: 'The cooler holds {cap} overnight. This cook can use about {e} more.',
  coolerFull: 'No more room. The cooler holds {cap} overnight.',
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
  score: 'Score',
  of5: '{n} of 5',
  partFed: 'Fed',
  partWait: 'Wait',
  partQuality: 'Quality',
  partOf: '{p} of {max}',
  result: 'Guests fed {f} of {b}. {w} walked out. Average wait {s} s.',
  missedLine: '{n} never got in line.',
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
  takeDetail: 'pay and tips after wages and daily costs',
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
```

`{when}` is `weekLabel[w - 1]`; `{row}` is the lower case row label (`skin`, `hair`, `hair color`, `face`, `hat`, `apron`); `{label}` in `crSwatch` is the `look` label of that index. Plurals: `game.js` picks the `One` key when the number is 1. `ui.result` keeps "walked out" for any number. Money shows as game numbers with the coin sprite, never a currency sign.

---

## W16. `PitSim.art` (amends D11 and K9)

### W16.1 Palette and legend

`PALETTE` grows from 32 to 36 entries, using the legend extension D11 reserved: `w` 32 `#f7d9c4`, `x` 33 `#b87a4b`, `y` 34 `#714227`, `z` 35 `#5f3a25`. The legend is now `0123456789abcdefghijklmnopqrstuvwxyz`, lowercase only; `build()` rejects anything else (uppercase included, which stays reserved for authoring symbols). `COLOR` gains four keys, 35 in all: `skinPale` (w), `skinTan` (x), `skinTanD` (y), `skinDeep` (z). No existing index or key moves.

### W16.2 Sprite changes

Replaced in place: `font` 4x6 gains frames 40 `'` and 41 `-` (42 frames); `sign` becomes 62x12, 1 frame (an umber board with an orange border like v2's, 62 wide, posts at x 7 and 53). New: `font_s` 3x5, 42 frames, the same index mapping as `font` (0 to 9 digits, 10 to 35 A to Z, 36 `+`, 37 `:`, 38 `.`, 39 `,`, 40 `'`, 41 `-`), glyph pixels `C` like `font`; `ev_birthday` (a frosted cake with candles), `ev_picnic` (a picnic basket with a gingham cloth), `ev_yard` (a small house), `ev_finale` (a gold cup), each 16x16, 1 frame; `star` 9x9, 2 frames (0 full yellow with an outline brown edge, 1 empty in `smokeD`); `flame` 8x10, 2 frames (0 lit orange with a yellow core, 1 unlit in `smokeD` and umber); `check` 8x8, 1 frame (a green box with a white tick). `art.text` and `art.textTinted` map `'` to frame 40 and `-` to 41; `art.textWidth` counts both as glyphs.

**REQUIRED SPRITES v3.0**, 123 names, 334 frames; the harness copies this literal verbatim and it replaces the K9 literal:

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
  ['ev_finale', 16, 16, 1], ['star', 9, 9, 2], ['flame', 8, 10, 2], ['check', 8, 8, 1]
];
```

### W16.3 New `art` members

```ts
setLook(look: Look): string          // rebuilds player_down, player_up, player_side and player_slice in place (grids and the
                                     // pre-rendered canvases, flips included) for this look; returns lookKey(); same sizes and
                                     // frame counts; an invalid index falls back to the DEFAULT_LOOK value for that key
lookKey(): string                    // the look in effect as 'skin-hair-hairColor-face-hat-apron', '1-0-1-0-1-0' after build()
LOOK: {                              // frozen data, palette characters only (W16.4)
  skin: { S, R, M, P }[6], hairColor: { H, J }[6], apron: { A, B }[6],
  hat: (null | { C, F, D })[4], hair: string[6], face: string[4]   // hair and face: the option ids of W4.3
}
textWidthS(str: string): int         // glyph count (space counts) times 4 minus 1
textFit(ctx, str: string, x: int, y: int, w: int): { font: 'font' | 'font_s', x: int, width: int }
                                     // upper cases str; draws it with font when textWidth <= w, else with font_s at y + 1;
                                     // centered in w (x0 = x + floor((w - width) / 2)); unknown characters skipped
uiText(str: string, opts: { scale: int, dpr: number, color: string, shadow?: string, bold?: boolean }): HTMLCanvasElement
                                     // the screen mocks' 5x7 UI font (the glyph table of screen-1-season.html, plus '-'),
                                     // drawn at scale CSS px per font pixel into a canvas of scale * dpr device pixels per font
                                     // pixel, smoothing off, style width and height set in CSS px, aria-hidden="true"; shadow
                                     // draws the text again 1 font pixel lower first; bold widens each stroke one pixel right
```

`build()` ends with the default look applied, so `lookKey() === '1-0-1-0-1-0'` before any `setLook` call. `setLook(DEFAULT_LOOK)` after any other look restores grids identical to the ones `build()` made. Nothing else on `art` changes. `sprites.js` still touches the DOM only through `document.createElement('canvas')`, now in `build()`, `canvasFor()`, `setLook()` and `uiText()`.

### W16.4 The look system (palette swaps and overlays)

The pitmaster is composed by the existing `personRows` / `paintPerson` path ([V2.11] symbols), with the player's symbol map built from the look:

| Swap table | Symbols | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|---|
| `skin` (S base, R shade, M nose and mouth, P cheek) | S R M P | w l m i | l m n i (v2) | m 7 n q | x n 5 q | n y 5 r | z 5 1 r |
| `hairColor` (H base, J highlight; also beard and mustache) | H J | 2 5 | 5 6 (v2) | r q | 8 9 | 4 8 | s u |
| `apron` (A base, B shade) | A B | o r | 4 r | c d | f g | t 2 | i j |
| `hat` (C crown, F highlight, D brim and shade) | C F D | none | 4 8 r (v2 cap) | 7 8 6 (the tender's wide hat) | o h r (bandana) | | |

The rest of the v2 player map is unchanged (outline `5`, shirt `g` `f` `t`, legs `6` `5`, shoes `1`, eyes `1`, eye whites `h`, tray and knife symbols).

Overlay templates, in symbols, for every facing the player has (down, up, side; `player_slice` and the walk frames reuse the down and side heads):

- **Hair:** six head templates, each 16 wide by 13 rows (head rows 0 to 12), per facing: `short` (v2), `curly`, `long` (v2 customer long hair), `buzz`, `bun`, `bald` (no H pixels on the crown, skin S and R there instead). 18 templates.
- **Hat:** three templates, 16 by 6 (rows 0 to 5), per facing, replacing the head's rows 0 to 5 when the hat is not none: `cap` (v2), `cowboy` (v2 `wide`), `bandana` (new, a cloth band over rows 1 to 4 with a knot on the side facing). 9 templates.
- **Face:** patches on the down head, columns 4 to 11 by rows 7 to 11 (8 by 5), and on the side head, columns 2 to 5 by rows 7 to 11 (4 by 5); none on the up head: `mustache` (H pixels on row 10 under the nose), `beard` (H on rows 10 and 11 and the jaw columns), `glasses` (near black `1` rims around the eyes on row 8 with `s` lenses). Applied after the happy face rows of v2, so the slice pose and every walk frame wear them.

Order: hair template, then hat rows, then the face expression, then the face patch, then torso and legs, then paint with the merged map. Every resulting character is in the W16.1 legend. The buddy, tender and customers are untouched.

### W16.5 The yard sign

`MAP.props` keeps 19 entries; the `sign` prop's draw moves to (65, 2) (tile (4, 0), blocks none, sort row 0). `MAP.signText` becomes `{ x: 67, y: 5, w: 58 }`. `game.js` draws `state.pitName` on it with `art.textFit(octx, pitName, 67, 5, 58)` right after the sign prop in the y sorted pass (v2 Game deviation 11), cream. A name of up to 11 characters fits `font` (54 px); 12 to 14 characters use `font_s` (at most 55 px). The sign ends at x 126, clear of the tree at 128.

---

## W17. `game.js`

### W17.1 Panels by loop

| Loop (phase) | Panel |
|---|---|
| `tutorial` (morning) | `#clipboard` (v2.1, unchanged) |
| `tutorial` (service), `prep`, `cook` | none (the yard), `#pause` on Escape or P |
| `tutorial` (evening), `report` | `#till` (the report, W17.4) |
| `creator` | `#creator` |
| `week` | `#week`, or `#sheet` over it, or `#broke` when `state.broke` |
| `seasonEnd` | `#season-end` |

`PANEL_IDS` gains `week`, `sheet`, `creator`, `season-end`. Opening rules are v2's (focus the heading, `inert` on `#stage`, `#hdr` and `#foot`). `#sheet` opens in place of `#week` and `#sheet-back` (or Escape) returns to `#week` with focus on the card that opened it. On `#creator` reopened from the pause panel, Escape and `#cr-back` return to `#pause` and restore `art.setLook(sim.look())`.

The HUD: `#hud-day` reads `ui.hudWeek` in every season loop and `Day {n}` on the tutorial day. `#hud-cash` and `#hud-rep` as v2.1.

### W17.2 The week hub (`#week`)

> Amended by W22.25 (Overseer's calls) and W24.2 P-11 to P-14.

Layout top to bottom, matching `screen-3-week.png` for the header, pills, next event card, 2 by 2 grid and news card, and `screen-1-season.png` for the season strip and the offer cards. Blue striped screen (`--blue` `#3a6df0` with a 2 px `#3667e8` stripe every 8 px), dark umber cards with a near black 2 px edge, orange primary buttons with a darker bottom edge, the pixel font of `art.uiText` for headings and numbers. The hub fits in two phone screens of scrolling ([S 2.3]: `#week` content height at most `2 * innerHeight` at 375 by 812).

| id | element | content |
|---|---|---|
| `week-h` | `h2`, visually hidden (`.sr`), `tabindex="-1"` | `{pitName}, ` + `ui.weekOf`; the focus target |
| `week-top` | `div` | header row |
| `week-sign` | `div.sign` | wood board with `art.uiText(pitName.toUpperCase(), { scale: 2, ... })`, the text also in a `.sr` span |
| `week-label` | `p` | `ui.weekOf` in the UI font, and under it `week-when` (`p`) with `weekLabel[w - 1]` |
| `week-pips` | `div`, `aria-hidden` | 9 pips: done gold, this week orange with a white frame, later navy, the ninth a gold framed cup box |
| `week-cash` | `div.pill` | coin, `ui.cash`, the number |
| `week-fans` | `div.pill` | heart, `ui.fans`, the number, and `week-thirds` (`div`, `role="img"`, `aria-label` `ui.fansAria`): three segments, the current third filled gold |
| `season-strip` | `ol`, `aria-label` `ui.stripAria` | `wk-1` to `wk-9` (`li`), a 5 column grid, week 9 spanning 2 columns: done weeks show the number, a `check` badge and five `star` frames filled up to the result (a Yard day shows no stars and its label uses `ui.noStars`); this week a gold tile with `ui.nowTag`; later weeks the number and `?` in pale blue; week 9 an orange tile with the cup and `weekLabel[8]`. `aria-label` per tile: `ui.wkDone`, `ui.wkNow`, `ui.wkLater` or `ui.wkFinale` |
| `offers` | `section`, `aria-labelledby="offers-h"` | `offers-h` (`h3`, `ui.thisWeek` in the UI font) and `ui.pickOne` muted at the right |
| `offer-{id}` | `article` | per offer in display order; booking cards in a 2 column grid (1 column under 340 px panel width); the Yard day card full width and short; the finale card full width. Inside: an art band 72 px tall (sky over lawn, CSS) with `ev_{type}` at 4x; the label; `ui.host` (bookings); lines with icons: `ui.guests` or `ui.walkIns`, each menu meat (`icon_{m}` and `plateLabel`) or `ui.yourPick`, `venue.backyard`, difficulty as `flame` frames (lit for the offer's flames, unlit to 3) and `flames[difficulty - 1]`, `ui.pay` with the coin (bookings) or `ui.perPlate` and `ui.noFee` (Yard day), `ui.deposit` (bookings); `offer-{id}-needs` (`p`, red, the Needs line, empty and hidden when safe) |
| `book-{id}` | `button.primary` | `ui.book`, or `ui.booked` with `aria-pressed="true"` on the picked card (which also gets the orange 3 px frame); `aria-label` `ui.bookAria`; calls `sim.bookOffer(id)` |
| `next-event` | `section`, `aria-labelledby="next-h"` | cream card: umber header `next-h` (`ui.nextEvent`) with `ui.pay` and the coin at the right (Yard day: `ui.perPlate`); the picked offer's icon, label, guests and menu lines; `go-deposit` (`p`, `ui.depositLine`, or `ui.yardLine`) |
| `go` | `button.primary` | `ui.loadUp`, with a `flame` frame 0 icon; disabled unless `canLoadUp().ok`; calls `sim.loadUp()` |
| `go-why` | `p.muted` | `canLoadUp().reason`, empty when enabled |
| `hub-grid` | `div` | 2 by 2 grid of four buttons, each a titled tile with a small window and two lines, 44 px or taller, opening its sheet: `card-crew` (red `#d8352a`: `ui.crew`, `ui.crewLine`, `ui.crewSub`), `card-gear` (steel `#5a6b84`: `ui.gear`, `ui.gearLine`, `ui.gearNext` or `ui.gearAll`), `card-menu` (mustard `#d99a1e`: `ui.menu`, `ui.menuOne` or `ui.menuMany` or `ui.menuYard`, the meat labels), `card-shop` (green `#3a9a4a`: `ui.shop`, `ui.shopLine`, `ui.shopOne` or `ui.shopMany`) |
| `inv-card` | `section`, `aria-labelledby="inv-h"` | `inv-h` (`ui.inventory`); `inv-charcoal` (`p`, pile frame icon, `ui.invCharcoal` or `ui.invCharcoalOne`); `inv-wood` (`p`, `ui.invWood`, hidden while `wood === 0`, so always hidden in v3.0); `inv-{meat}` (`p`, `ui.invMeat` with `MEATS[m].label`, only for meats with stock); `inv-empty` (`p`, `ui.invEmpty`, only when stock is 0); `inv-cooler` (`div`, `role="meter"`, `aria-valuenow` units, `aria-valuemin` 0, `aria-valuemax` cap, label `ui.invCooler`; a cream framed bar with yellow fill, orange past 80 percent, red when over); `inv-spoil` (`p`, red: `ui.invNoCooler` when cap is 0 and stock is above 0, `ui.invOver` when over is above 0, else hidden) |
| `news` | `section` | red tab `ui.news`; holds `goal` (`p`, `Next goal: {label}, {price}.` as v2) or the v2 Coming next card (`div#goal` with `#goal-keep`) |
| `len-short` `len-normal` `len-long` | `button.alt`, `aria-pressed` | under `ui.lengthH`; call `sim.setLength(id)`; `len-help` (`p.muted`) reads `ui.lengthHelp` with the setting's seconds |
| `week-controls` | `button.alt` | `ui.controls`, opens `#howto` (Back returns here) |
| `week-new` | `button.alt` | `ui.newGame`, opens `#newgame` (Keep playing returns here) |

`#seats` lives on the gear sheet now (W17.3). The two tap week: on a fresh hub the first offer is already picked and the cart is prefilled, so `book-{first}` then `go` starts a cook.

### W17.3 Sheets (`#sheet`)

> Amended by W24.2 P-16 (`inc5-charcoal`, coin before the price, the count in a box).

`sheet-h` (`h2`, `tabindex="-1"`) holds `ui.shop`, `ui.gear`, `ui.menu` or `ui.crew`; `sheet-back` (`button.alt`, `ui.back`) sits first in `sheet-body`. Same look as the hub.

- **Shop:** v2 `cartRow` rows for the five meats and charcoal with the v2 ids `dec-{id}`, `qty-{id}`, `inc-{id}`, plus per row `have-{id}` (`span`, `ui.youHave` with stock or bags) and `after-{id}` (`span`, `ui.afterBags` for charcoal, `ui.afterUnits` for meat: stock plus cart). `shop-room` (`p.muted`): `ui.coolerRoom` (`{e}` = `meatRoom()`), or `ui.coolerFull` when `meatRoom() === 0`, and `ui.pileFull` when charcoal plus cart is 200. `cart` (`p`): `ui.cartLine` for a booking (`{d}` the deposit, `{c}` = cash + deposit - total) or `ui.cartLineYard`. The v2 muted line `Game numbers. Not real prices and not a cooking guide.` stays.
- **Gear:** v2 `ownRow` for the six gear rows with `buy-{id}`, the driveway `goalRow`, the Decor heading, the v2 muted note and decor rows with `buy-{decorId}`, and `seats` (`p`, the v2 `#seats` line).
- **Menu:** for a booking, `menu-{m}` (`p`, `ui.menuAsk` with `plateLabel` and the rail count) per rail meat; `ui.addonH`; `addon-none` (`button.alt`, `ui.addonNone`) and `addon-{m}` (`button.alt`, the meat label) for every meat `setAddon` would accept, `aria-pressed` on the chosen one; `addon-note` (`p.muted`, `ui.addonNote` with `{b}` = `Math.round(fee * C.MENU_BONUS)`). For the Yard day only `ui.yardMenu`.
- **Crew:** v2 `hireRow` rows with `hire-buddy` and `hire-tender`, and the v2 Daily costs row.

### W17.4 The report (`#till`)

> Amended by W22.8, W22.24 (Overseer's calls) and W24.2 P-10.

Matches `screen-4-report.png`: umber screen (`#1b1714` with a faint `#211c18` dot grid), cream framed boxes with a gold title set into the top border, gold and green numbers, an orange Continue style button. Booking reports:

| id | content |
|---|---|
| `till-h` | `ui.reportH` with the booking label, drawn large in the UI font; no letter grade |
| `rep-score` | `ui.score` and the score number in the left box; `star` frames for the stars (filled to `stars`, empty to 5) and `ui.of5` |
| `rep-parts` | three rows `rep-fed`, `rep-wait`, `rep-quality`: `ui.partFed` (or Wait, Quality), a 10 segment bar, and `ui.partOf` with `{max}` 60, 20, 20 |
| `rep-result` | `ui.result`, then `ui.missedLine` when `missed > 0` |
| `rep-money` | box `ui.money` with `tillRow` rows in this order: `ui.rowFee` (`+fee * (0.5 + 0.1 * stars)` rounded), `ui.rowDeposit` (shown as information, the deposit amount with no sign, since it was already credited), `ui.rowTips`, `ui.rowMenuBonus` (only when a menu bonus was possible), `ui.rowSeatTips`, `ui.rowFood`, `ui.rowCharcoal`, `ui.rowWages`, `ui.rowDaily`, `ui.rowSpoiled`, `ui.rowThrown`, `ui.rowGrate`, `ui.rowBurnt`, `ui.rowTake` (bold, `ui.takeDetail`, `till.net`), `ui.rowCash` |
| `rep-fans` | box `ui.fansH`: heart, the signed delta, `ui.fansLine`, and `ui.fansReason` or `ui.fansReasonOne` (booking) or `ui.fansServes` |
| `rep-host` | box `ui.hostH`: `hostSays[stars - 1]` with `{name}` = `player.name` |
| `rep-cooler` | `ui.cooler` (list of `coolerAfter` as `{n} {label}`) or `ui.coolerNothing` |
| `rep-charcoal` | `ui.charcoalLeft` or `ui.charcoalLeftOne` with `charcoalAfter` |
| `rep-spoil` | `ui.spoilFull` or `ui.spoilNone` with the spoiled total; hidden when nothing spoiled |
| `next` | primary: `ui.nextWeek`, `ui.seeSeason` after week 9; calls `sim.finishReport()` |
| `till-new` | `button.alt`, New game (v2) |

Yard day reports: `till-h` `ui.reportH` with `Yard day`; the v2.1 rows (Served, Tips, Seat tips, ... Take today, Cash) in the `rep-money` box; `rep-fans` with `ui.fansServes`; `rep-cooler`, `rep-charcoal`, `rep-spoil`; `next`. The tutorial day: `till-h` stays `Day 1 till` and every v2.1 row and paragraph stays; it gains `rep-cooler`, `rep-charcoal` and `rep-spoil`; `next` reads `ui.cont` and leads to the creator.

### W17.5 The creator (`#creator`) and the season end card (`#season-end`)

Creator, matching `screen-6-creator.png` (blue striped screen, the pit sign on posts, the backyard patch preview, labeled fields with a counter set into the border, the umber options card, the orange Fire it up bar):

| id | content |
|---|---|
| `creator-h` | `h2`, `tabindex="-1"`: `ui.creatorH` in the UI font with a `star` frame 0 on each side, text also `.sr` |
| `cr-sub` | `p`: `check` badge and `ui.crSubDone` after the tutorial day or a skip; `ui.crSub` for a migrated save; absent when opened from pause |
| `cr-preview` | `div`: `cr-sign` (`div.sign` with `art.uiText(pitName.toUpperCase(), { scale: 3 })`, updated on every keystroke, `.sr` text) and `cr-scene` (`canvas`, `aria-hidden`): a backyard patch at an integer scale drawn with `art.draw`: `paver` and `lawn_a` tiles, `player_down` frame 0 of the draft look, `kettle` frame 2 with `smoke` puffs (still under reduced motion) |
| `cr-random` | `button.alt` with the label `ui.crRandom`; `draft = sim.randomLook()`, then refresh |
| `cr-name-l`, `cr-name`, `cr-name-count` | `label` (`ui.crName`), `input type="text"` (`maxlength="14"`, `autocomplete="off"`, `autocapitalize="words"`, `spellcheck="false"`, `enterkeyhint="done"`, at least 44 px tall), `span` (`ui.crCount` with the value length). Prefilled with the current name (`'Pitmaster'` for a new player). `PitSim.filterName` runs on every `input` event and the caret stays at the end |
| `cr-pit-l`, `cr-pit`, `cr-pit-count` | the same for `ui.crPit`, prefilled with `state.pitName` |
| `cr-row-skin` | label `ui.crSkin`; `cr-skin-0` to `cr-skin-5` (`button`, 44 by 44, the swatch color, `aria-pressed`, `aria-label` `ui.crSwatch`; the chosen one gets the gold frame and the `check` badge) |
| `cr-row-hair` | label `ui.crHair`; `cr-hair-prev` and `cr-hair-next` (`button`, 44 by 44, arrows, `aria-label` `ui.crPrev` / `ui.crNext`, wrapping), `cr-hair-val` (`output`, gold UI font, the `look.hair` label upper cased, with position pips) |
| `cr-row-haircolor` | `cr-haircolor-0` to `cr-haircolor-5` swatches |
| `cr-row-face` | `cr-face-prev`, `cr-face-val`, `cr-face-next` |
| `cr-row-hat` | `cr-hat-prev`, `cr-hat-val`, `cr-hat-next` |
| `cr-row-apron` | `cr-apron-0` to `cr-apron-5` swatches |
| `cr-go` | `button.primary`, `ui.crGo` with `flame` icons; calls `sim.setPlayer(draft, cr-name value, cr-pit value)`, then `art.setLook(sim.look())` |
| `cr-back` | `button.alt`, `ui.crBack`; only when opened from the pause panel |
| `cr-note` | `p`, `ui.crNote` |

Option rows put the label on its own line above the controls when the panel is narrower than 420 px, so six 44 px swatches fit at 375 px. Every option change calls `art.setLook(draft)` and redraws `cr-scene`; Back restores the saved look. Keyboard: Tab order is preview, fields, rows top to bottom, Fire it up; Enter in a field moves focus to the next field, then to `cr-go`.

Season end card (blue striped, cream framed box):

| id | content |
|---|---|
| `season-end-h` | `h2`, `tabindex="-1"`, `ui.seasonH` in the UI font |
| `se-pit` | `div.sign`, the pit name as on the hub |
| `se-record` | `ol` titled `ui.record`: `se-wk-1` to `se-wk-9` with the week number, the `ev_{type}` icon at 2x and the stars (Yard day: no stars), each `aria-label` `ui.wkDone` |
| `se-cash`, `se-rep`, `se-meat`, `se-charcoal` | `p` lines `ui.seCash`, `ui.seRep`, `ui.seMeat` (or `ui.seMeatNone`), `ui.seCharcoal`, from `seasonEndPreview()` |
| `season-next` | `button.primary`, `ui.seNext` with `{n}` = year + 1; calls `sim.startSeason()` |

### W17.6 Pause, HUD chips, canvas

- `#pause-body` gains `pause-look` (`button.alt`, `ui.pauseLook`) right after `#pause-controls`; it opens `#creator` with `cr-back` (W17.1).
- `#chips`: first `chip-charcoal` (`span.chip.inv`, not a button, `role="img"`, `aria-label` `Charcoal, {n} bags`, pile icon and the count), then the v2 `chip-{meat}` buttons, shown only for the rail meats during a booking (others `hidden`), all five on a Yard day and the tutorial day. Keyboard digits and Q keep working for every meat with stock.
- The yard sign (W16.5), the rail (W7.4), the W7.1 timings for the clock box, GATE OPENS IN, LAST CALL and the gate frame, and `art.setLook(sim.look())` at boot, after `player_set`, and after the creator closes.
- aria-live: the W14 sentences through the v2 queue rules.
- Reduced motion: the creator preview smoke stands still; nothing new animates.

### W17.7 `PitSim.game` v3.0 (every D14 and K10 member kept)

```ts
version: '0.5.0',
rail: null | { kind: 'booking' | 'yard', items: { meat: MeatId, want: int, sold: int, left: int }[] },   // as pass 8 drew it; null when no rail is drawn
sign: { text: string, font: 'font' | 'font_s', x: int, width: int },   // the yard sign text as drawn (upper case)
panel: string | null                                                   // the open panel id, e.g. 'week', 'sheet', 'creator', 'till'
```

All three are getters worked out from the current state at read time. `captureFrame()` records the rail icons and glyphs and the sign glyphs (`font` or `font_s` records) like any sprite.

---

## W18. `index.html`

The Game builder adds inside `#panels`, after `#broke`, four sections built the v2 way (empty containers that `game.js` fills):

```html
<section id="week" class="hub" role="dialog" aria-modal="true" aria-labelledby="week-h" hidden>
  <h2 id="week-h" class="sr" tabindex="-1"></h2><div id="week-top"></div><div id="week-body"></div><div id="week-foot"></div>
</section>
<section id="sheet" class="hub" role="dialog" aria-modal="true" aria-labelledby="sheet-h" hidden>
  <h2 id="sheet-h" tabindex="-1"></h2><div id="sheet-body"></div>
</section>
<section id="creator" class="hub" role="dialog" aria-modal="true" aria-labelledby="creator-h" hidden>
  <h2 id="creator-h" tabindex="-1"></h2><div id="creator-body"></div>
</section>
<section id="season-end" class="hub" role="dialog" aria-modal="true" aria-labelledby="season-end-h" hidden>
  <h2 id="season-end-h" tabindex="-1"></h2><div id="season-end-body"></div>
</section>
```

and, inside the existing `<style>` before the reduced motion block, the CSS for: the custom properties `--blue #3a6df0`, `--blue-d #2550c9`, `--blue-dd #1a3a96`, `--blue-l #a9c2ff`, `--ink #13235c`, `--gold #F3CF6D`, `--umber2 #3a2c1d`, `--good #3fae4a`, `--crew #d8352a`, `--steel #5a6b84`, `--mustard #d99a1e`, `--shopg #3a9a4a`, `--wood #9c5a2c`; the `.hub` screens (blue stripes, full panel width up to 480 px, padding 12 px), `.pill`, `.sign`, `.card3` (umber card with a 2 px near black edge and a 2 px lighter top line), the offer grid, the strip grid, `.chunky` buttons (a 4 px darker bottom edge), the report screen look on `#till`, the creator rows, swatch frames, and `#chips` changed to `grid-template-columns: repeat(auto-fit, minmax(44px, 1fr))` so six chips fit. Every control stays 44 px or larger; focus stays the 2 px gold ring. `SHELL_IDS` in `game.js` gains the twelve new ids. No inline script, no handler attributes, no external resource, no dash characters. The script tags, their order and `defer`, and the head metas are unchanged (the robots meta and `?v=` wait for the door step, W21).

---

## W19. Harness v3.0 (`games/pit-sim/dev/smoke.mjs`)

> Amended by W22.1, W22.2, W22.18, W22.25 (Overseer's calls) and W24.4.

Run as before: `node games/pit-sim/dev/smoke.mjs [--out <dir>] [--desktop] [--seed <n>] [--dir <folder>]`. Constants: `GAME_VERSION '0.5.0'`; `C_EXPECT.SAVE_VERSION 4`; the W16.2 literal; `Object.keys(SPRITES).length === 123`; `PALETTE.length === 36`; `COLOR` 35 keys; `SIM_SURFACE` gains the nine W1 names; `SURFACE_COUNTS` unchanged (props 19, catalog 21). Screenshots add `creator.png`, `week.png`, `sheet-shop.png`, `report.png`, `season-end.png`. DOM reads still come right after `PitSim.game.advance`. Text input uses CDP `Input.insertText` into the focused field after selecting its value. The tutorial day is the v2.1 day 1, unchanged, so every K11 day 1 step keeps its assertions.

| # | step | asserts |
|---|---|---|
| 1 | files present | as K11 (fatal) |
| 2 to 4 | node --check sprites.js, sim.js, game.js | exit 0 |
| 5 | sim.js loads headless with the full surface | K11 checks with `C.SAVE_VERSION === 4`, `C.DRIVEWAY_PRICE === 400`; every W2 key present with its W2 value or, for a tunable key, a number of the right kind; `LENGTHS` exactly W2; the nine W1 names; `BOOKINGS` rows per W3.1; `LOOK_COUNTS`, `DEFAULT_LOOK` per W4.3; every W15 key present with the exact text (the harness carries the W15 block as its expectation); `STRINGS.names.length === 60` with no duplicate and none equal to `Striker`, `Peyton` or `Joel`; `STRINGS.tutorial` holds the 11 K8 entries plus `full` and `fullGrate` (13 keys, replacing K11's exactly 11), and `STRINGS.tutorialOrder` is still the 11 K1 ids; the sim object has every W5.1 method; `MAP.signText` deep equals `{ x: 67, y: 5, w: 58 }` and the `sign` prop draws at (65, 2); `game.js` source contains no `settle(` |
| 6 | validateSave rejects, clamps and migrates | K11 checks with every result at `v: 4`; `{ v: 5 }` and `{ v: '4' }` give `null`; v1, v2 and v3 samples gain the W13.3 defaults (`player null`, `pitName 'Your Pit'`, season year 1 week 1 results `[]`, `settings.length 'normal'`, `wood 0`); the W13.1 sample round trips unchanged; dirty v4: `charcoal 500` gives 200, `wood -3` gives 0, `season.week 7` with 3 results gives week 4, 9 results with week 2 gives week 9, `results` with a bad type dropped, `stars 9` gives 5, a yard `stars 4` gives 0, `pick 'finale'` in week 3 gives `null`, `addon 'brisket'` without the drum gives `null`, `player.name 'Ana<b>!'` gives `'Anab'`, `look.skin 9` gives 1, `pitName ''` gives `'Your Pit'`, `settings.length 'turbo'` gives `'normal'`, a v4 day 1 save owing the tutorial with a player gives `player null`; cyclic input does not throw |
| 7 | seat reachability | as K11 |
| 8 | tutorial rules, headless | K11 step 8, plus: `state.loop === 'tutorial'` throughout; after the till `finishReport()` gives loop `'creator'`, phase morning, `player === null` |
| 9 | skipTutorial, headless | K11 step 9 (a) to (d), with (a) now also asserting loop `'creator'` after the morning skip and `openGate()` refused there; (b) stays on the tutorial loop and its day ends in loop `'tutorial'` evening |
| 10 | burn warning at hot fire, headless | K11 step 10, reaching service through `skipTutorial()`, `setPlayer(DEFAULT_LOOK, 'Pitmaster', 'Your Pit')`, `bookOffer('yard')`, `loadUp()` |
| 11 | **new** tutorial strands, headless | (a) `createSim(null, 21)`, `openGate()`; light kettle 1; two sausages on it; take a third: `tutorialStep()` is `{ id: 'full', target: 'trash', text: STRINGS.tutorial.full }` and a `tutorial_step` with id `full`; walk to the trash: `verbAt().label` is `Throw away Sausage`; `interact()`: the step leaves `full`. (b) `createSim(null, 22)`: cart set to 1 sausage, 0 chicken, 1 bag, `openGate()`; take the sausage, throw it away at the trash: one `tutorial_refill { kind: 'meat', meat: 'sausage' }`, `stock.sausage === 1`, step `meat` with target `cooler`, no cash change. (c) `createSim(null, 23)`, `openGate()`, fixture `state.charcoal = 0` before a tick with kettle 1 cold: one `tutorial_refill { kind: 'charcoal' }`, `charcoal === 1`, step `charcoal`. (d) a stub second cooker: fixture `gear.kettle2 = true` on a tutorial service sim with kettle 1 full and a raw piece in hand gives `{ id: 'fullGrate', target: 'kettle2' }` |
| 12 | **new** booking generator, headless | `genOffers` with seed 7, weeks 1 to 8, rep 20, cash 80, no gear, Normal: ids `['birthday', 'picnic', 'yard']`; Birthday headcount 12, menu `['sausage', 'chicken']`, rail 6 and 6, pay 100, deposit 30, difficulty 1, window 80, patience 45; Church picnic 20, `['chicken', 'butt']`, 10 and 10, 275, 83, 2, 80, 50; the Yard day 0, `[]`, 0, 0; Short and Long give the W3.2 headcounts, fees and windows; week 9 gives only the finale, 40 guests over four meats (fee 475) and over five with `gear.drum` (560); the same input twice deep equals; hosts are `STRINGS.names` entries, distinct within a week; cash 50 still lists the Birthday; `offerSlots()` per third at rep 33, 34, 66, 67; with a stub `types` list of five safe rows: rep 20 gives 2 bookings plus the Yard day, rep 50 gives 3, rep 80 gives 4 (3 plus the invite, the highest fee remaining), no type twice, display order by difficulty then pay; a stub list where every shuffled pick is a stretch still holds one safe offer |
| 13 | **new** client stars and pay, headless | the five `scoreEvent` cases of W8.1; `stars` edges at scores 39, 40, 59, 60, 74, 75, 89, 90; pay at 1, 3 and 5 stars for fee 275 and deposit 83 is 82, 137, 192 rest after the deposit (165, 220, 275 in all) |
| 14 | **new** week loop, headless | `createSim(null, 31)`, `skipTutorial()`: loop `creator`; `setPlayer(look, 'Marty', "Marty's Pit")`: loop `week`, `player` deep equals, events `player_set`, `week_start { year: 1, week: 1 }`, `offers_ready`; `season.booking.id === 'birthday'`; the cart equals `prefill()` and covers the rail with the spare; `canLoadUp().ok`; `loadUp()`: cash is before + 30 - cart total, `deposit { amount: 30 }`, loop `prep`, `today.gateAt 30`, `lastCallAt 110`, `endAt 125`, `today.booked 12`, `pending 12`; tick to the gate: loop `cook`; with no input, every spawned customer has `booked === true` and orders a rail meat, no meat's orders exceed its rail count, spawned plus `today.missed` equals 12, no `walk_past`, at most `queueSpotCount()` in line at once; the event ends with `client_stars { stars: 1 }` (nobody fed: score 20), `till.payRest === 30`, `rep` 20 to 15, `season.results` `[{ type: 'birthday', stars: 1 }]`, loop `report`; `finishReport()`: week 2, loop `week`, new offers, `week_start`. Then `bookOffer('picnic')`, `setAddon('ribs')`: rail 8 chicken, 7 butt, 5 ribs (W3.2), and the cart equals the new `prefill()`; `setAddon('chicken')` refused; `setLength('short')`: Church picnic headcount 14, pick kept |
| 15 | **new** inventory, caps and spoilage, headless | in a week: `buy('charcoal', 999)` stops at `200 - charcoal`; meat increases stop at `meatRoom()` with the `coolerFull` message; with no cooler, an idle booking leaves the prefill units in stock at the end and they all spoil (`spoilReason 'nocooler'`, `till.spoiled` equals them, `coolerAfter` all 0); charcoal left equals bags before plus bought minus used and shows in the next week's `inventory()`; fixture `gear.cooler = true` with 20 sausage and 5 butt: an idle event keeps 5 butt and 7 sausage (costliest first, cap 12) and spoils 13 sausage (`spoilReason 'full'`) |
| 16 | **new** season end by the fast path, headless | from week 1, nine weeks of `bookOffer(first)`, `loadUp()`, `settle(3)`, `finishReport()`: week 9 offers are only the finale; after the ninth `finishReport()` loop `seasonEnd`, `season_end` with nine 3s; `seasonEndPreview()` then `startSeason()`: year 2, week 1, `results []`, `rep === max(20, floor(0.75 * rep before))`, stock all 0, charcoal kept, cash kept, loop `week`, `season_start`, `week_start` |
| 17 | **new** names and looks, headless | the W4.4 examples; `setPlayer({ skin: 9, hair: -1, hairColor: 2.5, face: 'x', hat: 3, apron: 5 }, '  Bo  ', '')` returns look `{ skin: 1, hair: 0, hairColor: 1, face: 0, hat: 3, apron: 5 }`, name `'Bo'`, pitName `'Your Pit'`; `randomLook()` twice on one sim differ or are valid, the same seed gives the same sequence, and `sim.rng()`'s next value is the same with or without the `randomLook()` calls |
| 18 | Chrome launched and CDP connected | as K11 (fatal) |
| 19 | page loaded with zero errors | as K11 with `game.version === '0.5.0'` and `'rail' in PitSim.game`, `'sign' in PitSim.game`, `'panel' in PitSim.game` (fatal) |
| 20 | only the four file:// requests | as K11 |
| 21 | sprite list and palette | the W16.2 literal; 123 names; `PALETTE.length 36` with W16.1's four colors at 32 to 35; `COLOR` 35 keys; the K11 step 14 grid checks; `font` frames 40 and 41 non empty; `font_s` 42 frames of 3 by 5; `art.textWidth("'-") === 9`, `art.textWidthS('MARTY') === 19`; `art.lookKey() === '1-0-1-0-1-0'`; for each look key and each index, `setLook` with only that key changed gives a `player_down` frame 0 grid that differs from every other index of that key, uses only legend characters, and keeps 16 by 24 and the frame counts; `setLook(DEFAULT_LOOK)` restores the build grids exactly; `art.LOOK` deep equals the W16.4 tables |
| 22 | canvas scale is an integer | as K11 |
| 23 | canvas is device pixel exact on Android and laptop sizes | as K11 |
| 24 | clipboard: morning, day 1, start cash | K11 step 17, plus `state.loop === 'tutorial'`, `#hud-day` `Day 1`, `#week` hidden (fatal) |
| 25 | controls | as K11 |
| 26 | bought | as K11 (fatal) |
| 27 | gate open | as K11; plus `today.kind === 'tutorial'`, `PitSim.game.rail === null` while the banner shows (fatal) |
| 28 to 33 | fire raised, meat on, piece done, sliced, carried, served | as K11 steps 21 to 26 (fatal) |
| 34 | a served customer sits and a heart fires | as K11 |
| 35 | tutorial walked in order | as K11 step 28 |
| 36 | rest of the day cooked and carried | as K11 |
| 37 | day over | as K11; loop `tutorial`, phase evening, no `client_stars`, `season.results` still `[]` (fatal) |
| 38 | a walk-out with rep down, or the day sold out early | as K11 |
| 39 | till shown | K11 step 32, plus `#next` text `Continue`, `#rep-cooler` and `#rep-charcoal` present with the W15 text for the till's numbers |
| 40 | save key present and valid | raw `v === 4`, `tutorial.done`, `player === null`, `season.week 1`, `results []` |
| 41 | reload persists | reload: loop `creator`, `#creator` visible, `#cr-sub` text `ui.crSubDone`, `#cr-name` value `Pitmaster`, `#cr-pit` value `Your Pit`, cash and charcoal as the till left them (fatal) |
| 42 | **new** names filtered to the allowed set | in `#cr-name` insert `Ana<b>!\u{1F600} Q`: value `Anab Q`, `#cr-name-count` `6/14`; insert 20 letters into an emptied `#cr-pit`: value length 14, counter `14/14`; insert `Marty’s Pit` into an emptied `#cr-pit`: value `Marty's Pit` |
| 43 | **new** creator by real taps | click `cr-skin-3`, `cr-hair-next` once (`cr-hair-val` `CURLY`), `cr-haircolor-1`, `cr-face-next` once (`MUSTACHE`), `cr-hat-next` once (`COWBOY HAT`; from cap), `cr-apron-0`; each tap changes `art.lookKey()` as expected and `aria-pressed` follows; empty `#cr-name` and insert `Marty` (`5/14`), `#cr-pit` holds `Marty's Pit` (`11/14`); `#cr-sign` `.sr` text is `Marty's Pit`; screenshot `creator.png`; click `cr-go`: loop `week`, `state.player` deep equals `{ name: 'Marty', look: { skin: 3, hair: 1, hairColor: 1, face: 1, hat: 2, apron: 0 } }`, `pitName "Marty's Pit"`, `art.lookKey() === '3-1-1-1-2-0'`, the stored save has them (fatal) |
| 44 | **new** name on the sign and the header | `PitSim.game.sign` deep equals `{ text: "MARTY'S PIT", font: 'font', x: 67 + floor((58 - 54) / 2), width: 54 }`; `captureFrame()` holds 10 `font` records on y 5 with x from 69 to 119, whose frames spell `MARTY'S PIT` with the space skipped (the apostrophe is frame 40); `#week-sign` `.sr` text `Marty's Pit`; `#week-h` text `Marty's Pit, Week 1 of 9` |
| 45 | **new** week hub | `#week` visible; `#week-label` `Week 1 of 9`; `#week-when` `Early spring`; `wk-1` labeled `ui.wkNow`, `wk-2` to `wk-8` `ui.wkLater`, `wk-9` `ui.wkFinale`; `offer-birthday`, `offer-picnic`, `offer-yard` in that order with the W15 lines; `book-birthday` `aria-pressed="true"` and text `Booked`; `#go` enabled, `#go-deposit` `ui.depositLine` with 30; `#inv-charcoal` shows the tutorial's leftover bags; `#goal` `Next goal: Second kettle, 90.`; `#len-normal` pressed; `#week` content height at most `2 * innerHeight`; every visible control at least 44 by 44; screenshot `week.png` (fatal) |
| 46 | **new** full week loop by real taps | pick: click `book-picnic` (pressed, `#next-event` shows Church picnic, `ui.pay` 275). Prep: click `card-shop`, `#sheet` visible; click `dec-charcoal` to 0 then `inc-charcoal` 20 times: `#qty-charcoal` `20`, `#have-charcoal` `You have {charcoal}`, `#after-charcoal` `After this: {charcoal + 20} bags`, `#cart` per `ui.cartLine`; screenshot `sheet-shop.png`; click `sheet-back`. Go: click `go`: `deposit { amount: 83 }`, loop `prep`, `PitSim.game.rail` items chicken 10 and butt 10 with `left` 10. Cook by canvas taps (the K11 `goto` helper): pile, kettle 1, select chicken (`chip-chicken`), cooler, kettle 1, wait for `piece_done`, kettle 1, board, table: a `served` with `booked: true` and `price: 0`, rail chicken `left` 9. Report: advance until loop `report` (at most `today.endAt + 5` s): `#till` visible, `#till-h` `Church picnic: done`, one `client_stars`, `#rep-score` stars equal `till.stars`, `#rep-money` rows in W17.4 order, `till.cashAfter === state.cash`, `#rep-charcoal` per `ui.charcoalLeft`; screenshot `report.png`. Next: click `next`: loop `week`, week 2, `wk-1` labeled `ui.wkDone` with the stars (fatal) |
| 47 | **new** inventory rollover | on week 2: `#inv-charcoal` reads `ui.invCharcoal` with the charcoal step 46's report showed, which equals bags before the cook plus 20 minus `till.bags`; `card-shop` then `#have-charcoal` the same number; meat bought for the picnic beyond what was cooked shows as spoiled on step 46's report (no cooler) and the cooler is empty now (`#inv-empty`) |
| 48 | **new** two tap week | on week 2's fresh hub: click `book-` the first offer, then `go`: phase service within one advance, every rail meat has stock covering its rail, `charcoal >= 1`; advance to the report, click `next` |
| 49 | **new** cooler capacity spoilage on the report | reload into a v4 fixture: week 3 of season 1 with two results, `gear.cooler true`, stock 20 sausage and 5 butt, 10 bags, a player; book the Birthday, empty the meat lines in the shop sheet, load up, advance idle to the report: `#rep-spoil` `The cooler holds 12. 13 spoiled.`, `#rep-cooler` reads `In the cooler now: 7 Sausage, 5 Pork butt.` (`MEAT_IDS` order); next week `#inv-cooler` `Cooler 12 of 12`, `aria-valuenow 12` |
| 50 | **new** season end after week 9 | reload into a v4 fixture at week 9 with 8 results: `offer-finale` alone; load up, advance idle to the report: `#till-h` `Season finale: done`, `#next` `See the season`; click: `#season-end` visible, `se-wk-1` to `se-wk-9`, `#se-rep` per `ui.seRep` with `max(20, floor(0.75 * rep))`, `#se-meat`, `#se-charcoal`; screenshot `season-end.png`; click `season-next`: loop `week`, year 2, `#week-label` `Week 1 of 9`, results `[]` in the save |
| 51 | **new** v2.1 save migrates | reload into a v3 sample (day 5, cash 150, charcoal 12, `gear.kettle2`, tutorial done): `#creator` visible with `#cr-sub` `ui.crSub`, prefilled `Pitmaster` and `Your Pit`, `art.lookKey()` default; `#status` reads `Your save was updated for the season.`; click `cr-go`: week 1 hub; the save is `v: 4` with the default look, cash 150, charcoal 12, `gear.kettle2` |
| 52 | decor purchase shows the sprite | K11 step 35 through the hub: a v4 fixture at week 2 with cash 200; `card-gear`, `buy-chair1`; `#seats` text as K11; the chair draws (non ghost) after `sheet-back` and the hub closes for the shot |
| 53 | v1 save migrates | K11 step 36, landing on the creator; then `cr-go` gives the week 1 hub with the v1 values |
| 54 | v2 save loads with the tutorial done | K11 step 37, landing on the creator (no `#tut-clip`, no tutorial) |
| 55 | skip tutorial | clear the save and reload: tutorial morning; click `tut-skip`: one `tutorial_done { skipped: true }`, loop `creator`, `#creator` visible, save `tutorial.done`; clear and reload again; open the yard; Escape; `pause-skip`: still paused, `#pause-skip` gone; `resume`; `gate_soon` and `gate_open` at clock 20 and 30 |
| 56 | burn warning in the page | K11 step 39 on step 55's day |
| 57 | pause and resume | K11 step 40, plus `#pause-look` opens `#creator` with `#cr-back`; a skin tap there changes `art.lookKey()`; `cr-back` returns to `#pause` and restores the saved key |
| 58 | no sprite drawn outside the canvas | as K11 over its captures, plus a booking capture with the rail and the sign |
| 59 | dog never on a station use tile | as K11 |
| 60 | layout and keyboard at 375 by 740 | K11 step 43, plus the hub, a sheet, the creator (inputs at least 44 tall), a report and the season end card from fixtures: no horizontal scroll, every visible button at least 44 by 44 |
| 61 | reduced motion | as K11 |
| 62 | zero console errors across the run | as K11 |

Fatal steps: 1, 18, 19, 24, 26 to 33, 37, 41, 43, 45, 46. `dev/econ.mjs` is not a harness step; the round passes only with its exit code 0 as well (W20).

---

## W20. The econ season bot (`games/pit-sim/dev/econ.mjs`)

> Amended by W22.19, W22.20, W22.21, W22.22 (Overseer's calls) and W24.3 P-7 to P-9.

Kept: the v2.1 day runs (`node games/pit-sim/dev/econ.mjs`, `--days`, `--seed`, `--seeds`, `--decor`) now drive Yard days through the week (skip the tutorial, `setPlayer` the default, `bookOffer('yard')`, `loadUp()`), same bot, same tables.

New: `node games/pit-sim/dev/econ.mjs --season [--seeds 50] [--seasons 5] [--length normal] [--verbose]`. Drives the real `PitSim.createSim` for every week; never edits state.

- Start: `createSim(null, seed)`, `skipTutorial()`, `setPlayer(DEFAULT_LOOK, 'Pitmaster', 'Your Pit')`.
- Three policies by forced stars: **sharp** 5, **steady** 3, **rough** 2.
- Pick: sharp and steady book the highest pay safe offer; rough books the Yard day while `rep < C.DRIVEWAY_REP`, else the highest pay safe offer it can afford with the deposit; week 9 is always the finale.
- Spend, at each week start before booking, in this order, buying only when `cash - price >= reserve` (reserve = next week's highest pay safe offer's prefill cost minus its deposit, plus wages of hired help, plus `DAILY_COSTS`): `kettle2`, `drum`, `tray`, `cooler`, `canopy`, `bigtable`, then the decor in the v2 bot order. Hires: the buddy once the drum is owned and cash is at least 200; the tender once the cooler is owned.
- The cook: a booking settles with `settle(stars)`; a Yard day plays tick by tick with the v2.1 competent bot.
- Milestones per seed, in absolute weeks (`(season - 1) * 9 + week`, printed `S{s}W{w}`): `drum` (first week owned), `drivewayAffordable` (first week start with the drum, `rep >= 34` and cash at least `C.DRIVEWAY_PRICE`), cash at each season end.
- Global rules, per seed: **never stuck**, cash at week start is never under the Birthday's prefill meat cost on an empty cooler two weeks in a row, and rough never ends an event under 0; **never idle**, at a season end no bot holds more than twice the price of the next unbought item of the spend order whose non cash needs are met, checked only while one exists.
- Bands enforced in v3.0 (median over seeds, a milestone passes when its median week is at or before the band): drum by S1W4 (sharp), S1W8 (steady), S2W9 (rough). `drivewayAffordable` is printed against its later bands (sharp S1W9, steady S2W4, rough S3W9) as information only; it is enforced from v3.3.
- Output: one header line, then one line per policy: `policy stars drum band result drivewayAffordable band(info) stuck idle`, then `PASS` or `FAIL` per enforced check; `--verbose` adds a line per seed. Exit 1 when any enforced band or global rule fails.

The Sim builder tunes the W2 starting values until the bot passes and records the run (median weeks per policy, 50 seeds, 5 seasons) under Deviations in `sim.js` and in the hand-off.

---

## W21. Decisions made in this contract (Overseer's calls for the hand-off)

1. `state.loop` carries the seven season screens; `state.phase` keeps the v2 engine meaning, so no v2 rule moves.
2. Offer ids equal their types in v3.0; the DOM ids follow (`offer-birthday`, `book-picnic`).
3. In v3.0 every week 1 to 8 shows Birthday, Church picnic and the Yard day in every fan third: only two booking types exist, so the third slot and the invite stay empty. The slot, dedupe and invite rules are built and tested on a stub list.
4. Week 9 shows only the Season finale (no Yard day), preselected.
5. The first card is the easiest safe offer (fewest flames, then lowest pay), so a new player's two tap week is a Birthday.
6. Offers are not saved; they regenerate from the save's seed, week and week start cash, and the pick is restored by id.
7. The add-on meat is in v3.0 ([S 3.3] applies to every booking); the Menu bonus needs at least one add-on plate served and none burnt.
8. A booked guest who finds the line full waits off canvas and joins when a spot frees; pending guests at last call give up and count as unfed.
9. Booked guests' word of mouth comes only from the star table; the per serve counters skip them.
10. The tip multiplier by third ([S 9]) waits: it would move every tip number in the v2 checks. Proposed for v3.1.
11. The event length setting also sets the Yard day window and length; the tutorial day always runs at Normal.
12. The default look is the v2 pitmaster with the red apron (the creator's first swatch); v2's cream apron is not offered.
13. Four palette entries (`w x y z`) are added for skin tones, using the legend extension D11 reserved; no uppercase legend.
14. The yard sign grows to 62 px and a 3 by 5 font draws names of 12 to 14 characters; the pixel font gains `'` and `-`.
15. The creator also has a Back button when opened from the pause panel; names are prefilled (`Pitmaster`, `Your Pit`) rather than empty.
16. Curly apostrophes typed by a phone keyboard become straight ones instead of being dropped.
17. The season end card applies the carry-overs when Start season is tapped, so a reload on the card shows the same numbers.
18. `sim.settle(stars)` exists for the econ bot and the harness fast path; the game never calls it and no button reaches it.
19. Charcoal keeps its own stepper cap of 200; meat is capped by the cooler plus what the cook can use, and the line says so.
20. The cooler stays a single purchase in v3.0 (12 units); levels 2 and 3 (24, 40) are in `C.COOLER_CAP` for the v3.3 Gear sheet.
21. The robots meta and the `?v=` script query ([S 13.6]) wait for the door step; v3.0 leaves the head and script tags as they are.
22. The report drops the mock's letter grade and shows the 100 point score with the three parts of [S 5.4]; the mock's "Fans" label reads "Word of mouth".
23. No Hiring Day, crew cards, venues, competition or season scaling: those are v3.1 and later.
24. Every answer in W22 (W22.1 to W22.27) is an Overseer's call and goes in the hand-off. The ones a builder must also write under Deviations in their file header: W22.1 (`state.profile` holds the creator data, `state.player` stays the v2 mover), W22.9 (quality counts every burnt piece and the Menu bonus needs an add-on plate served, both overriding [S 5.4] and [S 3.3]), W22.12 (no day gate on the buddy in loop `week`) and any C value moved under W22.18.

---

## W22. Builder questions answered (Overseer's calls)

Each item below is an Overseer's call made on 2026-10-18 to settle a gap or a conflict in this contract. None adds scope. Where an item and an earlier W section disagree, the item wins.

### W22.1 `state.player` vs the creator data (W4.1, W5, W13, W19)

Keep `state.player` as the v2 mover, unchanged (`x, y, px, py, carrying, busy, target, queued, path`; sim.js, game.js, econ.mjs and smoke.mjs keep reading it, and K11 still reads `state.player.carrying`). The creator data moves to a new field, `state.profile: null | { name, look }`. Every place W4, W5, W6, W13, W15 and W17 says `player` meaning the profile means `state.profile`: the `player === null` tests, `look()`, `hostSays` `{name}` = `state.profile.name`, and `setPlayer` sets `state.profile`. The save key stays `player` exactly as W13.1 shows, and `serialize` / `validateSave` map it to and from `state.profile`. The method name `setPlayer` and the event `player_set` stay. W19 step 43 reads `state.profile` (deep equal to `{ name, look }`). Recorded in W21 item 24; each builder writes it under Deviations.

### W22.2 Event order on every transition into a week (W5.1, W14, W19 step 14)

One fixed order: `player_set` or `season_start` (when the transition has one), then `week_start { year, week }`, then `offers_ready { year, week, ids }`, then `save_wanted` (reason `'player'` from `setPlayer`, `'week'` from `finishReport`, `'season'` from `startSeason`). `beginMorning`'s `rain` and `broke` events come before all of these. `week_start` is emitted inside the transition, before `startWeek`'s `offers_ready`. When `createSim` loads a save into loop `'week'`, it emits `offers_ready` only: no `week_start`, no `booking_picked` and no `save_wanted`, so a reload never re-announces the week in `#live`.

### W22.3 `weekCash` on load (W5.1, W13.3)

`startWeek` takes an optional `weekCash` override. Transitions pass nothing, so `weekCash = cash`. `createSim` passes the saved `weekCash` to both `genOffers` and `season.weekCash`. After that, `createSim` restores `pick` and `addon` silently, only when legal: the pick must be in the regenerated offers; the add-on must not be on that menu, must be cookable, and the pick must not be the Yard day. It then sets `cart = prefill()` for the restored pick. No events fire.

### W22.4 When the week's Broke test runs (W6)

When the next loop is `'week'`, `beginMorning` skips its broke test and its `'broke'` emit (the rain roll still draws first, so rng order is unchanged). `startWeek` runs `brokeTest` at its end with `cash + max(offer.deposit)`. It sets `state.broke` and emits `'broke'` once if the test is true. The tutorial loop keeps v2.1 behavior. In v3.0 this never fires, because a Birthday or the finale is always on the phone.

### W22.5 `serialize()` mid-event (W13.2)

In loops `'prep'` and `'cook'`, `serialize` writes `cash - today.deposit`, floored at 0, and keeps the committed stock and charcoal. The week number and `weekCash` stay as they are. A reload therefore lands on the same week's hub with the goods in the cooler and the deposit not yet paid; it is credited again only at the next `loadUp`. No new save key is added.

### W22.6 Booked order roll: the `any` flags (W7.2)

Each branch's `any` flag (`tableAny`, `cookAny`, `stockAny`, `handsAny`) is computed after the zeroing of zero-ticket meats. A branch whose weights are all 0 counts as empty, and the roll falls to the next branch. Only when every branch is empty does the most-tickets fallback apply (ties go in `MEAT_IDS` order). Both rng draws, `rBranch` and `rWeight`, are always taken, in the W7.2 order (patience, branch, weight), even when the fallback decides the meat. The order is never null, so a booked guest never walks past. Example: a table holding only off-rail ribs from cooler leftovers is an empty table branch.

### W22.7 Served counters and the `client_stars` payload (W7.3, W8.2, W14)

`today.served` and `stats.served` increment for booked guests exactly as in v2, alongside `today.fed`. `today.revenue` stays 0 for booked guests. In `client_stars`, `pay = Math.round(fee * (PAY_BASE + PAY_PER_STAR * stars))`, the total star pay including the deposit, which matches the report's "Fee at N stars" row. `bonus = menuBonus`. Payload: `{ stars, score, fed, booked, pay, bonus }`.

### W22.8 Walk-outs on a booking report (W7.3, W17.4)

On a booking report, `{w}` in "Guests fed {f} of {b}. {w} walked out." is `today.walkouts + today.close`, so fed + w + missed always equals booked. The Yard day and tutorial reports keep v2's walkouts number.

### W22.9 Quality and the Menu bonus vs [S 5.4] and [S 3.3] (W8.1, W8.2)

Ship this contract's versions of both rules, overriding [S]:

- (a) Quality: `today.burnt` counts every burnt piece, including pieces left on the grate. The [S] wording (served or thrown out) would make a burnt piece left on the grate cost nothing.
- (b) Menu bonus: needs `addonServed >= 1 && addonBurnt === 0`. The [S] wording (no burnt add-on plate served) is always true, because burnt meat can't be plated, so it would be free money.

An unfed booked guest, whether walked out, missed or closed out, counts as 60 s of wait, a superset of [S]'s "a walk-out counts as 60 s". Recorded in W21 item 24; the sim.js builder writes both under Deviations as Overseer's calls overriding [S].

### W22.10 Rain on a booking week (W6, [S 3.3])

Keep the rain roll in `beginMorning` so rng order is unchanged. `loadUp()` for a booking sets `state.rain = false` and emits nothing. Rain only affects the Yard day (`spawnInterval`) and the canopy rule. game.js phrases the morning rain line as Yard-day-only.

### W22.11 Gear bought in the week regenerates offers when the result changes (W3.4, W5.2)

After a gear purchase in loop `'week'`, regenerate with `genOffers` using the same inputs and the stored `weekCash`. If the new list deep-differs from the current one (in v3.0 only the finale plus the drum: 475 becomes 560 with brisket), replace the offers, keep the pick by id, keep the add-on if still legal, set `cart = prefill()`, and emit `offers_ready`. Otherwise leave the offers and the hand-edited cart alone. Decor purchases never regenerate.

### W22.12 The buddy's day gate (W5.2)

Keep `hire('buddy')`'s day >= 2 rule ("From day 2.") only in loop `'tutorial'`, where K11 tests it. In loop `'week'` the buddy has no day gate. The tender keeps its drum need. The sim.js builder records it as a Deviation.

### W22.13 `genOffers` on a stub `types` list (W3.3, W3.4, W19 step 12)

`Offer.label = row.label`; `Offer.venue` and `Offer.icon` also come from the row. Fisher-Yates runs for i = n-1 down to 1, with no draw at i = 0, so a single element takes zero draws. Every tie (equal fee in the safe swap or the invite, equal difficulty and pay in the display order) breaks by the row's index in the `types` input. The low-cash Birthday counts against the slots. Week 9 takes exactly one host draw.

### W22.14 `prefill()` affordability (W10.3)

For the Yard day, "the spare" is both the 1.1 factor and the +1: without it, plates = `expectedCrowd()` minus the plates in stock, then the same unit and split rules apply. For a booking the spare is `SPARE_FRAC`. The phases are strictly sequential: (1) drop the spare; (2) remove meat one unit at a time from the costliest qualifying line until one meat unit is left in total; (3) remove bags down to `max(0, 1 - charcoal)`. If it still doesn't fit, stop there, and `canLoadUp` reports `goCash`.

### W22.15 `validateSave` results list (W13.3)

Walk the input array in order. Keep entries that are plain objects with a type in `BOOKING_IDS`. Drop a `'finale'` that would land anywhere except position 9. Stop at 9 kept entries; later entries shift up. The ninth entry may be any valid type; it is not forced to be a finale, so the harness's "9 results with week 2 gives week 9" fixture works with any types. Then apply the week consistency rule.

### W22.16 Tutorial strand fixes, details (W12)

- (a) The `full` / `fullGrate` row lives in `tutorialRow()`, so it applies only on unlatched steps, checked right after `'customer'` and before the cold-kettle rows. The latched steps (`customer`, `seated`, `end`) are unchanged.
- (b) The W12.2 refill runs at the start of `checkTutorial` only, and `interact()` calls `checkTutorial` right after a trash, which covers the button-only strand. The refill does not pre-empt the day ending: if the yard is sold out at clock >= 30, the v2.1 day still ends.
- (c) A refilled sausage adding `foodCost` when put on the grate is fine. `foodCost` is information only and is not part of net. No cash moves and rng is never touched.

### W22.17 Actions outside their loops (W5.2)

`canOpen()` returns `{ ok: false, reason: '' }` outside loop `'tutorial'`, and `openGate()` returns `{ ok: false, message: '' }` as W5.2 says. `buy()`, `hire()` and `sell()` check the loop first and return `{ ok: false, message: '' }` (hire: `hired` = the current flag) in `'creator'`, `'seasonEnd'`, `'prep'`, `'cook'` and `'report'`. The creator's leftover day 1 cart is ignored and replaced by `prefill()` at `startWeek`.

### W22.18 Tunable C values vs harness literals (W2, W19 steps 12 to 15)

The harness computes every expectation in steps 12 to 15 (fees 100 and 275, deposits 30 and 83, payRest 30, rep 20 to 15, pay rests 82, 137 and 192) from `C` with the W3.2, W8 and W9 formulas, and also prints the literal when `C` holds its starting value. For this round the Sim builder tunes only, in this order: `STAR_FANS[1]` (the 2-star move), `LOW_CASH_BIRTHDAY`, `SPARE_FRAC`, `BAGS_PER_COOKER`, then the `ARRIVAL_*` keys. `FEE_MULT`, `FEE_ROUND`, `DEPOSIT_FRAC`, `PAY_BASE`, `PAY_PER_STAR`, the `SCORE_*` keys and `STAR_EDGES` stay at their contract values unless a band cannot pass any other way; if one moves, it goes in the hand-off. The hand estimate already passes at the starting values: sharp owns the drum at about S1W3 and steady at about S1W4.

### W22.19 The econ season bot's week sequence (W20)

"Next week" in the reserve rule means the event about to be booked this week. The bot uses public methods only, in this order each week:

1. `bookOffer(policy pick)` and read `P = cartTotal()`; reserve = `max(0, P - pick.deposit)` + wages of hires + `DAILY_COSTS`.
2. Empty every cart line with `buy(id, -999)`.
3. Walk the spend order, buying each item when `cash - price >= reserve` and skipping items it can't afford rather than stopping (continue, not break). Then hires per W20, each called once because `hire()` toggles.
4. `bookOffer(pick)` again to re-prefill.
5. `loadUp()`.
6. `settle(stars)`, or tick the Yard day with the competent bot.
7. `finishReport()`.

### W22.20 Measuring "never idle" (W20)

Measure at each season boundary, right after the spend pass at week 1 of the next season. Idle means `(cash - reserve) > 2 x` the price of the earliest unbought spend-order item whose non-cash needs are met, checked only while such an item exists. Run 5 seasons plus that final pass. In v3.0 this mostly guards the bot's own logic; it gets real bite in v3.3 when the Driveway becomes buyable.

### W22.21 Detecting "rough never ends an event under 0" (W20)

`endDay` clamps cash at `CASH_FLOOR` 0, so the bot computes cash before the clamp: cash right after `loadUp` (deposit in, cart out), plus payRest, menuBonus, tips, seat tips and Yard day revenue, minus wages and `DAILY_COSTS`. It reads these from the till fields and checks the result is >= 0. "Never stuck" uses the Birthday's prefill meat cost at the current length on an empty cooler (40 at Normal), compared with cash at week start, deposit excluded.

### W22.22 The v2.1 day runs (`--days N`) across week 9 and the season end (W20)

In week 9 the day bot books the finale (`offers[0]`) and plays it tick by tick with the same competent bot, which cooks the prefilled rail meats. Its row goes in the table with a `finale` tag. On `seasonEnd` it calls `startSeason()` and carries on. N counts every event played. Yard days remain the only events in weeks 1 to 8 of the day runs.

### W22.23 `goal()` and word of mouth 34 (W5.2)

`goal()`'s return shape does not change: it still returns `{ id, label, price }` (the driveway: "Driveway pop-up", 400). The rep need lives only in `CATALOG.driveway.needs { gear: 'drum', rep: 34 }` and its `needsText`. `buy('driveway')` returns "Not built yet."

### W22.24 Pit name and host on the report (W17.4, [S 8], [S 19.2])

Leave `#till-h`'s text as it is (`{label}: done`, which the harness checks exactly). Above it add `rep-top`, a header row like the mock: `hudWeek`, the pit name in the UI font (with a `.sr` span), and coin plus cash. Under `till-h` on booking reports add `rep-meta`: `ui.host` with `Till.host` and `venue.backyard` as two spans, no middle dot. The mock's hero band becomes the offer cards' CSS sky-over-lawn band, about 96 px tall, with `ev_{type}` at 4x. No church building art, no letter grade, no crew block. Word of mouth sits in the box to the right of Money at 375 px or wider and stacks below it when narrower.

### W22.25 If `#week` overflows 2 x innerHeight at 375 by 812 (W17.2, W19 step 45)

Shrink in this order until it fits: (1) the offer cards' art band from 72 px to 48 px; (2) the Yard day card becomes one row (icon, label, "Walk-ins", "No fee", Book); (3) the event length toggle, Controls and New game share one row of three 44 px buttons; (4) the Inventory card shows the meat lines in two columns. Never drop a section or go under 44 px controls.

### W22.26 Copy scans (W15, [S 14])

- (a) A generated data list of meats and counts that comes out as exactly three items (in `say.open`, the cooler line or the menu card, for example a Birthday plus an add-on) is not the rhetorical triad. Allow it in generated text only; authored strings still follow the rule.
- (b) Keep the exact W15 text of `ui.coolerRoom` and `ui.coolerFull` in v3.0, including "The cooler holds 0 overnight" with no cooler, since W19 step 15 tests it and the hub's `invNoCooler` line explains the no-cooler case. Noted for a copy pass in v3.1.

### W22.27 `settle(stars)` details (W8.4)

Clearing covers grates, board stacks, board slicing, table spots, every customer, the player's busy flag, and whatever the player, buddy and tender are carrying, with no waste rows. In `'prep'` it skips `gate_soon`, `gate_open` and `last_call` and goes straight to the W7.3 end of event: loop `'report'`, phase `'evening'`, events `client_stars`, `spoiled` (if any), `day_over`, `save_wanted`. `tickCount` and the clock stay where they were.

---

## W23. Integration (v3.0 integrator's calls, 2026-10-18)

The four builds were joined and run together: `node --check` on every script, the harness on phone, desktop and seed 7, the econ bot in both modes, and the new screens shot next to the mocks. These are the seams fixed and the calls made doing it. Each is also written in the header of the file it touched.

- **I-1. `booking_picked` payload (W14).** The event carries `{ id, booking }` instead of `{ id, type }`. The sim's `emit()` builds `{ type, ...payload }`, so a payload key named `type` replaced the event type and every listener saw an event typed `'picnic'` or `'birthday'`. In v3.0 `id` equals `booking`. `game.js` dropped its four-type workaround (its deviation 42) and the harness checks the event in step 14.
- **I-2. The econ season bot's decor stage (W20, W22.19).** The bot walks the six gear rows of the spend order with W22.19's continue rule and opens the decor stage only once all six are owned, as the v2 bot bought decor only once gear was covered ([S 10.3]'s upgrade order lists no decor). Read literally, W20 and W22.19 had the sharp bot buy every decor piece while the drum was out of reach, and its drum median landed at S1W6 against the S1W4 band. No `C` value moved. Results: [S 10.4].
- **I-3. Offer menus in `MEAT_IDS` order (W3.3).** `genOffers` sorts a row's menu into `MEAT_IDS` order, which W3.3 pins for every `Offer`. The harness reference model copied a stub row's menu as listed (the stretch stub lists brisket first), so harness step 12 failed on identical looking arrays. The reference now sorts too.
- **I-4. Phone layout (W17.2, W17.4, W17.5, W18).** Under 900 px, `#panels` drops its 8 px padding while a `.hub` section or `#till` is open, and that section fills the screen height with no border and no top margin, so the season screens and the report run edge to edge like the mocks. The v2 sibling margin had also added 8 px above every hub. Desktop keeps the 320 px side column; there, the pill labels wrap instead of cutting "Word of mouth" to an ellipsis, and the season strip's five columns are `minmax(0, 1fr)` so a Yard day tile is as wide as a starred one.
- **I-5. Builder conflicts settled as built.** (a) W22.25 step 2 against W19 step 45: the one-row Yard day card keeps every W15 line as wrapping items, because step 45 checks them and W22.25 says never drop a section. (b) W13.3: the save notice on `#status` stops when the yard opens, so the gate countdown shows (step 54). (c) W17.5's 420 px rule puts the creator's row labels above the controls on every phone, unlike the mock's side labels, so six 44 px swatches fit.

**Run at the end of integration:** harness 62 of 62 on phone (375 by 812), desktop and `--seed 7`, zero console errors; `econ.mjs --season` exit 0; `econ.mjs` (day runs) exit 0; the Sim builder's self-test 850 of 850 and the Art builder's 1749 checks still pass.

**For the Overseer (not changed here):**

1. Big bookings lose guests at the gate. The line holds 3 and pending guests give up at last call (W7.2, W7.3, W21 item 8). A competent bot fed 24 to 26 of 40 at the finale with two kettles. Check it first in Joel's playtest; the levers are `queueSpotCount`, `ARRIVAL_SPAN` and `ARRIVAL_CURVE`.
2. After the drum, v3.0 has nothing to buy, so cash piles up (sharp 7354 by season 5). The Driveway in v3.3 and the v3.1 payroll are the sinks.
3. Rough reaches the drum at S1W9 against an S2W9 band, because Yard days move word of mouth fast.
4. If I-2 is not the reading wanted, the other way to put sharp back in its band is `FEE_MULT`, which also speeds steady and rough.
5. `ui.pickOne` ("Pick one") shows in week 9, where the finale is the only card; `ui.coolerRoom` reads "The cooler holds 0 overnight" with no cooler (W22.26 b). Both are for the v3.1 copy pass.

---

## W24. Playtest round 1 (2026-10-19)

The first playtest of the integrated v3.0 build (a fresh save played week 1 to week 9 on a 375 by 812 phone, a real time bot and the screen shots) came back with 37 findings, many of them the same problem seen twice. The fixes below are the round's. Each is an Overseer's call for the hand-off unless it says it only follows a W rule, and each is also written in the header of the file it touched (sim.js P-1 to P-6, game.js P-10 to P-17, econ.mjs P-7 to P-9, smoke.mjs P-1 to P-6). Where this section and an earlier W section disagree, this section wins.

### W24.1 Rules of play (sim.js)

- **P-1. Grate time makes a booking a stretch (W3.2, W3.4).** `offerFields` adds a capacity test after `needsFor`: slot seconds = the sum over the rail meats of `ceil(rail[m] / MEATS[m].plates) * MEATS[m].slots * MEATS[m].cook`, against `(KETTLE_SLOTS per owned kettle + DRUM_SLOTS with the drum) * (C.GATE_OPENS + window) * C.SAFE_LOAD`. New `C.SAFE_LOAD: 0.8`. When it does not fit, `needs` is `ui.needsKettle2` ("Needs a second kettle.") if a second kettle would make it fit, else `ui.needsDrum` ("Needs the drum smoker.") if the drum would; `safe` is false, so the W3.4 order and the W5.1 Load up and go refusal apply as written for v3.3 stretch offers. The Season finale and the Yard day are exempt. Numbers at Normal: the Church picnic needs 270 against 176 on one kettle (stretch) and 352 on two (safe); the Birthday needs 108 (safe). The picnic is a stretch on one kettle and safe on two at every length. A gear buy already regenerates the offers (W22.11), so buying the kettle turns the picked picnic safe. Playtest: 10 of 20 fed on one kettle, 8 who "never got in line".
- **P-2. Client stars and pay (W8.1, W8.2).** `scoreEvent` takes `cold` (new `today.cold`: booked plates served `C.HOT_PLATE_SECONDS` (30) or more after they were sliced) and new `C.COLD_PENALTY: 2`. Quality is `max(0, SCORE_QUALITY - BURNT_PENALTY * burnt - OFFMENU_PENALTY * offMenu - COLD_PENALTY * cold) * min(1, fed / booked)`, 0 with nobody booked; `parts.quality` is rounded. `PAY_BASE 0.3, PAY_PER_STAR 0.14` (were 0.5 and 0.1): 1 star pays 44 percent of the fee, 2 stars 58, 3 stars 72, 4 stars 86, 5 stars 100. The playtest proposed 0.2 and 0.16; at those the season bot's rough policy ended an event under 0 in 7 of 50 seeds (a Yard day with the fire tender's wage on low cash), so the gentler pair ships. Results: a Birthday cooked whole before the gate and served cold scores 80 (4 stars), not 100; half the picnic fed scores about 51 (2 stars, 160 of 275 in all) instead of 61 (3 stars, 220); nobody fed scores 0. `settle(stars)` reports `parts.quality` scaled by the share fed. The W8.1 harness table now reads: all fed 100, 5 stars; nobody fed 0, 1 star; 12 of 12 at 40 s with 1 burnt 86, 4 stars; 15 of 20 at 30 s 71, 3 stars; 12 of 20 at 45 s with 2 burnt 48, 2 stars; all fed with 5 cold plates 90, 5 stars; with 6 cold 88, 4 stars. Pay rests at 1, 3 and 5 stars for fee 275 and deposit 83: 38, 115, 192 (121, 198, 275 in all).
- **P-3. Take today adds up (W4.2, W17.4).** `Till.net` for a booking is `deposit + payRest + menuBonus + tips + seatTips - (foodCost + rawWaste) - bags * CHARCOAL_PRICE - spoilCost - wages - DAILY_COSTS`, computed after spoilage. New `today.rawWaste`: raw meat thrown in the trash, which never reached the grate and so was never in `foodCost`. Pieces left on the grate and plates thrown out are already inside `foodCost`. The Yard day and the tutorial keep the v2 formula (their tills keep the v2.1 line that the shop paid for food and charcoal). `ui.takeDetail` is "pay and tips after what the cook used". Playtest: "Take today +127" when cash rose 47.
- **P-4. A gear buy may lean on the deposit (W5.2).** In loop `'week'` a gear or decor buy needs `price <= cash` and `cash + deposit of the picked offer - cartTotal() >= price`, so cash never goes under 0 at the purchase and `canLoadUp` still guards the cart. From cash 111 with the picnic picked, the second kettle (90) can be bought and the picnic loaded (21 + 83 covers the 90 cart). Without it P-1 would block the only interesting week 1 choice.
- **P-5. No spare without a cooler (W10.3, W22.14).** `prefill()` adds the spare (`SPARE_FRAC`, and the Yard day's 1.1 and +1) only while `coolerCap() > 0`. Without a cooler the spare unit of each meat spoiled every night, even after a perfect cook ("Spoiled tonight 1 Sausage, 1 Chicken thighs").
- **P-6. The tutorial's full grate (W12.1, W15).** `STRINGS.tutorial.full` is "The grate is full. Put it back in the cooler." (two banner lines; the old text needed three and was cut at "TAP THROW") and the `full` target is `'cooler'`, where `#act` reads "Put {label} back": nothing is wasted, and the banner matches the button. W12.1's "or the board's trash" is replaced by the cooler; `fullGrate` is unchanged (it already fit two lines). Pending guests turned away by the sold out rule set `today.soldOutMiss`, so the report can say why they missed.

### W24.2 Screens (game.js, index.html)

- **P-10. The booking report (W17.4, W22.24).** Hero band about 150 px: the event label in cream at 2x over a large gold "DONE" (the last word of `ui.reportH`, up to 6x), and a row of v2 guests, the event icon and the buddy at 3x on the grass; `#till-h` keeps the exact W15 title as its words. `rep-parts` is titled `ui.howWent` ("How it went"). Money rows that would read zero or none are left out (wages, seat tips, spoiled, thrown out, left on the grate, burnt); Fee, Deposit, Tips, Food cost, Charcoal used, Daily costs, Take today and Cash always show. The detail sits on the label line with a dotted leader, rows 3 px apart. Food cost shows `foodCost + rawWaste`; thrown out and left on the grate show as information rows with "counted in food cost". The Cash row's detail is `ui.cashFrom` ("{a} at week start", `season.weekCash`). `rep-result` adds `ui.missedLine` ("{n} gave up at the gate. The line was full until last call.") or `ui.missedOutLine` ("{n} gave up at the gate. The food ran out.") and `ui.coldLine` / `ui.coldLineOne`. The word of mouth box shows the change, the new number in the UI font and `ui.fansWas` ("was {a}"); `ui.fansLine` stays as `.sr` text.
- **P-11. Pick, not Book (W15, W17.2).** `ui.book` "Pick", `ui.booked` "Picked", `ui.bookAria` "Pick the {label}": the commitment is Load up and go, and "Pick one" already heads the cards. The picked button turns gold with dark words and the green check badge; the picked card's frame is gold.
- **P-12. Inventory with no cooler (W17.2).** The `inv-cooler` meter is hidden when the cap is 0 and `ui.invNoCooler` always shows then (muted while the cooler is empty, red when meat would spoil). The charcoal pile icon draws at 2x.
- **P-13. Signs.** The pit name on `#week-sign` and `#se-pit` is bold UI text at 3x, falling back to bold 2x when 3x would not fit the sign's share of the panel; `.sign` is at least 44 px tall.
- **P-14. Hub tiles (partly applied).** A chevron after each tile title, `.l1` 15 px and `.l2` 12 px, and the Gear window shows the cooker owned (the drum, or one or two kettles) with "Next: ..." still in the second line. The windows stay 38 px and the offer bands keep their size: with 72 px windows and 84 px bands the fresh week 1 hub measured 1687 px at every fit level against the 1624 px limit of [S 2.3] and W19 step 45. As shipped it measures 1598 px at fit level 2.
- **P-15. Creator preview (W17.5, game.js deviation 38).** The backyard patch is 64 by 56 (4 by 3.5 tiles) drawn at up to 5x, 320 by 280 on a 375 phone (was 96 by 64 at up to 3x, the pitmaster about 70 px tall). Random stays under the preview.
- **P-16. Shop sheet (W17.3).** A coin before each price, a dark box around each count, and on the charcoal row `inc5-charcoal` (`ui.inc5` "+5", `aria-label` `ui.inc5Aria` "Five more bags"), so 20 bags take four taps. The tutorial clipboard's rows are unchanged.
- **P-17. HUD (W17.1).** `#hud-rep` reads a heart and the number in every season loop (stars now mean client stars); the tutorial day keeps the v2.1 stars. `#title` stays YOUR PIT (the game's name).
- **Scrolling.** `#panels > section` is `position: relative`, so each section is the containing block of its `.sr` spans and clips them; on phones `#panels` is also `overflow: hidden` while a hub section or the report is open. The hub and the report scroll in one scroller and the dark backdrop no longer shows under the hub (`#panels` scrollHeight 812 of 812).

New W15 keys (exact text): `ui.needsKettle2`, `ui.needsDrum`, `ui.missedOutLine`, `ui.howWent`, `ui.coldLine` ("{n} plates sat too long before they went out."), `ui.coldLineOne` ("1 plate sat too long before it went out."), `ui.counted`, `ui.cashFrom`, `ui.fansWas`, `ui.inc5`, `ui.inc5Aria`. Changed: `tutorial.full`, `ui.book`, `ui.booked`, `ui.bookAria`, `ui.missedLine`, `ui.takeDetail`. New C keys: `SAFE_LOAD 0.8`, `COLD_PENALTY 2`. Changed: `PAY_BASE 0.3`, `PAY_PER_STAR 0.14`. New Today fields: `cold`, `rawWaste`, `soldOutMiss` (also on `Till`).

### W24.3 The econ season bot (econ.mjs, W20, W22.19)

- **P-7.** The gear stage buys the next item of the order only and stops at the first gear row it cannot afford ([S 10.3] "buys the next item on a fixed upgrade order"); the decor stage keeps W22.19's continue rule and opens in the same pass that buys the last gear row. With P-1, week 1 is a Birthday and the continue rule spent the drum money on the tray, cooler and canopy (sharp drum median S1W7).
- **P-8.** After the spend pass the bot picks again (a gear buy can turn a stretch offer safe, W22.11) and keeps the new pick when `canLoadUp()` passes, else the first pick.
- **P-9.** "Never stuck" uses the Birthday's prefill meat cost on an empty cooler as `prefill()` now builds it with no cooler: 30 at Normal (was 40).

Run (`node games/pit-sim/dev/econ.mjs --season`, 50 seeds, 5 seasons, Normal), exit 0:

| Policy | Stars | Owns the drum (median) | Band | Driveway affordable (info until v3.3) | Band | Stuck | Idle |
|---|---|---|---|---|---|---|---|
| Sharp | 5 | S1W4 | S1W4 | S1W9 | S1W9 | 0 of 50 | 0 of 50 |
| Steady | 3 | S1W5 | S1W8 | S2W7 | S2W4 | 0 of 50 | 0 of 50 |
| Rough | 2 | S1W7 | S2W9 | S4W7 | S3W9 | 0 of 50 | 0 of 50 |

Rough never ended an event under 0. Median cash at the season ends: sharp 885, 2473, 4061, 5649, 7237; steady 301, 746, 1361, 1976, 2591; rough 151, 198, 356, 545, 745. The day runs (`econ.mjs`, seeds 1 to 8) exit 0 and buy the second kettle on event 3 or 4. Long length passes every enforced check. Short (fees 65 and 195) misses sharp's drum band by a week (S1W5) and puts rough under 0 in 1 seed; with the old pay values Short also missed, by the same week and in 2 seeds, so it is not this round's pay change.

### W24.4 Harness (smoke.mjs)

Step 5 carries the W24 strings and C keys; step 11 (a) expects the cooler and "Put Sausage back"; step 12's reference model has the P-1 test and asserts the picnic's Needs line at every length; step 13 has the W24.1 table and pay literals and buys the second kettle from cash 111 with the picnic picked (P-4); step 14's literals are score 0 and rest 14 for the idle Birthday, checks the P-3 net, and checks no whole spare unit without a cooler; step 21 checks every banner text wraps to two 164 px lines (the clipboard's open text excepted); step 46 checks the one kettle picnic is a stretch (`#go` disabled, `#go-why` and the card read `ui.needsKettle2`), then plays the week as a Birthday with the 20 bags bought by four taps on `inc5-charcoal`. Phone and desktop runs: 62 of 62, zero console errors.

### W24.5 Not applied, and why

1. **Headcount jitter per week** (finding: the same Birthday 12/100 and picnic 20/275 every week). Variety within a booking type is v3.2's season scaling and difficulty swing (picky and easy hosts, [S 3.3]) and v3.3's new types and choice cards ("the host wants more brisket"). W21 item 3 already accepted the same three cards in v3.0. It would also move the generator literals and the P-1 classes (a 22 guest picnic needs the drum).
2. **Tip multiplier by fan third, and a notice when a third is crossed.** W9 and W21 item 10 put the multiplier in v3.1; with two booking types the third's offer slot stays empty until v3.3. A notice that promises tips or calls from a later build would be untrue in v3.0.
3. **Taller hub tile windows (72 px) and offer bands with people (84 px).** They break the two screen hub ([S 2.3], W19 step 45); see P-14.
4. **Press and hold on the steppers.** The +5 button covers the 20 bag case; hold to repeat is a later polish.
5. **Birthday headcount or patience retune, shorter pre-gate prep.** P-2's cold plates make cooking everything before the gate cost a star, which fills the idle half of the cook without moving the [S 3.3] table or W7.1's timings.

### W24.6 For the Overseer

1. The driveway affordable medians (information until v3.3) are late for steady (S2W7 against S2W4) and rough (S4W7 against S3W9) at the new pay. The v3.1 payroll and the v3.3 Driveway tuning should look at `PAY_BASE`, `PAY_PER_STAR` and `FEE_MULT` together.
2. The Season finale is still exempt from P-1 (it is week 9's only offer); on two kettles 40 guests still overrun the grate, as W23 item 1 said.
3. Short length misses sharp's drum band by a week and has one rough seed under 0 (W24.3), as it did before this round.

---

## W25. Playtest round 2 (2026-10-19)

The second playtest of v3.0 (a fresh save on a 375 by 812 phone, a real time bot, the screen shots and a design read against the mocks) came back with 36 findings, about half of them the same problem seen twice. The fixes below are the round's. Each is an Overseer's call for the hand-off unless it says it only follows a W rule, and each is written in the header of the file it touched (sim.js R-1 to R-5, game.js R-1 to R-15, smoke.mjs R-1 to R-7, econ.mjs R-1). Where this section and an earlier W section disagree, this section wins.

### W25.1 Rules of play (sim.js)

- **R-1. `sim.canBuy(id)` (W5.2, W24 P-4).** The P-4 gear and decor rule as a pure check: `{ ok, message, left }`, with `left = cash + picked deposit - cartTotal() - price` and ok when `price <= cash` and `left >= 0` (messages `Owned`, the row's needsText, `Not enough cash`, or '' outside the morning shop). `buy()` runs it. game.js greys Buy and words "Leaves N" from it, so the week 1 play (cash 103, the picnic picked, a cart of 70 to 82) shows an enabled Buy on the second kettle. W5.1's method list gains `canBuy`.
- **R-2. The board (D2 values replaced).** `C.BOARD_STACKS 5` (one per meat; was 4) and `C.BOARD_STACK 14` (two of the largest piece; was 8). A slice joins a stack of its meat with room for every plate, else opens a new stack while one is free, so a second pork butt (5 onto the first butt's 4) never leaves a cooked butt stuck in the hands. With no room the button reads "Board is full. Use the trash" (it was "Board is full"; the finding's "Take plates to the table first" cannot be done with a cooked piece in hand). game.js draws at most `BOARD_DRAW_MAX` 8 plates a stack and puts a fifth stack in the middle of the board.
- **R-3. The Season finale fits the grate ([S 15] v3.0 row amended).** Its headcount is the largest, up to the row's 40 at the length, whose rail fits the owned cookers at `SAFE_LOAD` by the P-1 test (`slotSeconds` against `grateSeconds`); never fewer than one guest a meat. Normal: 9 on one kettle (fee 105), 25 on two (295), 40 with the drum (560, unchanged). Short: 4, 23, 28. Long: 16, 33, 52. The fee follows the [S 3.3] formula. W22.11's regeneration now also runs on the second kettle in week 9. `GOAL_ORDER` is kettle2, drum, buddy, bigtable, driveway (the drum was fourth), so Pit news points at the drum once the second kettle is owned. Played tick by tick, the day run's competent bot fed 22 of 25 at the two kettle finale (24 to 26 of 40 before, W23 item 1).
- **R-4. Till fields (W4.2).** `gearSpent` and `gearBought` (gear and decor bought since the morning opened, kept in createSim and never saved) and `cashStart` (`season.weekCash`, or the cash the tutorial morning opened with). A reload in the middle of a week forgets `gearBought`; the stock row below then carries that gear, and the rows still add up.
- **R-5. `BAGS_PER_COOKER` 6 (was 5), a Normal cook's worth.** `prefill()` scales it by the length's seconds, rounded up: 5 a cooker at Short, 6 at Normal, 8 at Long. Without the scaling, 6 put Short's sharp drum median at S1W6 and steady's at S1W9.
- **R-8 (sim part).** `coolerFullMessage()` reads `ui.coolerFullNone` with no cooler (W22.26 (b)'s v3.1 copy pass, taken now).

### W25.2 Screens (game.js, index.html)

- **R-4. Report rows that reach Cash.** Booking report: after Take today, `ui.rowGear` "Gear bought" (detail: the items) and one stock row, `cashAfter - cashStart - net + gearSpent`: `ui.rowKept` "Kept in the pile and cooler" when negative, `ui.rowDrawn` "Used from earlier stock" when positive, none at 0. Week start + Take + gear + stock = Cash on every report (the playtest's week 1: 103 + 95 - 32 = 166; week 2: 166 + 27 - 90 + 12 = 115). The tutorial and Yard day tills keep every v2.1 label, show Food cost, Charcoal used, Spoiled overnight, Thrown out and Left on the grate as information rows (no minus), and add Gear bought and `ui.rowShop` "Paid at the shop" (`cashStart + net - gearSpent - cashAfter`) above Cash. The Yard day's Cash names the week start.
- **R-5.** The booking and Yard day reports drop the New game button (the hub and the pause panel keep it); the tutorial till keeps `#till-new`.
- **R-6.** From season 2, `#week-h` reads `ui.weekOfYear` "Season {y}, week {w} of 9" and `#week-when` reads `ui.seasonWhen` "Season {y}, {when}". `#week-label` stays `ui.weekOf`.
- **R-7.** The Next event card adds `#next-hint`, `ui.mixHint` "Tip: cook one {big} at a time and keep {small} on the other grate, so plates are ready at the gate.", when the picked rail has a two slot meat and a one slot meat (the picnic and the finale, never the Birthday).
- **R-8.** `.pick-one` shows only over two or more cards. The shop line with no cooler reads `ui.coolerNone` "No cooler. This cook can use about {e} more." or `ui.coolerFullNone`.
- **R-9.** At 1 or 2 stars the hero reads `ui.reportHLow` "{label}: over" with the word in cream and only the event icon on the grass; `#till-h` carries that title. At 3 stars and up it is unchanged.
- **R-3 (screens).** While the drum is not owned, the finale card adds `#offer-finale-drum` (`ui.finaleDrum` "With the drum smoker: {n} guests, pay {fee}.") and Pit news from week 5 adds `#news-finale` (`ui.finaleNews` "The finale is week 9. With the drum smoker it is a {n} guest cook."), both from `PitSim.genOffers` with the second kettle and the drum added.
- **R-10.** The Menu tile names the plates (`plateLabel`). Pit news hides `#goal` when the Gear tile already names the same item, and hides `#news` when nothing is left in it (the fresh week 1 hub). Tile windows are 54 px (were 38), sprites up to 50 px tall at integer scales (the 24 px people and kettles at 2x, the cooler and pile at 3x, the plates at 4x). The fresh week 1 hub measures 1577 of 1624 px (1598 before).
- **R-11.** The host quote sits beside a 36 px framed guest head (`.host-row`, `.host-av`) with a two step tail; the report's cooler box takes the `ui.inventory` legend. `.score-l` is umber and bold (cream on orange was about 2.7 to 1). The deposit line on offer cards is unindented and muted (`.oline.dep`). `#inv-charcoal` lost its negative margins.
- **R-12.** `fmt(n)` puts a thousands comma in the cash pill, `#rep-top`, the Cash row and `#se-cash` (`ui.seCash` is filled with the formatted number). Sim strings and canvas text are unchanged.
- **R-13.** The rail draws a 5 by 5 clock before the seconds and each booking count on a cream ticket with dark digits (green once that meat is done); Yard day counts stay plain. With two meats the rail still ends left of the yard sign's text.
- **R-14.** The creator's name fields start empty with the default as the placeholder (`cleanName` falls back as before). Random sits in the scene's top left corner, over the fence (screen-6-creator puts it bottom right, where our 64 by 56 scene has the kettle). Under 900 px `#cr-preview` is sticky at the top of the creator with the scene at 3x (2x under 700 px of screen height) and the sign at 2x, and the creator's scroll padding keeps focused rows clear of it. Under a 420 px panel only the swatch rows stack; the arrow rows keep an 80 px label beside the control.
- **R-15.** In a sheet under 420 px a row's name and lines take the full width, and the price and controls a second row. A shop section whose one item has the section's name (Charcoal) has no heading.

New W15 keys (exact text): `ui.weekOfYear`, `ui.seasonWhen`, `ui.finaleDrum`, `ui.mixHint`, `ui.finaleNews`, `ui.coolerNone`, `ui.coolerFullNone` ("No more room. There is no cooler to keep the rest."), `ui.reportHLow`, `ui.rowGear`, `ui.rowKept`, `ui.rowDrawn`, `ui.rowShop`. Changed C: `BOARD_STACKS 5`, `BOARD_STACK 14`, `BAGS_PER_COOKER 6`. New Till fields: `gearSpent`, `gearBought`, `cashStart`. New sim method: `canBuy`.

### W25.3 Harness and econ

Changed steps: 12 (the sized finale: 9, 25 and 40 guests, fees 105, 295 and 560, each inside the grate), 13 (the kettle bought from cash 103 after `canBuy`), 14 (a second butt sliced onto four plates, an overrun opening a second stack, a full board naming the trash), 15 (`ui.coolerFullNone`), 39 (information rows, and Paid at the shop adding up), 41 and 51 (placeholders), 45 (`#goal` and `#news` hidden, the Gear tile naming the goal), 46 (the money rows in order with Gear, Kept and Drawn, and week start + Take + gear + stock = Cash as the rows read), 46 and 50 (`ui.reportHLow` at 1 or 2 stars) and 50 (`#se-cash` with the comma). Step 62 is new: from cash 103 in week 1 the picked picnic turns safe after the second kettle is bought by a real tap on the Gear sheet, and `#go` opens. The console step is 63.

Runs at the end of the round: `node games/pit-sim/dev/smoke.mjs` 63 of 63 on phone (375 by 812), with `--desktop` and with `--seed 7`, zero console errors. `econ.mjs --season` (Normal, 50 seeds, 5 seasons) exit 0: drum medians sharp S1W4, steady S1W5, rough S1W7 (bands S1W4, S1W8, S2W9); Driveway affordable (information) S1W9, S2W8, S4W9; stuck and idle 0 of 50; rough never under 0. Median cash at the season ends: sharp 839, 2373, 3907, 5441, 6975; steady 282, 668, 1229, 1790, 2351; rough 233, 200, 326, 471, 622. Long exit 0 (S1W3, S1W4, S1W6). Short exit 1, as before the round: sharp's drum at S1W5 (band S1W4), and rough under 0 in 3 of 50 seeds (1 before; the Short two kettle finale is 23 guests at fee 275, so rough ends a season with less). The day runs (`econ.mjs`, seeds 1 to 8) exit 0: second kettle on event 3 or 4, drum on event 12 to 16, Driveway price on event 18.

### W25.4 Not applied, and why

1. **Headcount by fan third (`C.THIRD_GUESTS` 1.0, 1.25, 1.5) and a "more word of mouth to Word's out" line.** Variety within a booking type is v3.2's season scaling and difficulty swing and v3.3's new types and choice cards (W24.5 item 1). It would also make the middle third picnic a drum stretch on two kettles and move every [S 3.3] number the generator, the harness and the econ bands rest on, and the line would promise bigger bookings that v3.0 does not give.
2. **Plus or minus 2 guests, picky and easy host tags, a hub line when a third changes (word of mouth tips).** v3.2's difficulty swing and v3.1's tip multiplier (W9, W21 item 10); a line about tips by third would be untrue in v3.0.
3. **Idle speed (`C.IDLE_SPEED` 3x while nothing can be done).** It changes the cook's real length, which the 125 s pacing target ([S 2.3], [S 10.3]) and the harness's real time steps rest on, and it sits next to the no skip, no auto play anti-goal of [S 2.3]; that is Joel's call, not a fix. R-7's tip goes at the cause the playtest saw (both butts on at once, every slot full for 40 s).
4. **A dice icon on Random.** sprites.js has no dice sprite and the mock's icon is decoration; Random keeps its word.

### W25.5 For the Overseer

1. The finale is sized to the grate (R-3), which amends [S 15]'s "40 guests" for a player without the drum. The drum line on the finale card and in Pit news is the pull toward the drum.
2. Board capacity (R-2) replaces D2's 4 stacks of 8.
3. The Short length still fails two enforced checks (sharp's drum a week late, rough under 0 in 3 seeds). The canonical run is Normal; Short wants its own fee or pay look in the v3.1 or v3.3 tuning.
4. Steady and rough reach the Driveway price later than their information bands (S2W8 and S4W9 against S2W4 and S3W9), steady a week and rough two weeks later than round 1, from the extra bags and the sized finale.

---

## W26. Playtest round 3 (2026-10-19)

The third playtest of v3.0 (a fresh save played week 1 to season 2 week 1 by real taps on a 375 by 812 phone, a headless measure of the finale with the econ competent bot over 10 seeds, the screen shots and a design read against the mocks) came back with 36 findings, about a third of them the same problem seen twice. The fixes below are the round's. Each is an Overseer's call for the hand-off unless it says it only follows a W rule, and each is written in the header of the file it touched (sim.js Q-1 to Q-11, game.js Q-1 to Q-8, sprites.js Q-1 and Q-2, smoke.mjs Q-1 to Q-5). Where this section and an earlier W section disagree, this section wins.

### W26.1 Rules of play (sim.js)

- **Q-1. Booked guests wait at the gate until the hard end (W7.2, W7.3, W21 item 8).** `tickBookedSpawns` lets a guest whose time has come join while a line spot is free until `endAt - C.LAST_CALL_GUARD`, not until last call; last call no longer calls `missPending()` (it still closes a Yard day's gate). Guests still waiting at the hard end give up then: `tickStages` calls `missPending()` before `endDay()`, so `guests_missed` fires after `last_call`, in the closing tick (deviation 41 is replaced). The sold out rule is unchanged. `ui.missedLine` is "{n} gave up at the gate. The line stayed full to the end."
- **Q-2. The Season finale ignores the length setting ([S 3.4] already says so of the competition).** `BOOKINGS.finale` has a 105 s window; `offerFields` reads the finale at Normal (its own window, the 1.0 headcount factor) at every length; `loadUp` sets `endAt` to the new `C.FINALE_SECONDS` (160) and last call to `min(gateAt + window, 160 - LAST_CALL_GUARD)`, 135; `prefill()` scales the finale's bags by its 160 s (8 a cooker). R-3's grate sizing reads the longer window: 16 guests on one kettle (fee 190), 33 on two (390), 40 with the drum (560), at every length.
- **Q-3. The cooler's put back runs on a tap when no owned cooker has room for the raw piece in hand** (`auto` from a new `roomToCook(meat)`), so the tutorial's full grate row, whose arrow points at the cooler (P-6), works by tapping the cooler. With room on a grate it stays a button verb, so a second tap on the cooler never undoes a take.
- **Q-4. Hands full names the place** for a cooked piece ("Slice it at the board") and a burnt one ("That's burnt. Trash it"), as plates already did.
- **Q-5. The Birthday's window is 60 s (was 80, [S 3.3] amended).** Its twelve guests arrive in about 54 s. The competent bot still feeds 12 of 12 at 5 stars and the cook ends at 98.6 s on one kettle and 91.5 s on two (106.6 and 106.8 before). It fits one kettle (108 slot seconds of 144) at every length; its window is 41.25 s at Short and 78.75 s at Long.
- **Q-6. `sim.gateWaiting()`** (a W5.1 method): booked guests whose arrival time has come who wait off canvas for a line spot.
- **Q-7. The pick carries over.** `startWeek()` preselects last week's booking type when it is offered and safe this week, else the first card (W21 item 5 still holds in week 1 and after a Yard day). The card order (W3.4 step 7) is unchanged.
- **Q-8. `C.DRIVEWAY_BUYABLE` false** (v3.3 flips it): `updateComingNext()` never shows the Coming next card and `goal()` skips the driveway, so Pit news names something the player can buy (the Bigger table, 70) instead of a 400 price the player may already hold. The Gear sheet keeps the driveway row as information.
- **Q-9. Till fields** `charcoalStart` and `stockStart` (the pile and the cooler before the cart went in, set in `loadUp`), so the report can say what its stock row holds.
- **Q-10 and Q-11.** The charcoal row reads "A kettle burns about six bags a cook." New W15 keys (exact text): `ui.missedTable` "A bigger table lets five wait.", `ui.finaleTable` "The finale is {n} guests. A bigger table lets five wait in line.", `ui.mixShort` "One {big} at a time.", `ui.covers` "Covers {p} of {r} plates", `ui.otherMeats` "Other meats", `ui.offMenu` "Not on this menu. Add one in Menu.", `ui.noSpare` "No spare. One burnt piece leaves guests without a plate.", `ui.practice` "A practice day before your first season.". Changed: `ui.missedLine`, `ui.coolerRoom` "The cooler holds {cap} units overnight. This cook can use about {e} more units of meat.", `ui.coolerNone` "No cooler. This cook can use about {e} more units of meat.", `ui.rowKept` "Bought for later", `ui.rowDrawn` "Paid for in an earlier week". New C keys: `FINALE_SECONDS 160`, `DRIVEWAY_BUYABLE false`. Changed BOOKINGS: the Birthday's window 60, the finale's 105.

### W26.2 Screens (game.js, index.html, sprites.js)

- **Q-1.** `#title` reads the pit name in upper case once a profile exists; YOUR PIT (the game's name) before the creator. The document title stays Your Pit.
- **Q-2. The shop at a booking** lists only the rail meats, each with `ui.covers` (green, red while short); the other meats fold under an Other meats button (`#shop-other`, `aria-expanded`) that opens them under `ui.offMenu`, and opens on its own when the cart already holds one. `ui.noSpare` shows when every rail meat is covered and one of them has no whole spare unit. The charcoal row carries the pile sprite. Back is a 44 px chevron button (`#sheet-back`, `aria-label` Back) at the sheet's top right beside the title, in place of the full width bar.
- **Q-3. The report.** The stock row reads `ui.rowKept` or `ui.rowDrawn` as an information row (muted, its signed amount kept so week start + Take + gear + stock = Cash still reads down the column) with the bags and units in the detail ("18 bags"); a missed line without the bigger table adds `ui.missedTable`; Take today's amount is the UI font at 3x on its gold band. `#rep-top`'s week and cash are the UI font at 2x.
- **Q-4. Pit news and the cook.** No Coming next card while the Driveway cannot be bought (sim.js Q-8). The weather line shows only while the Yard day is picked (rain never touches a booking, W22.10). From week 5, while the bigger table is not owned, `#news-table` reads `ui.finaleTable` with this save's finale headcount. Before the gate on a booking whose rail mixes a two slot and a one slot meat, `#status` adds `ui.mixShort` after the countdown ("Gate opens in 25. One pork butt at a time."). On the canvas, a small box under the rail draws a person and "+N" while `sim.gateWaiting()` is above 0. `PitSim.game.rail` is unchanged.
- **Q-5. The hub.** The pip bar is gone (the season strip carries the weeks; screen-1-season has no pips); `#week-when` is 12 px and never wraps. The pill values are the UI font at 2x bold and their labels the UI font at 2x, a short group of words a line ("Word of" over "mouth"). The cooler meter is a row of cells, one a unit (gold, orange past 80 percent, red over the cap). Offer cards open with a scene drawn from v2 sprites at 2x (the back fence over a lawn, two guests behind a picnic table with the event icon on it, more tables on the wide finale card, a kettle with a puff at the right) and a SAT or SUN tag in the top left corner by card order; on the 48 px band of fit level 1 and up it is the same scene's middle 22 rows. The card lines are 15 px bold. The fresh week 1 hub measures 1587 of 1624 px.
- **Q-6. The creator.** On a phone the sticky preview's scene is the panel's width at 4x (3x under 700 px of screen height) and 44 px tall, the pitmaster at about 42 percent across and the kettle at his right; the desktop column keeps the 64 by 56 patch at up to 5x. Random sits at the scene's bottom right with a die (a game.js pictogram). Fire it up rides a sticky footer on phones (`#cr-foot`, blue stripes), with the creator's scroll padding keeping focused rows clear of it. The field labels are the UI font (white, gold while the field has focus). Rows are 4 px apart (was 7).
- **Q-7. The tutorial morning** wears the hub's look: blue stripes, a DAY 1 header in the UI font (its words "Morning, day 1"), `ui.practice` under the head line, the tutorial card on umber, the shop rows in an umber card, chunky buttons and Open the yard in the UI font (the pulse ring keeps the bevel). While the tutorial runs it leaves out the goal line and the Gear, Decor and Hires sections (the hub has them from week 1). Its copy and its `#open` target are unchanged.
- **sprites.js Q-1 and Q-2. The Blue apron** was the shirt's own two colors (cloth f and clothD g), so it vanished. The palette is full (36 entries, lowercase legend, W21 item 13), so `lookMap` paints the shirt cream (T 3, V white h, U paverD a) under the Blue apron; every other apron keeps the blue shirt. The Charcoal apron's body is smokeD v (was steelD t), off the shirt's shade column. `art.LOOK.apron[4]` is `{ A: 'v', B: '2' }` (W16.4 amended); game.js's swatch fallback follows.

### W26.3 Harness and econ

Changed steps: 5 (the W26 strings and C keys, the Birthday's 60 s and the finale's 105 s windows, `gateWaiting` among the methods, the apron table), 11 ((a2) a tap on the cooler puts the piece back with the grate full; (b) the put back is a button verb with room on the grate), 12 (the finale at Normal whatever the length: 16, 33 and 40 guests, fees 190, 390 and 560, window 105, and the same offer at Short and Long; the Birthday's window 60, 41.25 and 78.75), 13 (after the 3 star picnic the next week opens on the picnic), 14 (the idle Birthday's last call is 90; `guests_missed` fires after `last_call` with the report's missed count; on seed 31, 1 guest joined after last call and 5 gave up at the hard end), 16 (the finale loads up with `endAt` 160 and last call 135) and 46 (`#title` reads the pit name; the Birthday's shop has no ribs or butt rows, Other meats is folded and each rail meat reads "Covers 6 of 6 plates"; the ledger reads the renamed stock rows). Still 63 steps.

Runs at the end of the round: `node games/pit-sim/dev/smoke.mjs` 63 of 63 on phone (375 by 812), with `--desktop` and with `--seed 7`, zero console errors. `econ.mjs --season` (Normal, 50 seeds, 5 seasons) exit 0: drum medians sharp S1W4, steady S1W5, rough S1W7 (bands S1W4, S1W8, S2W9); Driveway affordable (information) S1W9, S2W8, S4W9; stuck and idle 0 of 50; rough never under 0. Median cash at the season ends: sharp 827, 2361, 3895, 5429, 6963; steady 295, 656, 1217, 1778, 2339; rough 221, 200, 314, 459, 610. Long exit 0 (drum S1W3, S1W4, S1W6). Short exit 1: sharp's drum at S1W5 (band S1W4) and rough under 0 in 3 of 50 seeds, as in round 2, and now rough "stuck" in 2 seeds (the bot spends the larger Short finale's pay at the season start on the cooler, canopy and fire tender, then takes a Yard day with the tender's wage at cash 8). The day runs (`econ.mjs`, seeds 1 to 8) exit 0: second kettle on event 3 or 4, drum on event 10, Driveway price on event 18; the two kettle finale on seed 1 booked 33 and fed 30.

The finale measured headless with the competent bot (seeds 1 to 10, Normal, played tick by tick): with the drum, 36.3 of 40 fed at 4.5 stars; with the drum and the bigger table, 39.0 of 40 at 5.0; on two kettles, 30.0 of 33 at 4.9. A slowest meat first bot: 23.3 of 40 at 2.2 stars with the drum, 31.7 at 3.9 with the bigger table, 23.9 of 33 at 3.4 on two kettles. The Church picnic on two kettles: 18 of 20 at 5 stars for both bots.

### W26.4 Not applied, and why

1. **A seeded headcount spread per week (`C.GUEST_SPREAD` 0.2), raised as high.** Variety within a booking type is v3.2's season scaling and difficulty swing and v3.3's new types and choice cards ([S 3.3], [S 15]); W21 item 3 accepted the same three cards in v3.0, and W24.5 item 1 and W25.4 item 1 declined it for the same reason. It would also reorder every generator draw (the hosts and the W3.4 reference model), move every [S 3.3] literal the harness and the econ bands rest on, and turn about a third of the picnics into drum stretches on two kettles, which is a v3.3 decision about stretch bookings. Q-7 answers the part of the finding that is v3.0's: the picnic a player bought the kettle for stays picked.
2. **The tip multiplier by fan third (`C.THIRD_TIP` 1.0, 1.15, 1.3).** W21 item 10 put it in v3.1, where it is proposed with the crew's tips; it would move every tip number in the v2 and v3.0 checks. Word of mouth already sets the offer count, the finale's fan rating tier waits for v3.2's competition, and Q-8 keeps Pit news on things that can be bought.
3. **Sorting safe offers by pay, highest first.** W21 item 5 keeps the easiest safe offer first, so a new player's two tap week is a Birthday; Q-7 carries last week's pick instead, which fixes "the pick resets to the Birthday" without moving the card order the generator, its reference model and the two tap step rest on.
4. **A navy apron color.** The palette is full and W21 item 13 bars an uppercase legend; the cream shirt under the Blue apron (sprites.js Q-1) shows the apron the swatch promises.
5. **Holding booked guests to their own patience at the gate, or the big line for bookings.** Q-1 keeps them waiting until the hard end, which is the larger part of the fix, and the bigger table (70) stays the in-game answer the report and Pit news now name.

### W26.5 For the Overseer

1. The finale now runs 160 s at every length and holds 40 guests only with the drum (16 on one kettle, 33 on two). It is the season's longest cook; a player who bought the drum and the bigger table should get 5 stars.
2. Booked guests no longer give up at last call. A slow cook now runs to the hard end with a full line (the idle Birthday on seed 31 fed nobody; 1 guest joined after last call and 5 gave up at the hard end), which is honest but long; the levers are `LAST_CALL_GUARD` and the patience column.
3. The Short length now fails three enforced checks (W26.3). Normal is the canonical run; Short still wants its own fee or pay look in the v3.1 or v3.3 tuning, and the econ bot's season start spend rule (reserve against wages) wants a look then too.
4. The Driveway goal and the Coming next card are off until v3.3 (`C.DRIVEWAY_BUYABLE`); [S 17]'s "The Driveway goal at 400 from v3.0, buyable in v3.3" now reads as shown from v3.3.
5. The offer scene's SAT and SUN tags are decoration from screen-1-season; nothing in v3.0 schedules by day.
