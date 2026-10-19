# Your Pit v3.2 Days: the days of the week, module contract

**Date:** 2026-10-19. **Round:** v3.2 Days only: design [S 19.6], the days of the week. Nothing else: the counter spread of [S 19.6] belongs to the v3.4 art swap; no competition, ladder or trailer; no Tailgate booking type (it arrives with its own round, so until then Saturday holds Birthdays and the finale, Sunday holds Church picnics).
**Rules:** `docs/superpowers/specs/2026-10-18-pit-sim-v3-season-design.md`, cited as [S n]; [S 19] wins over earlier sections.
**Builds on:** v3.1 as committed (4c74c39, then 7dece70), contract `docs/superpowers/specs/2026-10-19-pit-sim-v3-1-contract.md`, cited as [X n] (and through it [W n]). Every name there stands unless a D section below names it. Where a D section and an X or W section disagree, the D section wins.
**Build shape:** two builders and an integrator, no contract stage. The **Sim builder** owns `games/pit-sim/sim.js` and `games/pit-sim/dev/econ.mjs`. The **Game builder** owns `games/pit-sim/game.js` and the style block and `#panels` skeleton of `games/pit-sim/index.html`. The **integrator** owns `games/pit-sim/dev/smoke.mjs`, runs both suites and fills D12. Nobody edits `games/pit-sim/art3/`, `games/pit-sim/sprites.js` or `games/pit-sim/dev/look-proof.html`.
**Standing rules ([X0]):** `node --check` on every edited script; no U+2014 or U+2013 in any edited file; no inline script; `createElement` and `textContent` only; one `localStorage` key `hs.pitsim.save`; no network. Every user-facing string obeys [S 14].
**Marking:** anything [S 19.6] does not state is tagged **(OC)**, the Overseer's call. D11 lists them.

---

## D1. Names

| Name | Meaning |
|---|---|
| `DayIdx` | `0` to `6`, Monday to Sunday. Lives in `state.season.day`. |
| `DayKind` | `'yard' \| 'prep' \| 'market' \| 'train' \| 'off' \| 'loadin' \| 'event'`. What a day was spent on. `'event'` is only the booked day. |
| the booked day | `state.season.booking.day` when the picked offer is a booking; `null` for the Yard offer. |
| a quick day | `prep`, `market`, `train`, `off`, `loadin`: one tap, a result card, no service. |
| a cook day | `yard` (any day) or `event`: the v3.1 prep, service and report flow. |
| the result card | `#daycard` (D8.3), after every quick day. |

New top level name, attached by `sim.js`: `PitSim.DAY_IDS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])`. Nothing else is added at the top level.

## D2. `PitSim.C` additions

Read by name, never hard coded by `game.js`, the harness or the econ bot.

```js
// v3.2 days of the week [S 19.6]
WEEK_DAYS: 7,
YARD_DAY_FRAC: 0.5,                 // a Monday to Friday Yard day: the length row's seconds and window times 0.5, rounded [S 19.6]
DAY_PRICE: Object.freeze([0.85, 0.9, 1.0, 1.1, 1.0, 1.0, 1.0]),   // meat and charcoal price by DayIdx; Mon to Thu per [S 19.6]; Fri to Sun 1.0 (OC)
PREP_QUALITY: 4,                    // Quality points of cushion a prepped booked event starts with (D4.4)
OVERNIGHT_HEAD: 0.5,                // share of MEATS[m].cook a load-in piece starts with
OVERNIGHT_PIECES: 2,                // butt or brisket pieces that get the head start (OC)
OVERNIGHT_BAGS: 2,                  // charcoal bags the overnight smoke burns at load-in (OC)
OVERNIGHT_MEATS: Object.freeze(['butt', 'brisket']),
DAYOFF_MOOD: 1,                     // mood steps every card gains on a Day off [S 19.6]
DAYOFF_MOOD_CAP: 1,                 // a Day off lifts mood to Happy at most; Fired up stays earned in a cook ([X20.5]) (OC)
BOOK_DAY: Object.freeze({ birthday: 5, picnic: 6, finale: 5, yard: null }),   // [S 19.6] for birthday and picnic; finale Saturday (OC)
```

`C.SAVE_VERSION` 6 (was 5). `PitSim.game.version` `'0.7.0'` (was `'0.6.0'`).

## D3. State

### D3.1 Additions to `state.season` (saved)

| Key | Type | Meaning |
|---|---|---|
| `day` | `DayIdx` | today; `startWeek()` sets 0 |
| `dayLog` | `(DayKind \| null)[7]` | what each day this week was spent on; `null` for today and later; `startWeek()` fills nulls |
| `prepped` | boolean | Prep or Load-in done this week; `startWeek()` sets false |
| `loadin` | boolean | Friday Load-in done; locks the booking; `startWeek()` sets false |
| `overnight` | `{ meat, n } \| null` | the head-start pieces Load-in put on; `startWeek()` sets null |

`season.trained` ([X4.1]) is unchanged and is now set by the Train day.

### D3.2 Additions to `state` (never saved)

`state.dayCard`: `null \| DayCard` (D8.3). Set by `chooseDay` for a quick day, cleared by `advanceDay()`.

### D3.3 `Offer` additions

`day: 5 \| 6 \| null`, from `C.BOOK_DAY[type]`; the invite takes its type's day. `genOffers` sets it. Nothing else about offers changes.

### D3.4 `Today` additions

`weekday: boolean` (a cook on day 0 to 4), `prepBonus: 0 \| C.PREP_QUALITY`, `overnight: { meat, n, left } \| null`, `dayIdx: DayIdx`.

## D4. Day rules

### D4.1 What each day offers (`sim.dayOptions()`)

| Day | Options, in this order | Rules |
|---|---|---|
| Mon to Thu (0 to 3) | `yard`, `prep`, `market`, `train`, `off` | `prep` needs a picked booking (not Yard) and `!prepped` (else `ui.prepNeedsBooking` or `ui.prepDone`). `train` needs a card and `trained === null` (else `ui.trainDone`). `market` needs a cart above 0 (else `ui.cartEmpty`). `yard` needs what `canLoadUp()` asks of a Yard day: charcoal, meat in stock or cart, the payroll check. |
| Fri (4) | `loadin`, `yard`, `off` | `loadin` needs a picked booking and `!loadin` (else `ui.loadinDone`). `off` on Friday (OC: [S 19.6] lists Load-in and a Yard day). |
| Sat, Sun (5, 6) | the booked day: `event` only. The other day: `yard`, `off`. | One booked event per weekend [S 19.6]. The booked day cannot be skipped (OC). A Yard week (the Yard offer picked) gives `yard` and `off` on both days. |

`dayOptions()` returns a fresh `{ day, booked: boolean, price: number, options: { kind, ok, reason }[] }`; `reason` is a `STRINGS.ui` text when `ok` is false, else `''`.

### D4.2 Day prices

`cartTotal()` charges each meat line and the charcoal line at `Math.round(qty * price * C.DAY_PRICE[day])`; gear and decor at their list price. The shop sheet shows each meat and charcoal row at the day price and the cart total at the day price. The cart commits three ways: a Market run (commits only), a Load-in (commits, then D4.5), or `loadUp()` on a cook day (as v3.1, at that day's price). `meatRoom()` and the cooler rules of [S 19.3] are unchanged.

### D4.3 Yard day

`chooseDay('yard')` on day 0 to 4 runs `loadUp()` with the Yard row and `today.weekday = true`: `endAt = Math.round(L.seconds * C.YARD_DAY_FRAC)`, `lastCallAt = Math.min(gateAt + Math.round(L.window * C.YARD_DAY_FRAC), endAt - C.LAST_CALL_GUARD)`. The player cooks any meat in stock or the cart [S 19.6]. Wages, `C.DAILY_COSTS`, XP and mood as a v3.1 Yard day. The report is the short till [S 19.6]. On Saturday or Sunday a Yard day is full length (OC). `endDay()` pushes to `season.results` only for a booking (`isBooking`); a Yard day never does (OC; the week's Yard result is written by D4.7 step 4).

### D4.4 Prep

`chooseDay('prep')`: `prepped = true`; nothing else moves. The booked event's `startService` sets `today.prepBonus = C.PREP_QUALITY`, and the client score's quality term becomes `qualRaw = Math.max(0, Math.min(C.SCORE_QUALITY, C.SCORE_QUALITY + t.prepBonus - C.BURNT_PENALTY * burnt - C.OFFMENU_PENALTY * offMenu - C.COLD_PENALTY * cold))`. It never lifts Quality past 20 (OC: reads "Quality starts higher" as a cushion). Prep and Load-in share the one flag and do not stack (OC). A booking change after Prep keeps `prepped` (OC).

### D4.5 Friday Load-in

`chooseDay('loadin')`: commits the cart at Friday's price, then `prepped = true`, `loadin = true`; from here `bookOffer` and `setAddon` refuse with `ui.bookLocked`. Then, when the booked day is 5, the rail holds a meat in `C.OVERNIGHT_MEATS` that is in stock, and `charcoal >= C.OVERNIGHT_BAGS`: `charcoal -= C.OVERNIGHT_BAGS`; `meat` is the rail's slowest such meat (largest `MEATS[m].cook`); `n = Math.min(C.OVERNIGHT_PIECES, stock[meat])`; those `n` units leave stock now (they sit on the smoker overnight and never spoil) (OC); `overnight = { meat, n }`; emit `overnight_on { meat, n }`. Saturday's `loadUp()` returns the `n` units to stock before the cart commits and copies `today.overnight = { meat, n, left: n }`; each of the first `left` pieces of that meat put on a grate starts at `prog = Math.round(C.OVERNIGHT_HEAD * MEATS[meat].cook)` and `left -= 1`. A Sunday booking gets the prep only (OC: [S 19.6] names Saturday).

### D4.6 Train and Day off

`chooseDay('train', { id })` applies the v3.1 `train(id)` rule. A bare `train(id)` keeps working on days 0 to 3 and is the same call (OC, so v3.1 callers stand); on days 4 to 6 it returns `{ ok: false, message: STRINGS.ui.trainDays }`.
`chooseDay('off')`: each card with `mood < C.DAYOFF_MOOD_CAP` gets `mood = Math.min(C.DAYOFF_MOOD_CAP, mood + C.DAYOFF_MOOD)`; `notice = false` for a card whose mood is now above -2; emits `crew_mood { changes }` when any moved. Nothing earned, no wages, no daily costs (OC).

### D4.7 The day tick (internal `nextDay(kind)`, the only place a day ends)

Once per day, in this order:
1. Spoilage: the W10.4 rule (cooler cap, costliest units kept, the rest spoils), emitting `spoiled` as v3.1. On a cook day it already ran in `endDay()` for the till, so it is skipped here. Meat bought Monday without a cooler spoils Monday night [S 19.6].
2. `dayLog[day] = kind`.
3. Day 0 to 5: `day += 1`, `beginMorning('week')` (a rain roll each day; rain touches Yard days only, as [W22.10]) (OC), emit `day_start { day }`.
4. Day 6: when `results.length < week`, push `{ type: 'yard', stars: 0 }` (a Yard week, or a booking that never played). Then the v3.1 week step of `finishReport`: `week = results.length + 1`, `beginMorning('week')`, `week_start`, `startWeek()`; after week 9 the season end card.
5. Emit `save_wanted { reason: 'day' }`: a save on every day change [S 19.6].

Cash, inventory, spoilage and mood move per day [S 19.6], never per week. Wages are paid only on cook days (OC).

## D5. Sim methods

Own properties of the sim object, fresh objects returned, `{ ok: false, message: '' }` outside their loop.

| Method | Returns | Semantics |
|---|---|---|
| `dayOptions()` | D4.1 | loop `'week'`, phase `'morning'` |
| `chooseDay(kind, opt?)` | `{ ok, message }` | week, morning, `kind` an option with `ok`. Quick kinds: apply D4.4 to D4.6, set `state.dayCard`, emit `day_done`, run `nextDay(kind)`, then loop `'week'`, phase `'evening'`. `yard`: D4.3, then loop `'prep'` as `loadUp()`. `event`: `loadUp()` on the booked day. |
| `advanceDay()` | `{ ok, message }` | week, evening only: clears `dayCard`, phase `'morning'`. It never ticks (the tick ran in `chooseDay`, so the save already holds the next morning). |
| `dayCardView()` | `DayCard \| null` | fresh copy |
| `loadUp()` | changed | runs only when `day === booking.day`, or from `chooseDay('yard')`; else `{ ok: false, message: ui.goNotToday }` |
| `canLoadUp()` | changed | the same day rule, `reason` `ui.goNotToday` with `{day}` the booked day's `dayName` |
| `finishReport()` | changed | after a cook day's report: `nextDay('yard' or 'event')`, then week, morning (or the season end). The tutorial path is unchanged. |
| `bookOffer(id)` | changed | refuses with `ui.bookLocked` when `loadin`, with `ui.bookPast` when the offer's `day` is not null and below `season.day` |
| `startWeek()`, `reset()` | changed | also set `day 0`, `dayLog`, `prepped`, `loadin`, `overnight` |

## D6. The loop (amends [X8])

| From (loop, phase) | Cause | To | Events, in order |
|---|---|---|---|
| week, morning | `chooseDay(quick)` | week, evening | `day_done`, any tick events (`spoiled`, `crew_mood`), `day_start` or (Sunday) `week_start` and `offers_ready`, `save_wanted { reason: 'day' }` |
| week, evening | `advanceDay()` | week, morning | none |
| week, morning | `chooseDay('yard')` or `chooseDay('event')` | prep | as `loadUp()` |
| report, evening | `finishReport()` | week, morning, or seasonEnd | the D4.7 tick events |

`createSim(saved)` opens a saved week at `season.day`, phase morning, no card. Every other [X8] row stands.

## D7. Events (rows added to [X9])

| type | payload | sentence (`#live`) |
|---|---|---|
| `day_done` | `day, kind, spent, prepBonus, overnight, moodUp` | `say.dayDone[kind]` |
| `day_start` | `day` | `say.dayStart` |
| `overnight_on` | `meat, n` | `say.overnight` |
| `save_wanted` | `reason` gains `'day'` | none |

## D8. Strings and DOM

### D8.1 `PitSim.STRINGS` additions (exact text)

```js
dayName: Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
dayShort: Object.freeze(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']),
dayKind: Object.freeze({ yard: 'Yard day', prep: 'Prep', market: 'Market run', train: 'Train', off: 'Day off', loadin: 'Load-in', event: 'Booked event' }),
dayHint: Object.freeze({
  yard: 'Open the yard for a short cook. Walk-ins pay.',
  prep: 'Trim and rub the weekend meat. Quality starts higher.',
  market: 'Buy what is in the cart at today\'s price.',
  train: 'One crew card trains this week.',
  off: 'Crew mood goes up. Nothing earned.',
  loadin: 'Prep the booking and put the big meat on overnight.',
  event: 'Today is the booking. Load up and go.'
}),
```

In `ui`:

```js
dayStripAria: 'This week, today is {day}',
dayDoneAria: '{day}, {kind}',
dayAheadAria: '{day}, ahead',
dayBookedAria: '{day}, booked: {label}',
dayPick: 'What is today?',
priceDay: 'Prices today: {n} percent',
goNotToday: 'The booking is on {day}.',
bookLocked: 'Loaded in. The booking is set.',
bookPast: 'That day has gone by.',
trainDays: 'Training is Monday to Thursday.',
prepNeedsBooking: 'Pick a booking to prep for.',
prepDone: 'Already prepped this week.',
cartEmpty: 'Put something in the cart first.',
loadinDone: 'Already loaded in.',
nextDay: 'Next day',
cardBought: 'Bought {list}. {n} spent.',
cardPrep: 'Prep done. The booking starts {n} Quality ahead.',
cardOvernight: '{n} {meat} on overnight. They start half done.',
cardMood: 'Crew mood: {list}.',
cardSpoiled: '{n} spoiled tonight.',
cardNothing: 'A quiet day.',
```

In `say`: `dayDone: Object.freeze({ prep: 'Prep done.', market: 'Market run done.', train: 'Training done.', off: 'A day off.', loadin: 'Loaded in.' })`, `dayStart: 'It is {day}.'`, `overnight: '{meat} on overnight.'`.

### D8.2 The day strip and the day choice (week hub)

In `#week-body`, right after `#season-strip` and before `#offers`, in the season strip's style family ([X13.6], `screen-3-week`):

- `ol#day-strip` (`aria-label` `ui.dayStripAria`): seven `li#day-{i}` (`i` 0 to 6), class `dy` plus one of `done` (before today), `now` (today, lit), `ahead`, and `booked` on the booked day. Each shows `dayShort[i]` in the UI font at 2x; a done day adds `checkEl(2)`. `aria-label` from `ui.dayDoneAria`, `ui.dayBookedAria` or `ui.dayAheadAria`. Display only, not a control (OC); seven tiles fit 343 px at 375 by 812.
- `section#day-choice` (`aria-labelledby` `day-choice-h`): `h3#day-choice-h` (`ui.dayPick`, the `offers-h` style), `p#day-price` (`ui.priceDay`, `{n}` = `Math.round(DAY_PRICE[day] * 100)`; class `low` below 100, `high` above), then one `button#day-{kind}` per `dayOptions()` entry, `.alt`, at least 44 px tall, label `dayKind[kind]`, with `p#day-{kind}-hint` (`dayHint[kind]`, or the option's `reason` when disabled). `#day-train` opens the crew sheet in pick mode; a card's pick calls `chooseDay('train', { id })`.
- On the booked day `#day-choice` holds the existing `#go` and `#go-why`, moved in with their ids. On other days `#go` is hidden and `#next-event` keeps showing the booking, plus `ui.goNotToday` in `#go-why`.
- Each booking offer card gains `span#offer-{id}-day` (`dayShort[offer.day]`) beside `offer-{id}-tag`; none on the Yard card.
- The fresh week 1 hub still fits `2 * innerHeight` at 375 by 812. If not: the [X13.6] shrink order, then the day hints hide (OC).

### D8.3 The result card (`#daycard`)

A panel in `#panels` (added to `PANEL_IDS`), opened on `day_done`. `DayCard` = `{ day, kind, bought: { id, qty, cost }[], spent, prepBonus, overnight, mood: { id, name, from, to }[], spoiled }`; `spoiled` is the units that spoiled at that night's tick. Lines, each shown only when it applies:

- `h2#daycard-h`: `dayName[day] + ', ' + dayKind[kind]`, focused on open.
- `p#daycard-bought`: `ui.cardBought` (`{list}` as `qty label`, joined `', '` with `' and '` before the last).
- `p#daycard-prep`: `ui.cardPrep`, `{n}` `C.PREP_QUALITY`.
- `p#daycard-overnight`: `ui.cardOvernight`, `{meat}` the plate label lower case.
- `p#daycard-mood`: `ui.cardMood`, `{list}` the names with their new `STRINGS.mood` word.
- `p#daycard-spoiled`: `ui.cardSpoiled`.
- `p#daycard-nothing`: `ui.cardNothing` when no line above shows.
- the cash pill `#daycard-cash`, then `button#daycard-next` (`.primary`, `ui.nextDay`) calling `advanceDay()`; focus then goes to `#day-choice-h`.

Fits one screen at 375 by 812.

## D9. Save version 6

- `v: 6`: the v5 keys of [X11.1] plus five `season` keys, for example `"day": 2, "dayLog": ["market", "prep", null, null, null, null, null], "prepped": true, "loadin": false, "overnight": null`.
- `validateSave` accepts `v` 1 to 6 and always returns 6; never throws. `day` integer 0 to 6 (default 0). `dayLog` exactly 7 entries: a `DayKind` below `day` (a bad entry reads `'off'`), `null` from `day` on. `prepped` boolean (default false). `loadin` boolean, true only when `day >= 5`. `overnight` `{ meat in OVERNIGHT_MEATS, n integer 1 to OVERNIGHT_PIECES }` only when `loadin`, the booking's `day` is 5 and `day === 5`; else `null`. Offers and the booking get `day` from `C.BOOK_DAY`, never from the save.
- **From v5:** a mid-week v3.1 save lands on that week's Monday: `day 0`, `dayLog` seven nulls, `prepped false`, `loadin false`, `overnight null`; `trained` kept, so a player who already trained in v3.1 cannot train twice that week. A v3.1 report save (written after the week's result) lands on the next week's Monday, as v3.1 already did.
- From v1 to v4: every [X11.3] step, then the v5 step.
- `game.js` keeps its raw `parsed.v` read: a raw `v` of 5 shows `ui.notice` (unchanged text) once and writes once (OC); 1 to 4 as [X11.3]. A v6 save loads silently.

## D10. Harness and econ bot

### D10.1 Harness (`dev/smoke.mjs`), new steps 72 to 78

Browser steps by real taps, unless marked Node.

72. **A full week by taps.** A save past Hiring Day, week 1, a Birthday picked. Monday: add chicken to the cart, tap `#day-market`; `#daycard` opens with `#daycard-bought`; tap `#daycard-next`; `#day-1` has `now`, `#day-0` has `done`. Tuesday `#day-prep` (`#daycard-prep` reads 4). Wednesday `#day-train`, pick the first card (its xp rose by `C.TRAIN_XP`). Thursday `#day-off` (a card under the cap moved up one, `#daycard-mood` shows). Friday `#day-loadin`; tapping another offer leaves `season.booking.id` the same. Saturday: `#go` shows in `#day-choice`; play the event to the report; `today.prepBonus` is 4. Sunday: `#day-off`; the hub reads week 2 with `#day-0` `now`. After every day change `JSON.parse(localStorage['hs.pitsim.save']).season.day` matches the lit tile.
73. **Spoilage across days, no cooler.** Monday, no cooler: a Market run of 4 sausage; `#daycard-spoiled` reads 4 and Tuesday's sausage stock is 0. Node: the same with `gear.cooler` keeps all 4 to Saturday.
74. **Day price differences.** The same cart (5 chicken, 5 bags) is charged `round(5*8*m) + round(5*CHARCOAL_PRICE*m)` with `m` 0.85 Monday, 0.9 Tuesday, 1.0 Wednesday, 1.1 Thursday: read from the shop's cart total on each day's hub and from cash after each run. `#day-price` has `low` on Monday and Tuesday, neither on Wednesday, `high` on Thursday.
75. **Overnight smoke** (Node): a fixture week with a Saturday booking whose rail holds butt, 2 butt in stock and 4 bags. Load-in leaves 2 bags and 0 butt in stock, `overnight { butt, 2 }`; Saturday `loadUp()` puts the 2 back; the first two butt pieces on the grate read `prog === Math.round(0.5 * MEATS.butt.cook)`, the third reads 0. A Sunday booking's Load-in sets no `overnight`.
76. **Weekday Yard day.** Tuesday `#day-yard`: service runs with `today.endAt === Math.round(C.LENGTHS.normal.seconds * 0.5)`; the short till shows; `season.results` length unchanged; the hub next shows Wednesday.
77. **Migration.** A v5 save in week 4, loop week, `trained` set; reload: week 4, `#day-0` `now`, `#day-train` disabled with `ui.trainDone`, the stored save now `v: 6`.
78. **Booking day rules.** A Sunday picnic: Saturday offers `#day-yard` and `#day-off`, `#go` hidden; Sunday shows only `#go`. A Yard week: both weekend days offer Yard day and Day off; after Sunday `results` ends with `{ type: 'yard', stars: 0 }`.

Every v3.1 step that reached Load up and go from the week hub first runs a helper `toBookedDay()` (taps `#day-off`, then `#daycard-next`, until `#go` shows). Every save fixture moves to `v: 6`.

### D10.2 The econ bot (`dev/econ.mjs`)

- The base policy taps a week the way [S 19.6]'s weekend player does: Monday a Market run of the booking's prefill when the cooler holds it, else Prep; Tuesday Prep when not prepped, else Day off; Wednesday Train when there is a card, else Day off; Thursday Day off; Friday Load-in; the booked day; the other weekend day off. A Yard week cooks one weekend Yard day.
- A second policy, `grinder`, cooks a Yard day every Monday to Friday it can and skips Load-in. Info only.
- **Keep the season bands:** the [S 10.3] drum bands (sharp S1W4, steady S1W8, rough S2W9), never stuck, rough never under 0, with the base policy at Normal, 50 seeds, 5 seasons, exactly as v3.1. If the base policy lands outside a band, the Sim builder tunes `C.PREP_QUALITY` first and `C.DAY_PRICE[0]` and `[1]` second, never a v3.1 key, and records it in D12.
- New info lines: minutes per season for the base policy (2 s a quick day, events at their seconds) against the 45 minute target of [S 19.6]; the grinder's season cash against the base policy's.

## D11. Overseer's calls in this file

1. Friday to Sunday price 1.0: a player who never shops ahead pays v3.1 prices, so the bands hold.
2. Prep is a 4 point Quality cushion that cancels penalties and stops at 20; Prep and Load-in do not stack; a booking change keeps it.
3. Overnight smoke: 2 pieces, 2 bags, the slowest qualifying meat, held out of stock overnight so it never spoils; Saturday bookings only.
4. Friday also offers a Day off.
5. Weekend Yard days are full length, weekday ones half; no Yard day writes a season result; a week with no played booking writes `{ yard, 0 }` at the Sunday tick.
6. The booked day cannot be skipped; Load-in locks the booking; a day gone by cannot be booked.
7. The finale is on Saturday; no Tailgate type in v3.2.
8. Day off lifts mood one step to Happy at most and clears notice above -2; no wages or daily costs on quick days.
9. `train(id)` stays as an alias on Monday to Thursday.
10. The day ticks inside `chooseDay`, so a save is always the next morning and a reload never repeats a day; the result card is display only.
11. The day strip is display only; the day hints hide first when the hub runs long.
12. Rain rolls each day and touches only Yard days.
13. The v5 to v6 notice reuses `ui.notice`.

## D12. Integration record

(The integrator fills this: suites run, step results, econ bands, any tuning, deviations.)
