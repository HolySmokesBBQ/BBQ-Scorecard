// games/pit-sim/sim.js
// Pit sim, backyard rung: the whole game as pure state and rules. No DOM, no canvas, no timers,
// no browser storage. Randomness only through the seeded generator on the sim object. Runs in
// Node under vm.runInThisContext and in the browser as a classic deferred script.
//
// v3.2 Days: docs/superpowers/specs/2026-10-19-pit-sim-v3-2-days-contract.md (D1 to D12) wins
//           over everything below. Sim builder deviations, for D12:
//   V32-1. A weekday opens with an empty cart; Monday (as startWeek() leaves it) and the cook day
//          get the prefill, and after the booking has played the cart is empty. A prefilled
//          Friday cart committed by Load-in spoiled overnight without a cooler and cost the
//          steady bot its drum band (S2W5 against S1W8).
//   V32-2. A Market run or a Load-in commits only a cart the cash pays for (no deposit before the
//          booked day); a Market run it cannot pay for reads ui.goCash.
//   V32-3. Train with no crew card reads ui.crewEmpty (D4.1 says ui.trainDone, which would claim a
//          training that never happened).
//   V32-4. A booked day whose event cannot load also offers Day off, so the week never strands.
//   V32-5. The bare train(id) keeps v3.1's rule and does not end the day; chooseDay('train')
//          applies the same rule and ends it.
//   V32-6. Saves: a report save is the next morning (Sunday's report the next Monday); a mid event
//          save keeps the pick, the walk-ins and the training pick (live); a v6 save may hold this
//          week's result once the booking played; the day keeps without a pick, Load-in never.
//   V32-7. till.cashStart is the cash this day opened with (quick days move cash mid week).
//   V32-8. (playtest) Monday opens with an empty cart too: only the booked day (or a Yard week's
//          weekend day) gets the prefill, so a Monday Market run or Yard day never buys the
//          weekend's meat to spoil Monday night. Picking or changing a booking still prefills.
//   V32-9. (playtest) dayOptions() rows carry warn: a Market run, Yard day or Load-in whose meat
//          is past tonight's cooler room says so (ui.marketSpoil, ui.yardSpoil); a Load-in after
//          Prep with nothing to put on overnight says it only locks the booking (ui.loadinSame),
//          and its card reads ui.cardLoadinSame instead of a second Prep line.
//   V32-10. (playtest) a Monday to Friday Yard day scales the gate by YARD_DAY_FRAC as well, so
//          the half day keeps its service window instead of losing it to setup.
//   V32-11. (playtest) the DayCard adds trained ({ id, name, xp } after Train), moodTop (a Day off
//          that moved no mood because the crew is already at the cap) and loadinSame.
//
// Contract: docs/superpowers/specs/2026-10-19-pit-sim-v3-1-contract.md (X0 to X18, the v3.1
//           round) first, then docs/superpowers/specs/2026-10-18-pit-sim-v3-0-contract.md (W0 to
//           W26, the v3.0 round), then docs/superpowers/specs/2026-10-18-pit-sim-contract.md (the
//           v2.1 section K0 to K14, then the v2 delta D0 to D16, then section 2 read with v2
//           coordinates).
// Rules:    docs/superpowers/specs/2026-10-18-pit-sim-v3-season-design.md (section 19 first),
//           then docs/superpowers/specs/2026-10-18-pit-sim-v2-1-tutorial.md (sections 2, 3 and 5),
//           then docs/superpowers/specs/2026-10-18-pit-sim-design.md, top section "v2" first.
//
// Version: v3.1 (2026-10-19). Crew cards: the buddy and the fire tender become RUN and FIRE cards,
//          a PREP card slices what you leave on the board; two skills per role tune the cook
//          constants by stars; mood with notice, wages per event worked, the payroll budget and
//          roster slots; Hiring Day each season with 18 applicants, other outfits and tryouts;
//          walk-ins; the weekly training pick; XP, banked levels and the raise; crew rows on the
//          report; save version 5 with the v2 hires migrated to cards. The four v3.0 playtest
//          carry-forward items: offers that vary by menu, size and a safe or stretch tier, the
//          word of mouth third paying on the fee with a third card at the top, booked guests
//          pulled forward when the line sits empty, and the report's till fields for the compact
//          money table.
// v3.0 (2026-10-18, night). The season: nine weeks with Birthday and Church picnic
//          bookings, the Yard day and the Season finale in week 9; deposits, booked headcounts
//          and menus, client stars and the fee, fan rating thirds, the event length setting, the
//          season end, the creator's profile and pit name, the rolling inventory with cooler
//          capacity, save version 4 and two tutorial strand fixes. v2.1 underneath: the guided
//          tutorial day, the burn warning, the 11 by 12 yard, seats, decor and charm.
//
// Deviations
// 1. (Now the contract rule, section 1 as corrected; kept so the numbers below stay stable.) The
//    file body is wrapped in a function expression so `const PitSim` is not a global lexical
//    binding shared with the other two scripts.
// 2. The buddy's handling pause (C.BUDDY_HANDLE) is also used as the fire tender's grab and add
//    pause, since the spec gives the tender no handling number of its own.
// 3. The Coming next test (drum owned and cash at or above the driveway price) is re-evaluated
//    after a gear purchase as well as at the start of a morning, so buying the drum with 1000 or
//    more left shows the card that same morning.
// 4. buy() on a meat or charcoal line also caps the line so that stock plus cart stays at or
//    under C.STEPPER_MAX, so serialize() always round trips through validateSave unchanged.
// 5. continueFromBroke() returns true whenever it is morning and the Broke test is false now,
//    whether or not state.broke is still set, because sell() updates state.broke itself after
//    each sale (as the contract says) and would otherwise leave nothing for Keep going to do.
// 6. Fire decay lands once per whole second of each cooker's own timer, reset by a bag, instead
//    of a fraction every tick: same rate, and a fresh light reads exactly FIRE_LIGHT for one
//    second, which the harness's settle and check needs.
// 7. interact() on a row the table marks as no-op returns { ok: false, verb, message } with
//    message equal to the row label, as the contract says; outside service, paused or while
//    slicing it returns ok false with verb and message equal to the verbAt() label in effect.
// 8. Sold out (clock at or past GATE_OPENS, no stock, no raw or done piece on any grate, nothing
//    on the board or table, no slice running, nothing but charcoal or a burnt piece in anyone's
//    hands) closes out the line and stops arrivals on every such tick (v2: V2.5 step 9); the day
//    ends on the first such tick with no customer in toSeat or eating.
// 9. Order rule 4 never invents a meat. A hands rule orders from what the player or the buddy is
//    carrying; when nothing is anywhere rollOrder returns null and the customer walks to the pass
//    stop and leaves at no cost, with walk_past { id, reason: 'soldout' } ('full' otherwise).
// 10. A slice that finishes hands the player the first plate (or two with the tray) from the
//    stack chooseBoardStack() picks, so the next tap is not always Take.
// 11. walkTo() during a slice stores the tap in state.player.queued ({ tx, ty }), returns true
//    and emits tap_queued (no payload); the walk starts the tick the slice completes.
// 12. On a day 1 morning with an empty cooler and no charcoal the cart starts at 3 sausage,
//    2 chicken and 5 bags instead of empty, so the first screen has a sensible default.
// 13. sim.expectedCrowd() returns round((LAST_CALL - GATE_OPENS) / spawnInterval()) for today's
//    rep and weather.
// 14. (Now contract D2.) C carries PATIENCE_MID_FRAC 0.5 and GEAR_RESERVE 30.
// 15. Retired in v2: grate slot pixels are contract D4's slotPx again.
// 16. v2: a mover carries the distance left over after reaching a tile into the next tile of its
//    path within the same tick. At 6 tiles a second a step is 4.8 px and a tile is 16 px, so
//    snapping to the tile and dropping the rest (the v1 mover) would walk at 5 tiles a second.
//    NPCs at 4 tiles a second (3.2 px, 5 ticks a tile) move exactly as before.
// 17. v2: at the hard end, after the seat bonuses are paid with atClose true, every customer still
//    in toSeat or eating is set to leaving (reason 'seated', mood happy, seat freed, route to the
//    spawn), so no customer is left in toSeat or eating once the till is up. The yard is frozen
//    in the evening, so they do not walk; the next open clears the yard.
// 18. v2: a passing customer keeps reason null, as v1 shipped it ('past' stays unused).
// 19. v2: player and customer walkability are computed from state on every call (no cached grid),
//    so they always follow state.gear and state.decor.
// 20. v2: the dog is not in the sim (contract D0 and D14: it lives in game.js as PitSim.game.dog).
//    The sim gives it MAP.dogHome, MAP.dogRoam and sim.custWalkable(x, y, -1, -1).
// 21. Integration, 2026-10-18 (now contract D4): (5,1) is dropped from the use tiles of kettle1
//    and the cooler. It sits in a closed pocket with (4,1), boxed in by the shed, the pile,
//    kettle 1, the cooler and the back fence, so no BFS could ever reach it. Play is unchanged.
// 22. Review round 1, 2026-10-18 (now contract D4 and D2): four props fill dead pavers. woodpile2
//    (4,1) and woodpile3 (5,1) close the pocket of deviation 21 so it no longer reads as empty
//    floor; planter2 (1,4) and shelf (2,3) fill a dead end and a spare tile in the cook area. With
//    every gear and decor state, every station use tile, buddyIdle and tenderIdle stay reachable
//    from the spawn. C.FX: NUMBER_S 1.4, NUMBER_FADE_AT 1.0, NUMBER_RISE_PX 14, TIP_GAP_PX 11
//    (the cash and tip pills no longer overlap), HEART_S 1.4, HEART_RISE_PX 12. Cosmetic only.
// 23. Review round 2, 2026-10-18 (now contract D4 and D2): three more props fill dead tiles. pot3
//    (4,8) sits in the lawn nook between the two picnic tables, pot4 (2,2) under the shed window
//    and woodpile4 (9,4) by the right fence; none is a seat, footprint, queue, spawn, idle or use
//    tile, and every seat still reaches the customer spawn with every gear and decor state. (4,8)
//    leaves MAP.dogRoam. C.FX.TIP_GAP_PX is -11, so the tip number stacks above the cash number.
//    KETTLE_SLOT_PX is (0,-7) (6,-7): the two grate pieces stay inside the kettle's 16 px and
//    overlap 4 px in the middle. Cosmetic only; no rule or economy number changed.
// 24. v2.1: skipTutorial() in service on a latched step (customer, seated or end) sets
//    spawnAt = min(spawnAt, clock) instead of plain clock. On customer and seated spawnAt is
//    Infinity, so it is the contract's clock; on end it keeps the normal arrival already timed
//    instead of spawning a second customer on the next tick.
// 25. v2.1: createSim(saved) runs the tutorial from a save only when saved.tutorial.done is false
//    and saved.day is 1, the same test validateSave applies, so an unvalidated object passed in
//    by hand cannot start the tutorial on a later day.
// 26. v2.1: the latched steps are checked in a loop, so if two latch conditions are met in the
//    same check (a to go serve sets served and togo together) the sim emits tutorial_step for
//    seated and then for end in that one call, never skipping an id.
// 27. v2.1: no shop line names a done window ([T 3.5]), so CATALOG text is unchanged.
//
// v3.0 deviations (contract W21 item 24 names the first three as Overseer's calls to restate here)
// 28. W22.1, Overseer's call: state.player stays the v2 mover (x, y, carrying, busy, path...). The
//     creator data lives in state.profile, null or { name, look }. The save key stays player;
//     serialize() and validateSave() map it to and from state.profile.
// 29. W22.9, Overseer's call overriding [S 5.4] and [S 3.3]: quality counts every piece that
//     burnt during the event (today.burnt, pieces left on the grate included), and the Menu bonus
//     needs at least one add-on plate served with no add-on piece burnt. An unfed booked guest
//     (walked out, missed or closed out) counts as 60 s of wait.
// 30. W22.12, Overseer's call: hire('buddy') keeps its day 2 rule only in loop 'tutorial'; in
//     loop 'week' the buddy has no day gate. The tender keeps its drum need.
// 31. W22.18: no C value moved. Every W2 key ships at its contract starting value. A scratch run
//     of the W20 and W22.19 season bot against this file (50 seeds, 5 seasons, settle() for
//     bookings, the v2.1 competent bot for Yard days; the official run is dev/econ.mjs's) gave
//     drum medians sharp S1W6, steady S1W8, rough S2W2 with the decor in the spend order, so
//     sharp misses its S1W4 band by two weeks: the continue rule spends on the tray, cooler,
//     canopy, bigger table and decor while the drum is out of reach. With gear only in the order
//     the medians are S1W4, S1W6 and S1W9 and every band passes. Driveway affordable (info):
//     S1W8, S2W4, S2W9 (decor) or S1W7, S2W4, S2W7 (gear only). Never stuck, never under 0 and
//     never idle in both. None of the keys W22.18 lets this builder tune moves sharp two weeks,
//     so the call (the bot's spend rule or the fee multiplier) is the Overseer's.
// 32. filterName() and cleanName() read undefined and null as the empty string, so a missing
//     name falls back to Pitmaster or Your Pit; every other input goes through String() in a try.
// 33. The W12.2 tutorial refills run only before the gate (clock under C.GATE_OPENS), which is
//     every unlatched step, since the tutorial clock holds at 0 until the first plate lands. That
//     is how W22.16 (b) keeps a sold out tutorial day ending once the customer steps start.
// 34. beginMorning() skips the Broke test when the next loop is 'creator' as well as 'week'
//     (W22.4 names 'week'). The Broke card belongs to the week hub; startWeek() runs the test with
//     the deposit on offer when the creator hands over.
// 35. prefill() and the Yard day plate count take Math.ceil(x - 1e-9) where the contract writes
//     Math.ceil(x), so a float product that lands a hair over a whole number reads as that number.
// 36. prefill() keeps the cart inside the W10.2 meat room by taking one unit at a time off the
//     costliest meat line, so a cooler full of off menu meat gives a smaller cart instead of one
//     that buy() would refuse. This runs before the affordability phases of W22.14.
// 37. createSim(saved) runs every save through validateSave() first (a valid v4 save comes back
//     unchanged); an object that does not validate starts a new game.
// 38. setLength() in the tutorial morning sets the setting and emits save_wanted
//     { reason: 'settings' }; the tutorial day itself always runs at Normal (W7.1).
// 39. A buy() increase that meatRoom() cuts short keeps the part that fits (ok true) and carries
//     the coolerFull message; one with no room at all returns ok false with it.
// 40. setAddon(null) is legal on any week pick, the Yard day included; a meat on the Yard day is
//     refused with STRINGS.ui.addonNo.
// 41. guests_missed at last call is emitted right after last_call in the same tick.
// 42. Till.label on the tutorial day reads STRINGS.booking.yard (the tutorial day is a pre season
//     Yard day). game.js keeps its own Day 1 till heading.
// 43. canLoadUp() also returns { ok: false, reason: '' } while the Broke card is up (state.broke),
//     as v2's canOpen() did. In v3.0 the Broke test never fires in the week.
// 44. settle(stars) needs an integer 1 to 5; anything else returns false.
// 45. Leaving the report for the season end card clears the yard as a morning does (customers,
//     helpers, seats, slicing) without the rain roll, and empties the cart.
// Integration (v3.0 integrator, recorded in contract W23):
// I-1. booking_picked carries { id, booking } instead of W14's { id, type }: emit() builds { type, ...payload },
//      so a payload key named type replaced the event type ('picnic' instead of 'booking_picked').
// Playtest round 1 (2026-10-19, recorded in contract W24; each is an Overseer's call):
// P-1. A booking is a stretch when its rail needs more grate time than the owned cookers give:
//      slot seconds = sum over rail meats of ceil(plates / MEATS[m].plates) * slots * cook, against
//      grate slots * (GATE_OPENS + window) * C.SAFE_LOAD. The Needs line names the cooker that
//      makes it fit (ui.needsKettle2, then ui.needsDrum). The finale and the Yard day are exempt.
//      The one kettle Church picnic (270 against 176) is a stretch; on two kettles it is safe.
// P-2. Client stars: quality scales with the share of booked guests fed, and a booked plate served
//      HOT_PLATE_SECONDS or more after it was sliced costs C.COLD_PENALTY (today.cold). Pay:
//      PAY_BASE 0.3 and PAY_PER_STAR 0.14 (was 0.5 and 0.1): 1 star pays 44 percent of the fee,
//      2 stars 58, 3 stars 72, 4 stars 86, 5 stars 100. (The playtest's 0.2 and 0.16 put rough
//      under 0 in 7 of 50 seasons: a Yard day with the fire tender's wage on low cash.)
// P-3. Till.net for a booking also takes off the meat used (foodCost plus raw meat thrown out,
//      today.rawWaste), the charcoal burnt and tonight's spoilage, so the report's rows add up to
//      Take today. The Yard day and the tutorial keep the v2 formula.
// P-4. Gear and decor bought in the week may count the picked offer's deposit toward the cart:
//      price <= cash and cash + deposit - cart >= price. Cash never goes under 0 at the purchase.
// P-5. prefill() adds the spare (SPARE_FRAC, the Yard day's 1.1 and +1) only with a cooler, so the
//      default cart does not spoil a unit of each meat every night without one.
// P-6. The tutorial's full grate row points at the cooler (put it back, no waste) with a two line
//      banner; pending guests turned away by the sold out rule set today.soldOutMiss.
// Playtest round 2 (2026-10-19, recorded in contract W25; each is an Overseer's call):
// R-1. canBuy(id) is the gear and decor rule of P-4 as a pure check, { ok, message, left }, where
//      left is cash + the picked deposit - cart - price. buy() runs it, and game.js greys the Buy
//      button and words the "Leaves N" line from it, so a buy the sim allows is never shown as dead.
// R-2. The board takes one stack per meat (C.BOARD_STACKS 5) of up to C.BOARD_STACK 14 plates, two
//      of the largest piece; a slice that would overrun its meat's stack opens a second one while a
//      stack is free. Two pork butts in a row (10 plates) no longer leave a cooked butt stuck in the
//      hands. When nothing fits, the button reads "Board is full. Use the trash".
// R-3. The Season finale books the most guests, up to its row's 40 at the length, whose rail fits the
//      owned grate at SAFE_LOAD (slotSeconds against grateSeconds, the P-1 test): 9 on one kettle, 25
//      on two, 40 with the drum, at Normal. The fee follows the formula. GOAL_ORDER puts the drum
//      second, so Pit news points at it once the second kettle is owned.
// R-4. The till carries gearSpent and gearBought (gear and decor bought that morning, from purchase
//      calls; not saved) and cashStart (the week's weekCash, or the cash the tutorial morning opened
//      with), so the report can show the rows between Take today and Cash.
// R-5. BAGS_PER_COOKER 6 (was 5): a full cook with the fire kept in the good band burnt the prefill
//      to 0 or 1 bags. Bags roll over, so the spare is never lost. It is a Normal cook's worth: the
//      prefill scales it by the length's seconds, rounded up (5 a cooker at Short, 8 at Long).
// Playtest round 3 (2026-10-19, recorded in contract W26; each is an Overseer's call):
// Q-1. Booked guests keep joining the line until the hard end (less LAST_CALL_GUARD), not until last
//      call: last call only closes the gate to new arrivals of a Yard day. Guests still waiting at
//      the hard end give up then (missPending() before endDay()), and guests_missed fires there.
// Q-2. The Season finale ignores the length setting, as [S 3.4] already says of the competition: it
//      runs C.FINALE_SECONDS (160) with a 105 s window at Normal's headcount factor, so a 5 meat,
//      40 guest rail can finish. R-3's grate sizing reads the longer window: 16 guests on one kettle
//      (fee 190), 33 on two (390), 40 with the drum (560), at every length. Prefill bags scale by the
//      finale's 160 s (8 a cooker).
// Q-3. The cooler's put back runs on a tap (auto) when no owned cooker has a free slot for the raw
//      piece in hand, so the tutorial's full grate row, whose arrow points at the cooler, works by
//      tapping the cooler. With room on a grate it stays a button verb, so a second tap on the
//      cooler never undoes a take.
// Q-4. Hands full with a cooked or burnt piece names where it goes ('Slice it at the board',
//      "That's burnt. Trash it"), as plates already do.
// Q-5. The Birthday's window is 60 s (was 80): the twelve guests arrive in about 54 s, so the easy
//      week is a shorter, denser cook. It still fits one kettle (108 slot seconds of 144).
// Q-6. sim.gateWaiting(): booked guests whose time has come but who wait off canvas for a line spot,
//      so the rail can show them.
// Q-7. startWeek() preselects last week's booking type when it is offered and safe this week, else
//      the first card (W21 item 5 still holds for week 1 and after a Yard day).
// Q-8. C.DRIVEWAY_BUYABLE false (v3.3 flips it): the Coming next card never shows and goal() skips
//      the driveway, so Pit news names something the player can buy.
// Q-9. The till carries charcoalStart and stockStart (the pile and cooler before the cart went in),
//      so the report can say what the stock row holds.
// Q-10. New W15 keys for game.js: ui.covers, ui.otherMeats, ui.offMenu and ui.noSpare (the shop at a
//      booking), ui.practice (the tutorial morning), ui.mixShort (the pre-gate status line),
//      ui.missedTable and ui.finaleTable (the bigger table). ui.coolerRoom and ui.coolerNone say
//      units of meat. The charcoal row says six bags a cook.
// Q-11. ui.rowKept reads "Bought for later" and ui.rowDrawn "Paid for in an earlier week" (the report
//      shows them as information rows with the items in the detail).
//
// v3.1 deviations (contract 2026-10-19-pit-sim-v3-1-contract.md; X18 item 25: every call that touches
// this file is restated here, then the builder's own choices)
// Overseer's calls built here (X18 and X18.1, by number):
// X-1.  Roles RUN, FIRE and PREP; one card a role works a cook, and bringing a second card of a role
//       rests the first (setBring reports the swap with ui.oneRole). (X18 items 1, 7)
// X-2.  Skills drive the [S 6.3] curves through skillValue(); RUN Friendliness drives both the handle
//       pause and the seat tip share on plates the RUN card carried. (item 2)
// X-3.  The PREP card slices only pieces left on the board (the Leave verb while the board holds
//       fewer than PREP_WAIT and has room next to the waiting pieces of that meat); a waiting piece
//       is the PREP card's; 'Board is busy' while a slice runs. (items 5, 39)
// X-4.  The FIRE card works from the first kettle; validateSave keeps the drum check only for a
//       legacy v2 tender being migrated. Its pauses and walk stay v2's. (items 6, 40)
// X-5.  Mood steps run in a fixed order from the end of event moods, with their own seeded crewRng;
//       nothing in the crew rules draws from rng(). Notice at -2, one more event, then moving on
//       unless the mood rose. (items 8, 9)
// X-6.  Levels bank (to BANK_MAX, a level past it is lost) and are spent by hand; the wage moves
//       only when a contract renews, and until v3.2 every contract renews for one season at the table
//       wage. (items 10, 11, 43)
// X-7.  Hiring Day pools are six of each role, saved while open, other outfits take 3 of the 6 best
//       open cards after every round; pool and walk-ins draw from the season seed. (items 12, 13)
// X-8.  Walk-ins come trained, sign for one season, cost one event's wage and go at the week's end;
//       a reload keeps their hired flags and the training pick. (items 14, 31)
// X-9.  A migrated hire has worked 1 (a send-off to let go) and skips Hiring Day in its season;
//       state.hires and the hires save key are gone and hire() is an inert stub. (items 17, 18)
// X-10. Offers vary by menu pair, size and tier inside the v3.0 types (item 19, X3.4): one ry() draw
//       per types index (item 27), the rotation steps past a pair the gear cannot cook when the first
//       pair can (item 26), the stretch is the gear stretch or one rv() draw sized at STRETCH_LOAD
//       (item 28), the invite repeats the best paying loadable type with its next cookable pair
//       (items 21, 29). The third pays on the fee, 1.0, 1.1 and 1.2 (item 20, overrides [S 9]).
// X-11. Booked guests pull forward after ARRIVAL_PULL_S of an empty line while food cooks, timed by
//       a closure timer (items 22, 38).
// X-12. crewSpent and crewPaid live in a closure like the R-4 gear rows, cleared in beginMorning and
//       startWeek, so Hiring Day send-offs never reach the week 1 report (item 32). Letting go a card
//       drafted the same Hiring Day turns its pool entry taken (item 33). Saved pool and walk-in
//       names are checked within their own list and hiring keeps only for this season (item 34).
//       Only untried pool entries hide potential (item 35).
// X-13. CrewRow.line by item 37; goodPct and the held count read fireGoodS and fireDipped, sampled
//       once a tick after tickFire from the gate on. Movers carry cardId, eff and vals (item 41).
//       Placeholders by item 42. trained validates as 1 to crewSeq - 1 (item 44); hireApplicant
//       guards CREW_MAX (item 45).
// X-14. Item 48, the felt-difference margin: at the starting values step 67's FIRE scenario (seed 72)
//       gave 74.95 good seconds at 1 star and 95.05 at 5, 1.268 times, under 1.30. The 1 star column
//       of SKILL_CURVE.fireSense moved 45 to 40 (old 45, new 40): 59.95 and 95.05, 1.585 times.
//       firePace stays [5.0, 4.0, 2.5]; the 3 star column never moved. RUN (seed 71): plates in
//       10 s 4 and 8, fed in 4 s 2 and 3, mean wait 3.80 s and 2.00 s. PREP (seed 73): 10.85 s and
//       4.90 s. The tip perk only shows at charm 10 and up (seatBonus 2 or 3).
// The builder's own choices:
// V-1.  tryout() emits only the tryout event (X6.2 names no save_wanted there); the tryout is saved
//       at the round's end, so a reload before then hands the tryout back.
// V-2.  levelUp's mood lift (both skills at potential) also clears notice once the mood is above
//       -2, as giveRaise does, so a card lifted out of -2 by a level never leaves on its old notice.
// V-3.  Item 26's second Needs card (only possible on a stub types list at rep 34 and up) keeps its
//       step 6 rv() draw so the stream stays one draw per other picked card, and is not resized.
// V-4.  train() emits level_ready before trained (the level banks as the XP lands), then save_wanted.
// V-5.  The pull forward check runs in tickBookedSpawns before the spawn loop, so a pulled party
//       joins the line that tick: the longest empty line while food cooks measures 2.95 s.
// V-6.  A load into Hiring Day drops every event the load made, the morning's rain event included.
// V-7.  hireWalkin() also refuses at CREW_MAX (unreachable with 2 slots).
// V-8.  CrewRow.stat.goodPct carries the event's percent on every lineup row (0 on a resting row);
//       only the FIRE line prints it.
// V-9.  cardStars() clamps each skill to 1 to 5 before averaging; validateSave takes the first three
//       of a longer walk-in list; a new card takes a free list name if its own is on the crew already
//       (defensive), and state.crew stays in id order.
// V-10. setLength() stays week and tutorial only (X7 adds no Hiring Day row), so a bot or a player
//       sets the length from the week hub.
// The X16 run (a scratch copy of the season bot following X16, 50 seeds, 5 seasons, run before
// dev/econ.mjs carried the X16 bot). Every enforced check passed at Normal, Short and Long with
// the starting values (fireSense aside, which no settle() event reads). Normal: drum medians sharp
// S1W3, steady S1W5, rough S1W6 (bands S1W4, S1W8, S2W9); Driveway affordable (information) S1W6,
// S2W4, S3W2; stuck, idle, rough under 0 and over payroll all 0 of 50. Payroll share of pay and tips,
// seasons 2 to 5: sharp 10.1 percent (455 of 4488 a season), steady 16.6 (464 of 2784), rough 15.2.
// Median cash at the season ends: sharp 1530, 4271, 7007, 9670, 12492 (v3.0: 827, 2361, 3895, 5429,
// 6963); steady 319, 1247, 2335, 3339, 4352; rough 201, 519, 1031, 1543, 2044. Sharp holds more than
// v3.0: the stretch card (up to 1.4 times the guests at 1.15 times the pay) and the third's pay
// outrun the wages under settle(), which feeds every guest whatever the size. Short: sharp S1W4,
// steady S1W7, rough S1W8; Long: S1W3, S1W4, S1W5. The eager policy (information, item 47) is never
// stuck but never reaches the drum in five seasons at Normal (season end cash 129 to 158): two cards
// on every 3 star Birthday cost 389 a season against 956 of pay. In season 1 no card moved on under
// any policy; steady paid 35 send-offs over 50 seeds (benched cards drop to notice) and hired 3
// walk-ins. The X16 lineup rule needs a payroll order to stay inside 60 once renewed wages grow
// (FIRE first, then RUN while it fits, the rest resting); the scratch bot used that order.
// Integration (2026-10-19): dev/econ.mjs now carries the X16 bot. `node dev/econ.mjs --season` at
// Normal matches the scratch run on every drum median, both payroll shares and the sharp and steady
// season end cash; rough ends 201, 519, 1017, 1560, 2096, and in season 1 steady paid 7 send-offs
// and hired 3 walk-ins over 50 seeds (the scratch bot benched more). Recorded in [S 10.8].
// Review round 1 (2026-10-19, contract X20; each is an Overseer's call):
// R1-1. X20.1: SKILL_CURVE.runTip [-0.25, 0, 1.0] on Friendliness; a plate the RUN card set down tips
//       (1 + runTip) times the plate tip, and its seat bonus is seatBonus() + round(2 * runSeatTip).
//       Both add to today.crew[id].tips; crewSay.run names them.
// R1-2. X20.2: fireSense [40, 55, 88]; the FIRE card walks at NPC_TILES_PER_S * TENDER_CYCLE / firePace
//       clamped to FIRE_WALK (overrides X18.1 item 40 for the walk); prefill() buys a sharp FIRE card's
//       charcoal; today.fireHotS feeds crewSay.fireHot; XP_FIRE_BAG 3, XP_FIRE_HOLD 15.
// R1-3. X20.3: STRETCH_SIZE 1.2, STRETCH_MIN 1.1, STRETCH_PAY 1.1, STRETCH_EDGE 1.0; with no Needs card
//       the stretch is drawn only among the cards that would pay the most when sized up.
// R1-4. X20.4: a gear buy keeps every shown card's numbers (keepShown); only needs and safe follow.
// R1-5. X20.5: a lineup card at Fired up eases a step after an event; 5 and 4 star bookings lift only
//       up to Happy, a 5 star stretch lifts everyone a full step.
// R1-6. X20.7: a headliner (HEADLINER) per role in every pool; no walk-ins in week 1 and walk-ins at
//       their ceiling; pool, walk-ins and hosts avoid the crew's and the pitmaster's names.
// R1-7. X20.8: drawLook (HAT_SHARE) for pool, walk-in and migrated looks; long hair drops a cap.
// R1-8. X20.9: floorAfterTutorial() when the tutorial day hands over.
// R1-9. X20.13: LEVEL_XP 120; PREP savedS counts the knife; PAYROLL stays 60 (at 50 the econ sink check
//       failed for sharp, 7.8 percent).
// R1-10. X20.12: the new and changed STRINGS. The econ run after the round is in [S 10.9].

(function () {
'use strict';
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});

// ---------------------------------------------------------------------------------------------
// 2.1 Constants (contract 2.1 with the v2 delta D2)
// ---------------------------------------------------------------------------------------------

const C = Object.freeze({
  // day and world
  DAY_SECONDS: 125, GATE_OPENS: 30, LAST_CALL: 110,
  START_CASH: 80, START_REP: 20,
  WALK_TILES_PER_S: 6, NPC_TILES_PER_S: 4,
  TICK_SECONDS: 0.05, MAX_FRAME_DT: 0.05,
  // fire
  FIRE_LIGHT: 60, COLD_UNDER: 10, FIRE_ADD: 30, FIRE_MAX: 100,
  KETTLE_DECAY: 1.0, DRUM_DECAY: 0.6, KETTLE_SLOTS: 2, DRUM_SLOTS: 4,
  FIRE_GOOD: 50, FIRE_HOT: 85, HOT_MULT: 1.2,
  FIRE_LOW_WARN: 30, TENDER_THRESHOLD: 55, TENDER_CYCLE: 4,
  CHARCOAL_PRICE: 2,
  // v2.1 burn warning and tutorial ([T 5], contract K2)
  WARN_FRAC: 0.4,                     // the warning stage is the last 40 percent of a done window
  HOT_BURN_MULT: 1.0,                 // done pieces advance at this rate in the hot band (cooking keeps HOT_MULT)
  TUTORIAL_FIRE_FLOOR: 30,            // decay stops here during the tutorial (FIRE_LOW_WARN)
  TUTORIAL_END_S: 6,                  // sim seconds the last banner shows before the tutorial ends
  // customers
  SPAWN_MAX: 13, SPAWN_MIN: 5, SPAWN_JITTER_LO: 0.85, SPAWN_JITTER_HI: 1.15,
  PATIENCE_BASE: 45, PATIENCE_SPREAD: 10, PATIENCE_WARN_FRAC: 0.2, PATIENCE_MID_FRAC: 0.5,
  ORDER_FROM_TABLE: 0.8, HOT_PLATE_SECONDS: 30, TIP_RATE: 0.25, HOT_PLATE_TIP: 1,
  QUEUE_SPOTS: 3, QUEUE_SPOTS_BIG: 5, TABLE_SPOTS: 3, TABLE_SPOTS_BIG: 5,
  TABLE_STACK: 6, BOARD_STACKS: 5, BOARD_STACK: 14, TRAY_PLATES: 2,   // R-2: one stack per meat, two of the largest piece
  WALK_PAST_PAUSE: 0.8, LEAVE_TURN_SECONDS: 0.2,
  // staff
  BUDDY_HANDLE: 0.4, BUDDY_WAGE: 20, TENDER_WAGE: 30,
  // reputation
  REP_QUICK: 2, REP_OK: 1, REP_WALKOUT: -3, REP_QUICK_FRAC: 0.4,
  REP_DAY_MAX: 12, REP_DAY_MIN: -15, CLOSE_PENALTY: 0,
  // money
  DAILY_COSTS: 10, SELL_BACK: 0.5, STEPPER_MAX: 99, CASH_FLOOR: 0,
  DRIVEWAY_PRICE: 400, GEAR_RESERVE: 30,
  // weather
  RAIN_FROM_DAY: 4, RAIN_CHANCE: 0.15, RAIN_ARRIVALS: 0.6,
  // save clamps
  SAVE_VERSION: 6, MAX_DAY: 999, MAX_CASH: 999999, MAX_STAT: 9999999,   // D2: 6 (was 5)
  // v3.0 season and week [S 3], contract W2
  SEASON_WEEKS: 9,
  YEAR_MAX: 99,
  LENGTHS: Object.freeze({
    short: Object.freeze({ seconds: 90, window: 55, factor: 0.7 }),
    normal: Object.freeze({ seconds: 125, window: 80, factor: 1.0 }),
    long: Object.freeze({ seconds: 160, window: 105, factor: 1.3 })
  }),
  LENGTH_ORDER: Object.freeze(['short', 'normal', 'long']),
  BASE_WINDOW: 80,                    // the Normal window every booking window is written in
  LAST_CALL_GUARD: 5,                 // last call is never later than the hard end minus this
  // fees and pay [S 3.2], [S 3.3], [S 5.4]
  FEE_MULT: 1.25, FEE_ROUND: 5,       // fee = round to 5 of headcount x average plate price of the asked meats x 1.25
  DEPOSIT_FRAC: 0.3,                  // deposit = Math.round(fee * 0.3), credited at loadUp()
  PAY_BASE: 0.3, PAY_PER_STAR: 0.14,  // pay at the end = Math.round(fee * (0.3 + 0.14 * stars)) - deposit (P-2; was 0.5 and 0.1)
  ADDON_SHARE: 0.25,                  // share of the guests who order the add-on meat
  MENU_BONUS: 0.1,                    // Math.round(fee * 0.1) when the add-on was served with none burnt
  SPARE_FRAC: 0.1,                    // the cart prefill covers booked plates plus 10 percent
  BAGS_PER_COOKER: 6,                 // prefill bags per owned cooker, less the bags in the pile (R-5; was 5)
  LOW_CASH_BIRTHDAY: 60,              // cash under this at week start: a Birthday is always offered
  SAFE_LOAD: 0.8,                     // P-1: a booking is safe when its slot seconds fit this share of the grate time
  FINALE_SECONDS: 160,                // Q-2: the Season finale's hard end, whatever the length setting
  // offers by fan rating third [S 9]
  THIRD_EDGES: Object.freeze([34, 67]),   // rep >= 34 is the middle third, rep >= 67 the top third
  OFFER_SLOTS: Object.freeze([2, 3, 3]),  // booking slots per third, before the dedupe by type
  INVITE_THIRD: 2,                        // the top third adds one invite
  // client stars [S 5.4], [S 9]
  SCORE_FED: 60, SCORE_WAIT: 20, SCORE_QUALITY: 20,
  WAIT_FULL_S: 20, WAIT_ZERO_S: 60,   // average wait at or under 20 s scores full, at 60 s zero; an unfed booked guest counts 60 s
  BURNT_PENALTY: 4, OFFMENU_PENALTY: 2,
  COLD_PENALTY: 2,                    // P-2: per booked plate served HOT_PLATE_SECONDS or more after slicing
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
  PIT_NAME_MAX: 20,   // Joel 2026-10-19: room for a name like "Holy Smokes BBQ Co" (18)
  NAME_PUNCT: " '.-",                 // allowed besides ASCII A to Z, a to z and 0 to 9
  // season end [S 3.6]
  SEASON_CARRY_REP: 0.75, SEASON_REP_FLOOR: 20,
  // the driveway goal [S 7.1]
  DRIVEWAY_REP: 34,
  DRIVEWAY_BUYABLE: false,            // Q-8: v3.3 builds the Driveway; until then no Coming next card and no driveway goal
  // v3.1 crew cards [S 6], contract X2
  SKILL_CURVE: Object.freeze({                     // the value at 1, 3 and 5 effective stars; piecewise linear between [S 6.3]
    fireSense: Object.freeze([40, 55, 88]),        // the fire level the FIRE card keeps cookers above (X18.1 item 48: 1 star 45 to 40; review 1: 5 star 65 to 88)
    firePace: Object.freeze([5.0, 4.0, 2.5]),      // seconds between the FIRE card's adds (its cooldown)
    runSpeed: Object.freeze([3.5, 4.0, 5.5]),      // the RUN card's walk, tiles a second
    runHandle: Object.freeze([0.6, 0.4, 0.2]),     // the RUN card's pause at the board and at the table, seconds
    runSeatTip: Object.freeze([0, 0.1, 0.4]),      // extra share of the seat tip on a plate the RUN card carried
    runTip: Object.freeze([-0.25, 0, 1.0]),        // review 1: extra share of the plate tip on a plate the RUN card carried
    prepKnife: Object.freeze([1.4, 1.0, 0.6]),     // the PREP card's slice time as a share of MEATS[m].slice
    prepPace: Object.freeze([3.5, 4.0, 5.5])       // the PREP card's walk, tiles a second
  }),
  ROLE_SKILLS: Object.freeze({                     // the curve keys each skill drives, skill 0 then skill 1
    run: Object.freeze([Object.freeze(['runSpeed']), Object.freeze(['runHandle', 'runSeatTip', 'runTip'])]),
    fire: Object.freeze([Object.freeze(['fireSense']), Object.freeze(['firePace'])]),
    prep: Object.freeze([Object.freeze(['prepKnife']), Object.freeze(['prepPace'])])
  }),
  MOOD_STARS: Object.freeze([-1, -0.5, 0, 0, 0.5]),      // added to both skills during a cook, index mood + 2 [S 6.4]
  WAGE_TABLE: Object.freeze([10, 13, 16, 20, 24, 29, 34, 40, 46]),   // overall stars 1, 1.5, 2, ... 5 [S 6.5]
  ROLE_WAGE: Object.freeze({ run: 1.0, fire: 1.25, prep: 1.0 }),
  PAYROLL: Object.freeze([60, 90, 140, 220]),            // by rung index; v3.1 is always index 0, the backyard (review 1: kept, X20.13)
  ROSTER_SLOTS: Object.freeze([2, 3, 4, 6]),
  CREW_MAX: 8,                                           // cards a save may hold: the slots plus a full draft
  BENCH_STREAK: 2,                                       // booked events left home in a row that cost a mood step
  HIRE_ROUNDS: 3, POOL_SIZE: 18, POOL_PAGE: 9,
  TAKEN_PER_ROUND: 3, TAKEN_SHORTLIST: 6,                // other outfits take 3 of the 6 best open cards after every round
  TRYOUTS: 2,
  WALKINS: Object.freeze([2, 2, 3]),                     // walk-ins a week by fan rating third
  LEVEL_XP: 120, BANK_MAX: 9,                            // review 1: LEVEL_XP 200 to 120
  XP_RUN_PLATE: 3, XP_PREP_CUT: 3, XP_FIRE_BAG: 3, XP_FIRE_HOLD: 15,   // review 1: FIRE 1 and 10 to 3 and 15
  FIRE_WALK: Object.freeze([3.5, 5.5]),                  // review 1: the FIRE card's walk, NPC_TILES_PER_S * TENDER_CYCLE / firePace clamped to this
  HEADLINER: Object.freeze([2.5, 2]),                    // review 1: a role's first pool card draws each skill as 2.5 + floor(r() * 2) / 2
  HAT_SHARE: 0.25,                                       // review 1: the share of crew looks that wear a hat
  STRETCH_EDGE: 1.0,                                     // review 1: a drawn stretch pays more than this times every safe card
  TRAIN_XP: 40,
  SETTLE_XP: 30,                                         // dev: XP each lineup card gets from settle(stars)
  RAISE_FRAC: 0.2,
  PREP_WAIT: 2,                                          // cooked pieces the board holds for the PREP card
  // v3.2 days of the week [S 19.6], contract D2
  WEEK_DAYS: 7,
  YARD_DAY_FRAC: 0.5,                 // a Monday to Friday Yard day: the length row's seconds and window times 0.5, rounded [S 19.6]
  DAY_PRICE: Object.freeze([0.85, 0.9, 1.0, 1.1, 1.0, 1.0, 1.0]),   // meat and charcoal price by DayIdx; Mon to Thu per [S 19.6]; Fri to Sun 1.0 (OC)
  PREP_QUALITY: 4,                    // Quality points of cushion a prepped booked event starts with (D4.4)
  OVERNIGHT_HEAD: 0.5,                // share of MEATS[m].cook a load-in piece starts with
  OVERNIGHT_PIECES: 2,                // butt or brisket pieces that get the head start (OC)
  OVERNIGHT_BAGS: 2,                  // charcoal bags the overnight smoke burns at load-in (OC)
  OVERNIGHT_MEATS: Object.freeze(['butt', 'brisket']),
  DAYOFF_MOOD: 1,                     // mood steps every card gains on a Day off [S 19.6]
  DAYOFF_MOOD_CAP: 1,                 // a Day off lifts mood to Happy at most (OC)
  BOOK_DAY: Object.freeze({ birthday: 5, picnic: 6, finale: 5, yard: null }),   // [S 19.6]; finale Saturday (OC)
  // offers that vary week to week (X3, carry-forward 1 and 2)
  SAFE_SIZES: Object.freeze([0.8, 0.9, 1.0]),            // the safe card's headcount factor, one draw
  STRETCH_SIZE: 1.2, STRETCH_MIN: 1.1,                   // the stretch card's headcount factor: the largest that fits, from 1.2 down to 1.1 (review 1: 1.4 and 1.15)
  STRETCH_LOAD: 1.0,                                     // the stretch card fits the grate at this load instead of SAFE_LOAD
  STRETCH_PAY: 1.1, STRETCH_PATIENCE: -5,                // review 1: STRETCH_PAY 1.15 to 1.1
  THIRD_PAY: Object.freeze([1.0, 1.1, 1.2]),             // fee factor by fan rating third
  // booked arrivals (X5.10, carry-forward 3)
  ARRIVAL_PULL_S: 3,
  // seating and charm [V2.5], [V2.6]
  EAT_MIN: 8, EAT_MAX: 12,            // seconds a seated customer eats: EAT_MIN + (EAT_MAX - EAT_MIN) * rng()
  HEART_SECONDS: 0.6,                 // seated pause after the bonus is paid, before standing up
  SEAT_BONUS_BASE: 1, SEAT_BONUS_MAX: 3,
  CHARM_STEP: 10, CHARM_MAX: 30,      // seatBonus = min(MAX, BASE + floor(charm / STEP)); repMax = REP_DAY_MAX + floor(charm / STEP)
  REP_TOGO_QUICK: 1,                  // word of mouth for a quick serve taken to go
  // cues the sim does not act on but game.js reads [V2.9]
  SWEAT_FRAC: 0.25,                   // sweat drop at or under this fraction of patience, mode 'waiting' only
  ZZZ_AFTER: 3,                       // sim clock seconds the buddy spends in task 'idle' before zzz
  FX: Object.freeze({
    NUMBER_S: 1.4, NUMBER_RISE_PX: 14, NUMBER_FADE_AT: 1.0, TIP_GAP_PX: -11,
    SPARKLE_S: 0.45, SPARKLE_FRAME_S: 0.15, SPARKLE_STAGGER_S: 0.05,
    HEART_S: 1.4, HEART_FRAME_S: 0.4, HEART_RISE_PX: 12, HEART_FADE_S: 0.3,
    EAT_FRAME_S: 0.35,
    PUFF_EVERY_LOW: 0.9, PUFF_EVERY_GOOD: 0.45, PUFF_EVERY_HOT: 0.3,
    PUFF_LIFE_MIN: 1.1, PUFF_LIFE_MAX: 1.4, PUFF_RISE_PX_S: 8, PUFF_DRIFT_PX_S: 3,
    BURNT_BURST_S: 0.5, BURNT_RISE_PX_S: 12, SHAKE_MS: 120,
    BURNT_COLUMN_EVERY: 0.35, BURNT_COLUMN_LIFE: 1.2, BURNT_COLUMN_RISE_PX_S: 10, BURNT_COLUMN_SWAY_PX: 2,
    SWEAT_EVERY: 1.2, SWEAT_SLIDE_S: 0.6, SWEAT_SLIDE_PX: 3, SWEAT_SPLASH_S: 0.15,
    ZZZ_FRAME_S: 0.5, ZZZ_DRIFT_PX: 4,
    SQUASH_S: 0.12,
    WALKOUT_MARK_S: 0.6, TAP_RING_S: 0.35, FIRE_FPS: 6, TWINKLE_S: 0.5,
    BIRD_SHOW_S: 2, BIRD_GAP_MIN: 8, BIRD_GAP_MAX: 14,
    DOG_TILES_PER_S: 2, DOG_WAIT_MIN: 2, DOG_WAIT_SPREAD: 3,
    NOTICE_S: 4,
    ARROW_BOB_S: 0.3, WARN_BLINK_S: 0.25
  })
});

const SAVE_KEY = 'hs.pitsim.save';
const SERVED_HOP = 0.3;

// ---------------------------------------------------------------------------------------------
// 2.2 Meats (sausage 14 and chicken 22, contract D2 and [V2.19] item 1; v2.1 windows [T 3.1])
// ---------------------------------------------------------------------------------------------

const MEAT_IDS = Object.freeze(['sausage', 'chicken', 'ribs', 'butt', 'brisket']);

const MEATS = Object.freeze({
  sausage: Object.freeze({ id: 'sausage', label: 'Sausage', plateLabel: 'Sausage', unit: 4, plates: 2, cook: 14, window: 14, price: 5, slots: 1, slice: 3, drumOnly: false, key: '1' }),
  chicken: Object.freeze({ id: 'chicken', label: 'Chicken thighs', plateLabel: 'Chicken thighs', unit: 6, plates: 2, cook: 22, window: 16, price: 8, slots: 1, slice: 4, drumOnly: false, key: '2' }),
  ribs: Object.freeze({ id: 'ribs', label: 'Pork ribs', plateLabel: 'Pork ribs', unit: 12, plates: 3, cook: 32, window: 18, price: 11, slots: 1, slice: 5, drumOnly: false, key: '3' }),
  butt: Object.freeze({ id: 'butt', label: 'Pork butt', plateLabel: 'Pulled pork', unit: 20, plates: 5, cook: 40, window: 22, price: 14, slots: 2, slice: 6, drumOnly: false, key: '4' }),
  brisket: Object.freeze({ id: 'brisket', label: 'Brisket', plateLabel: 'Brisket', unit: 38, plates: 7, cook: 50, window: 26, price: 18, slots: 2, slice: 7, drumOnly: true, key: '5' })
});

const GEAR_IDS = Object.freeze(['kettle2', 'cooler', 'bigtable', 'tray', 'canopy', 'drum']);
const DECOR_IDS = Object.freeze(['chair1', 'chair2', 'flowers', 'birdbath', 'lights', 'picnic2']);
const SEAT_IDS = Object.freeze(['pt1b', 'pt1a', 'chair1', 'chair2', 'pt2b', 'pt2a']);
const HIRE_IDS = Object.freeze(['buddy', 'tender']);
const COOKER_IDS = Object.freeze(['kettle1', 'kettle2', 'drum']);
const STAT_IDS_V1 = Object.freeze(['days', 'served', 'walkouts', 'past', 'burnt']);
const STAT_IDS = Object.freeze(['days', 'served', 'walkouts', 'past', 'burnt', 'seated']);
const GOAL_ORDER = Object.freeze(['kettle2', 'drum', 'bigtable', 'driveway']);   // R-3: the drum second; X4.1: no buddy step (Hiring Day replaces it)
const ROLE_IDS = Object.freeze(['run', 'fire', 'prep']);   // X1
const DAY_IDS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);   // D1
const DAY_KINDS = Object.freeze(['yard', 'prep', 'market', 'train', 'off', 'loadin', 'event']);   // D1 DayKind
const DIRS = Object.freeze({
  up: Object.freeze({ dx: 0, dy: -1 }),
  down: Object.freeze({ dx: 0, dy: 1 }),
  left: Object.freeze({ dx: -1, dy: 0 }),
  right: Object.freeze({ dx: 1, dy: 0 })
});
const DIR_ORDER = Object.freeze(['up', 'down', 'left', 'right']);

// ---------------------------------------------------------------------------------------------
// D4 Map (replaces contract 2.3)
// ---------------------------------------------------------------------------------------------

const MAP_W = 11;
const MAP_H = 12;
const GRID_H = MAP_H + 1;   // BFS rows: the map plus row 12, where only the customer spawn (9,12) lives
const TILE = 16;
const T = Object.freeze({ PAVER: 0, FENCE: 1, GATE: 2, LAWN: 3, HEDGE: 4, BED: 5 });

// Ground only, row by row, [V2.2] and contract D4. P paver, F fence, G gate, L lawn, H hedge, B bed.
const GROUND_ROWS = Object.freeze([
  'FPPPFFFFFFF',   // y0: (1..3, 0) are pavers under the shed, which blocks them
  'FPPPPPPPPPF',   // y1
  'FPPPPPPPPPF',   // y2
  'FPPPPPPPPPF',   // y3
  'FPPPPPPPPPF',   // y4
  'FPPPPPPPPPF',   // y5
  'FHHHHPPPHHF',   // y6: (4,6) (8,6) hedge under the light posts; (5,6) (6,6) (7,6) pavers under the counter
  'FBLLLLLLLLF',   // y7
  'FBLLLLLLLLF',   // y8
  'FBLLLLLLLLF',   // y9
  'FBBBBBBLLLF',   // y10: (7,10) (8,10) lawn under the decor flower bed footprint
  'FFFFFFFFFGF'    // y11: (8,11) fence with the mailbox prop over it
]);
const GROUND_CHAR = Object.freeze({ P: T.PAVER, F: T.FENCE, G: T.GATE, L: T.LAWN, H: T.HEDGE, B: T.BED });

function buildTiles() {
  const tiles = new Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) tiles[y * MAP_W + x] = GROUND_CHAR[GROUND_ROWS[y][x]];
  }
  return Object.freeze(tiles);
}

function xy(x, y, extra) {
  const o = { x, y };
  if (extra) Object.assign(o, extra);
  return Object.freeze(o);
}
function use(x, y, face, gear) {
  const o = { x, y, face };
  if (gear) o.gear = gear;
  return Object.freeze(o);
}
function px(x, y) { return Object.freeze({ x, y }); }
function list(a) { return Object.freeze(a); }

const KETTLE_SLOT_PX = list([px(0, -7), px(6, -7)]);
const DRUM_SLOT_PX = list([px(-2, -4), px(8, -4), px(-2, 7), px(8, 7)]);

// Stations, in the v1 order with v1 ids and types and the v2 data of [V2.3] and contract D4.
const STATIONS = list([
  Object.freeze({ id: 'kettle1', type: 'cooker', label: 'Kettle 1', spoken: 'kettle 1', gear: null,
    tiles: list([xy(5, 2)]),
    use: list([use(6, 2, 'left'), use(5, 3, 'up')]),
    slots: C.KETTLE_SLOTS, decay: C.KETTLE_DECAY,
    sprite: 'kettle', draw: px(80, 24), sortRow: 2, slotPx: KETTLE_SLOT_PX }),
  Object.freeze({ id: 'kettle2', type: 'cooker', label: 'Kettle 2', spoken: 'kettle 2', gear: 'kettle2',
    tiles: list([xy(7, 2)]),
    use: list([use(6, 2, 'right'), use(8, 2, 'left'), use(7, 1, 'down')]),
    slots: C.KETTLE_SLOTS, decay: C.KETTLE_DECAY,
    sprite: 'kettle', draw: px(112, 24), sortRow: 2, slotPx: KETTLE_SLOT_PX }),
  Object.freeze({ id: 'drum', type: 'cooker', label: 'Drum smoker', spoken: 'the drum', gear: 'drum',
    tiles: list([xy(7, 3), xy(7, 4)]),
    use: list([use(6, 3, 'right'), use(6, 4, 'right'), use(8, 3, 'left'), use(8, 4, 'left'), use(7, 5, 'up')]),
    slots: C.DRUM_SLOTS, decay: C.DRUM_DECAY,
    sprite: 'drum', draw: px(112, 48), sortRow: 4, slotPx: DRUM_SLOT_PX }),
  Object.freeze({ id: 'board', type: 'board', label: 'Cutting board', spoken: '', gear: null,
    tiles: list([xy(5, 4)]),
    use: list([use(6, 4, 'left'), use(5, 3, 'down'), use(5, 5, 'up'), use(4, 4, 'right')]),
    sprite: 'board', draw: px(80, 64), sortRow: 4 }),
  Object.freeze({ id: 'cooler', type: 'cooler', label: 'Cooler', spoken: '', gear: null,
    tiles: list([xy(6, 1)]),
    use: list([use(6, 2, 'up'), use(7, 1, 'left')]),
    sprite: 'cooler', draw: px(96, 16), sortRow: 1 }),
  Object.freeze({ id: 'table', type: 'table', label: 'Serving table', spoken: '', gear: null,
    tiles: list([xy(6, 6), xy(7, 6), xy(5, 6, { gear: 'bigtable' })]),
    use: list([use(6, 5, 'down'), use(7, 5, 'down'), use(5, 5, 'down', 'bigtable')]),
    sprite: 'counter', draw: px(96, 88), sortRow: 6,
    spotPx: list([px(98, 92), px(108, 92), px(118, 92), xy(88, 92, { gear: 'bigtable' }), xy(80, 92, { gear: 'bigtable' })]) }),
  Object.freeze({ id: 'pile', type: 'pile', label: 'Charcoal pile', spoken: '', gear: null,
    tiles: list([xy(4, 2)]),
    use: list([use(4, 3, 'up')]),
    sprite: 'pile', draw: px(64, 32), sortRow: 2 }),
  Object.freeze({ id: 'trash', type: 'trash', label: 'Trash', spoken: '', gear: null,
    tiles: list([xy(3, 4)]),
    use: list([use(4, 4, 'left'), use(3, 3, 'down'), use(3, 5, 'up'), use(2, 4, 'right')]),
    sprite: 'trash', draw: px(48, 64), sortRow: 4 })
]);

function prop(id, sprite, frame, tx, ty, dx, dy, blocks, sortRow) {
  return Object.freeze({ kind: 'prop', id, sprite, frame, tile: px(tx, ty), draw: px(dx, dy),
    blocks: list(blocks.map((b) => px(b[0], b[1]))), sortRow });
}

// Fixed props, [V2.2.2] and contract D4, in this order.
const PROPS = list([
  prop('shed', 'shed', 0, 1, 1, 16, 0, [[1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1]], 1),
  prop('sign', 'sign', 0, 4, 0, 65, 2, [], 0),
  prop('tree', 'tree', 0, 9, 2, 128, 0, [[9, 2]], 2),
  prop('woodpile', 'woodpile', 0, 9, 1, 144, 16, [[9, 1]], 1),
  prop('tools', 'tools', 0, 1, 2, 16, 24, [[1, 2]], 2),
  prop('pot1', 'pot', 0, 1, 3, 16, 48, [[1, 3]], 3),
  prop('pot2', 'pot', 0, 9, 3, 144, 48, [[9, 3]], 3),
  prop('hose', 'hose', 0, 1, 5, 16, 80, [[1, 5]], 5),
  prop('planter', 'planter', 0, 9, 5, 144, 72, [[9, 5]], 5),
  prop('mailbox', 'mailbox', 0, 8, 11, 128, 168, [], 11),
  prop('picnic1', 'picnic', 0, 5, 9, 80, 136, [[5, 9], [6, 9]], 9),
  prop('bench1', 'picnic_bench', 0, 5, 8, 80, 136, [], 8),
  prop('woodpile2', 'woodpile', 0, 4, 1, 64, 16, [[4, 1]], 1),
  prop('woodpile3', 'woodpile', 0, 5, 1, 80, 16, [[5, 1]], 1),
  prop('planter2', 'planter', 0, 1, 4, 16, 56, [[1, 4]], 4),
  prop('shelf', 'shelf', 0, 2, 3, 32, 40, [[2, 3]], 3),
  prop('pot3', 'pot', 0, 4, 8, 64, 128, [[4, 8]], 8),
  prop('pot4', 'pot', 0, 2, 2, 32, 32, [[2, 2]], 2),
  prop('woodpile4', 'woodpile', 0, 9, 4, 144, 64, [[9, 4]], 4)
]);

function decorDraw(sprite, frame, x, y, sortRow, overhead) {
  const o = { sprite, frame, x, y, sortRow };
  if (overhead) o.overhead = true;
  return Object.freeze(o);
}
function decorSpot(id, tiles, blocks, seats, draws) {
  return Object.freeze({ kind: 'decor', id,
    tiles: list(tiles.map((t) => px(t[0], t[1]))),
    blocks: list(blocks.map((t) => px(t[0], t[1]))),
    seats: list(seats.slice()), draws: list(draws) });
}

// Decor spots, [V2.7] and contract D4, in DecorId order.
const DECOR = list([
  decorSpot('chair1', [[7, 9]], [], ['chair1'], [decorDraw('chair', 0, 112, 136, 9)]),
  decorSpot('chair2', [[8, 9]], [], ['chair2'], [decorDraw('chair', 0, 128, 136, 9)]),
  decorSpot('flowers', [[7, 10], [8, 10]], [[7, 10], [8, 10]], [],
    [decorDraw('bed', 0, 112, 156, 10), decorDraw('bed', 1, 128, 156, 10)]),
  decorSpot('birdbath', [[4, 9]], [[4, 9]], [], [decorDraw('birdbath', 0, 64, 136, 9)]),
  decorSpot('lights', [[4, 6], [8, 6]], [], [],
    [decorDraw('lights_post', 0, 64, 80, 6), decorDraw('lights_post', 0, 128, 80, 6), decorDraw('lights_string', 0, 71, 80, 6, true)]),
  decorSpot('picnic2', [[2, 9], [3, 9]], [[2, 9], [3, 9]], ['pt2b', 'pt2a'],
    [decorDraw('picnic_bench', 0, 32, 136, 8), decorDraw('picnic', 0, 32, 136, 9)])
]);

function seat(id, x, y, decor) {
  return Object.freeze({ kind: 'seat', id, x, y, face: 'down', decor });
}

// Seats, [V2.2.4] and contract D4, in SeatId order. Every seat faces down.
const SEATS = list([
  seat('pt1b', 6, 8, null),
  seat('pt1a', 5, 8, null),
  seat('chair1', 7, 9, 'chair1'),
  seat('chair2', 8, 9, 'chair2'),
  seat('pt2b', 3, 8, 'picnic2'),
  seat('pt2a', 2, 8, 'picnic2')
]);

const STATION_BY_ID = Object.freeze(STATIONS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {}));
const SEAT_BY_ID = Object.freeze(SEATS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {}));
const TILES = buildTiles();

// Tiles a fixed prop blocks, for everyone. Static.
const PROP_BLOCKED = (function () {
  const a = new Uint8Array(MAP_W * MAP_H);
  for (const p of PROPS) for (const b of p.blocks) a[b.y * MAP_W + b.x] = 1;
  return a;
})();

const MAP = Object.freeze({
  W: MAP_W, H: MAP_H, TILE,
  T,
  tiles: TILES,
  at(x, y) {
    if (!(x >= 0 && x < MAP_W && y >= 0 && y < MAP_H)) return T.FENCE;
    return TILES[y * MAP_W + x];
  },
  stripe(x) { return (x & 1) === 0 ? 'a' : 'b'; },
  stations: STATIONS,
  station(id) { return STATION_BY_ID[id]; },
  props: PROPS,
  decor: DECOR,
  seats: SEATS,
  SEAT_ORDER: SEAT_IDS,
  spawn: Object.freeze({ x: 6, y: 3, face: 'up' }),
  gate: px(9, 11),
  custSpawn: px(9, 12),
  passStop: px(9, 10),
  queue: list([
    Object.freeze({ x: 7, y: 7, face: 'up', gear: null }),
    Object.freeze({ x: 8, y: 7, face: 'left', gear: null }),
    Object.freeze({ x: 9, y: 7, face: 'left', gear: null }),
    Object.freeze({ x: 9, y: 8, face: 'up', gear: 'bigtable' }),
    Object.freeze({ x: 9, y: 9, face: 'up', gear: 'bigtable' })
  ]),
  buddyIdle: Object.freeze({ x: 4, y: 5, face: 'up' }),
  tenderIdle: Object.freeze({ x: 3, y: 2, face: 'right' }),
  prepIdle: Object.freeze({ x: 2, y: 5, face: 'right' }),   // X5.3: the PREP card's home
  prepUse: Object.freeze({ x: 4, y: 4, face: 'right' }),    // X5.3: where the PREP card slices (the board's use tile 3)
  dogHome: px(4, 7),
  dogRoam: list([px(2, 7), px(3, 7), px(4, 7), px(5, 7), px(6, 7), px(7, 8), px(8, 8)]),
  overhead: Object.freeze({ lights: px(71, 80), canopy: px(76, 106) }),
  signText: Object.freeze({ x: 67, y: 5, w: 58 })   // W16.5: the pit name is drawn into this box
});

// Contract D4: works on stations, footprint tiles, use tiles, queue entries and seats. The v1
// two argument call still works for every entry without a decor field.
function tileOwned(entry, gear, decor) {
  return (!entry.gear || gear[entry.gear] === true)
    && (!entry.decor || (decor !== undefined && decor !== null && decor[entry.decor] === true));
}

// ---------------------------------------------------------------------------------------------
// 2.4 Catalog (contract 2.4 with D5)
// ---------------------------------------------------------------------------------------------

function row(id, kind, label, price, effect, needs, needsText, sets) {
  return Object.freeze({ id, kind, label, price, effect, needs: needs ? Object.freeze(needs) : null, needsText, sets });
}
function decorRow(id, label, price, seats, charm, effect, needs, needsText, sets) {
  return Object.freeze({ id, kind: 'decor', label, price, effect, needs: needs ? Object.freeze(needs) : null, needsText, sets, seats, charm });
}

const CATALOG = Object.freeze([
  row('sausage', 'meat', 'Sausage', 4, 'Sausage: 2 plates a unit, quickest cook, sells for 5.', null, '', 'cart.meat.sausage, then stock.sausage on open'),
  row('chicken', 'meat', 'Chicken thighs', 6, 'Chicken thighs: 2 plates, 22 seconds on good fire, sells for 8.', null, '', 'cart.meat.chicken'),
  row('ribs', 'meat', 'Pork ribs', 12, 'Pork ribs: 3 plates, 32 seconds, sells for 11.', null, '', 'cart.meat.ribs'),
  row('butt', 'meat', 'Pork butt', 20, 'Pork butt: 5 plates of pulled pork, 40 seconds, both grate slots, sells for 14.', null, '', 'cart.meat.butt'),
  row('brisket', 'meat', 'Brisket', 38, 'Brisket: 7 plates, 50 seconds on the drum, sells for 18.', { gear: 'drum' }, 'Needs the drum smoker.', 'cart.meat.brisket'),
  row('charcoal', 'fuel', 'Charcoal', 2, 'One bag lights a cold cooker to 60 or adds 30 to a lit one. A kettle burns about six bags a cook. Bags left over keep.', null, '', 'cart.charcoal, then charcoal on open'),
  row('kettle2', 'gear', 'Second kettle', 90, 'Two more grate slots. Twice the meat on the fire.', null, '', 'gear.kettle2, stations.kettle2 becomes active'),
  row('cooler', 'gear', 'Cooler', 60, 'Keeps ' + C.COOLER_CAP[1] + ' units of raw meat overnight. Without it, meat left after a cook spoils.', null, '', 'gear.cooler'),
  row('bigtable', 'gear', 'Bigger table', 70, 'Five people can wait instead of three, and five plate spots instead of three.', null, '', 'gear.bigtable, table.spots grows to 5, queue spots 4 and 5 activate'),
  row('tray', 'gear', 'Serving tray', 50, 'Carry two plates at a time.', null, '', 'gear.tray'),
  row('canopy', 'gear', 'Canopy', 80, 'Rain days run at full crowd.', null, '', 'gear.canopy'),
  row('drum', 'gear', 'Drum smoker', 280, 'Four grate slots, holds heat longer, and the only cooker that takes brisket.', { gear: 'kettle2' }, 'Needs the second kettle.', 'gear.drum, stations.drum active, brisket and tender rows unlock'),
  decorRow('chair1', 'Lawn chair', 25, 1, 3, 'One more seat by the line. Charm 3.', null, '', 'decor.chair1, seat chair1'),
  decorRow('chair2', 'Second lawn chair', 25, 1, 3, 'One more seat by the line. Charm 3.', { decor: 'chair1' }, 'Needs the first lawn chair.', 'decor.chair2, seat chair2'),
  decorRow('flowers', 'Flower bed', 30, 0, 4, 'Flowers along the fence by the gate. Charm 4.', null, '', 'decor.flowers'),
  decorRow('birdbath', 'Bird bath', 40, 0, 4, 'Birds stop by between the tables. Charm 4.', null, '', 'decor.birdbath'),
  decorRow('lights', 'String lights', 60, 0, 10, 'Lights strung over the serving table. Charm 10.', null, '', 'decor.lights'),
  decorRow('picnic2', 'Second picnic table', 80, 2, 6, 'Two more seats on the lawn. Charm 6.', null, '', 'decor.picnic2, seats pt2b and pt2a'),
  row('buddy', 'hire', 'Buddy', 20, 'Runs plates from the board to the table so you can stay on the fire. Paid each evening.', { day: 2 }, 'From day 2.', 'hires.buddy'),
  row('tender', 'hire', 'Fire tender', 30, "Keeps every cooker above 55 as long as there are bags in the pile. Buy about seven bags a cooker when he's on.", { gear: 'drum' }, 'Needs the drum smoker.', 'hires.tender'),
  row('driveway', 'goal', 'Driveway pop-up', C.DRIVEWAY_PRICE, 'The next rung. Not built yet.', { gear: 'drum', rep: C.DRIVEWAY_REP }, 'Needs the drum smoker and word of mouth ' + C.DRIVEWAY_REP + '.', 'nothing; goal line and Coming next card only')
]);

const CATALOG_BY_ID = Object.freeze(CATALOG.reduce((acc, r) => { acc[r.id] = r; return acc; }, {}));

// ---------------------------------------------------------------------------------------------
// 2.10 Strings (with decorLabel, D5)
// ---------------------------------------------------------------------------------------------

const STRINGS = Object.freeze({
  cooker: Object.freeze({ kettle1: 'kettle 1', kettle2: 'kettle 2', drum: 'the drum' }),
  cookerLabel: Object.freeze({ kettle1: 'Kettle 1', kettle2: 'Kettle 2', drum: 'Drum smoker' }),
  hire: Object.freeze({ buddy: 'the buddy', tender: 'the fire tender' }),
  hireLabel: Object.freeze({ buddy: 'Buddy', tender: 'Fire tender' }),
  gearLabel: Object.freeze({ kettle2: 'Second kettle', cooler: 'Cooler', bigtable: 'Bigger table', tray: 'Serving tray', canopy: 'Canopy', drum: 'Drum smoker', driveway: 'Driveway pop-up' }),
  decorLabel: Object.freeze({ chair1: 'Lawn chair', chair2: 'Second lawn chair', flowers: 'Flower bed', birdbath: 'Bird bath', lights: 'String lights', picnic2: 'Second picnic table' }),
  walk: 'Walk', handsFull: 'Hands full', nothing: 'Nothing to do here', slicing: 'Slicing',
  cantGetThere: "Can't get there", handsEmpty: 'Hands empty',
  gateOpensIn: 'Gate opens in ', lastCall: 'Last call',
  // v2.1 ([T 2.2], [T 3.3], contract K8)
  tutorial: Object.freeze({
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
    end: 'You have the hang of it. Keep the fire fed and keep them happy.',
    // v3.0 off the happy path (contract W12.1, W15)
    full: 'The grate is full. Put it back in the cooler.',
    fullGrate: 'Kettle 1 is full. Put this piece on the other cooker.'
  }),
  tutorialOrder: Object.freeze(['open', 'charcoal', 'light', 'meat', 'puton', 'cook', 'slice', 'plate', 'customer', 'seated', 'end']),
  pullNow: 'Pull it now',
  burnWarn: Object.freeze({
    sausage: 'The sausage is about to burn.',
    chicken: 'The chicken is about to burn.',
    ribs: 'The ribs are about to burn.',
    butt: 'The pork butt is about to burn.',
    brisket: 'The brisket is about to burn.'
  }),
  // v3.0 (contract W15, exact text)
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
  // v3.1 (contract X10, exact text)
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
    run: Object.freeze(['Walks plates over faster.', 'Hands plates over quicker. Guests tip more on the plates they carry.']),
    fire: Object.freeze(['Keeps the fire hotter.', 'Checks the fires more often.']),
    prep: Object.freeze(['Slices faster than you do.', 'Walks to the board faster.'])
  }),
  mood: Object.freeze(['Done', 'Grumpy', 'OK', 'Happy', 'Fired up']),      // index mood + 2
  crewSay: Object.freeze({
    run: '{name} ran {n} plates. Guests tipped {t}.',             // review 1: the tips on the plates they carried
    runOne: '{name} ran 1 plate. Guests tipped {t}.',
    fire: '{name} added {n} bags. The fire was hot enough to cook {p} percent of the time.',
    fireOne: '{name} added 1 bag. The fire was hot enough to cook {p} percent of the time.',
    fireHot: '{name} added {n} bags and kept the fire hot for {s} seconds. Food came off faster.',   // review 1
    fireHotOne: '{name} added 1 bag and kept the fire hot for {s} seconds. Food came off faster.',
    prep: '{name} sliced {n} cuts and saved you {s} seconds.',
    prepOne: '{name} sliced 1 cut and saved you {s} seconds.',
    idle: '{name} had nothing to do this time.',
    settled: '{name} worked the event.',
    rested: '{name} rested.'
  }),
  hostThird: Object.freeze(['', 'Folks at the last event asked who cooked, {name}.', 'People ask for you by name now, {name}.']),
  // v3.2 days of the week (contract D8.1, exact text)
  dayName: Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  dayShort: Object.freeze(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']),
  dayKind: Object.freeze({ yard: 'Yard day', prep: 'Prep', market: 'Market run', train: 'Train', off: 'Day off', loadin: 'Load-in', event: 'Booked event' }),
  dayHint: Object.freeze({
    yard: 'Open the yard for a short cook. Walk-ins pay.',
    prep: 'Trim and rub the weekend meat. Quality starts higher.',
    market: "Buy what is in the cart at today's price.",
    train: 'One crew card trains this week.',
    off: 'Crew mood goes up. Nothing earned.',
    loadin: 'Prep the booking and put the big meat on overnight.',
    event: 'Today is the booking. Load up and go.'
  }),
  // v3.2 playtest: the one line hints a tall hub shows in place of dayHint (game.js fitWeek step 8).
  dayHintShort: Object.freeze({
    yard: 'Half day, walk-ins pay',
    prep: 'Quality up at booking',
    market: 'Buy the cart today',
    train: 'One card gains XP',
    off: 'Mood up, no pay',
    loadin: 'Prep plus overnight',
    event: 'Today is the booking'
  }),
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
    // v3.1 (contract X10, exact text)
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
    left: '{name} moved on.',
    // v3.2 (contract D8.1)
    dayDone: Object.freeze({ prep: 'Prep done.', market: 'Market run done.', train: 'Training done.', off: 'A day off.', loadin: 'Loaded in.' }),
    dayStart: 'It is {day}.',
    overnight: '{meat} on overnight.'
  }),
  ui: Object.freeze({
    // header and HUD
    hudWeek: 'Week {w}',
    weekOf: 'Week {w} of 9',
    weekOfYear: 'Season {y}, week {w} of 9',     // R-6: the hub heading from season 2
    seasonWhen: 'Season {y}, {when}',            // R-6: #week-when from season 2
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
    finaleDrum: 'With the drum smoker: {n} guests, pay {fee}.',      // R-3
    mixHint: 'Tip: cook one {big} at a time and keep {small} on the other grate, so plates are ready at the gate.',   // R-7
    mixShort: 'One {big} at a time.',            // Q-6: the pre-gate status line after the countdown
    // next event and Load up and go
    nextEvent: 'Next event',
    depositLine: 'The host pays {d} when you load up. The rest comes after the cook.',
    yardLine: 'Guests pay for each plate.',
    loadUp: 'Load up and go',
    goPick: 'Pick a booking first.',
    goCash: 'Not enough cash for this cart. Take something out.',
    // v3.2 days of the week (contract D8.1)
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
    // v3.2 playtest fixes (V32-8 to V32-11)
    cardTrain: '{name} trained. Plus {xp} XP.',
    cardMoodTop: 'The crew was already {mood} or better. Nothing changed.',
    cardLoadinSame: 'Already prepped, so Load-in only locked the booking.',
    marketSpoil: 'No cooler room tonight: {n} meat from this buy spoils.',
    yardSpoil: 'No cooler room tonight: raw meat left after the cook spoils.',
    loadinSame: 'Already prepped and nothing goes on overnight. This only locks the booking.',
    eventDone: 'Event done',
    bookPlayed: 'Played on {day}. New offers come Monday.',
    // the 2 by 2 grid
    crew: 'Crew',
    crewLine: '{n} of {s} on the crew',          // X10 (was '{n} of 2 hired')
    crewSub: 'Payroll {p} / {b}',                // X10 (was 'Buddy and fire tender')
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
    finaleNews: 'The finale is week 9. With the drum smoker it is a {n} guest cook.',   // R-3
    finaleTable: 'The finale is {n} guests. A bigger table lets five wait in line.',   // Q-6
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
    coolerNone: 'No cooler. This cook can use about {e} more units of meat.',   // R-8: coolerRoom with no cooler
    covers: 'Covers {p} of {r} plates',          // Q-10: on each rail meat's shop row
    otherMeats: 'Other meats',                   // Q-10: the shop's off-menu rows at a booking, folded
    offMenu: 'Not on this menu. Add one in Menu.',
    noSpare: 'No spare. One burnt piece leaves guests without a plate.',
    practice: 'A practice day before your first season.',
    coolerFull: 'No more room. The cooler holds {cap} overnight.',
    coolerFullNone: 'No more room. There is no cooler to keep the rest.',   // R-8: coolerFull with no cooler
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
    reportHLow: '{label}: over',                  // R-9: the hero at 1 or 2 stars
    score: 'Score',
    of5: '{n} of 5',
    partFed: 'Fed',
    partWait: 'Wait',
    partQuality: 'Quality',
    partOf: '{p} of {max}',
    result: 'Guests fed {f} of {b}. {w} walked out. Average wait {s} s.',
    missedLine: '{n} gave up at the gate. The line stayed full to the end.',   // Q-1
    missedTable: 'A bigger table lets five wait.',                              // Q-6: after missedLine without the bigger table
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
    rowGear: 'Gear bought',                       // R-4: the rows between Take today and Cash
    rowKept: 'Bought for later',                  // Q-11: stock the cart added to the pile and cooler
    rowDrawn: 'Bought earlier',                   // Q-11: stock an earlier cart paid for, used today (review 1: shortened)
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
    // v3.1 (contract X10, exact text)
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
    // review round 1 (contract X20)
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
  })
});

// Hands full while carrying plates: name where they go instead (round 2 finding). Q-4: a cooked or a
// burnt piece names its place too.
const PLATES_GO = 'Plates go on the table';
const COOKED_GO = 'Slice it at the board';
const BURNT_GO = "That's burnt. Trash it";
function fullLabel(c) {
  if (c === null) return STRINGS.handsFull;
  if (c.kind === 'plates') return PLATES_GO;
  if (c.kind === 'cooked') return COOKED_GO;
  if (c.kind === 'burnt') return BURNT_GO;
  return STRINGS.handsFull;
}

// ---------------------------------------------------------------------------------------------
// 2.7.3 Fire helpers (pure)
// ---------------------------------------------------------------------------------------------

function fireBand(fire) {
  if (fire < C.COLD_UNDER) return 'out';
  if (fire < C.FIRE_GOOD) return 'low';
  if (fire < C.FIRE_HOT) return 'good';
  return 'hot';
}

function fireMult(fire) {
  const band = fireBand(fire);
  if (band === 'out') return 0;
  if (band === 'low') return fire / C.FIRE_GOOD;
  if (band === 'good') return 1.0;
  return C.HOT_MULT;
}

// [T 3.2]: the rate a done piece advances toward burnt. Hot no longer burns faster.
function burnMult(fire) {
  return fireBand(fire) === 'hot' ? C.HOT_BURN_MULT : fireMult(fire);
}

// ---------------------------------------------------------------------------------------------
// W3.1 Bookings, W4.3 looks (pure data)
// ---------------------------------------------------------------------------------------------

const BOOKING_IDS = Object.freeze(['birthday', 'picnic', 'finale', 'yard']);

function bookingRow(id, guests, menu, patience, win, flames, icon, menus) {
  return Object.freeze({
    id, label: STRINGS.booking[id], guests,
    menu: menu === null ? null : Object.freeze(menu.slice()),
    menus: menus === null ? null : Object.freeze(menus.map((pair) => Object.freeze(pair.slice()))),
    patience, window: win, flames, venue: 'backyard', icon, unlock: null
  });
}

// Row shape { id, label, guests, menu, menus, patience, window, flames, venue, icon, unlock }. The
// finale menu is null: every meat the owned gear can cook (W3.2). Every row plays in the backyard.
// X3.1: menus are the pairs a type rotates through week to week (MEAT_IDS order); menu is menus[0].
const BOOKINGS = Object.freeze({
  birthday: bookingRow('birthday', 12, ['sausage', 'chicken'], 45, 60, 1, 'ev_birthday',   // Q-5: 60 s window (was 80)
    [['sausage', 'chicken'], ['sausage', 'ribs'], ['chicken', 'ribs']]),
  picnic: bookingRow('picnic', 20, ['chicken', 'butt'], 50, 80, 2, 'ev_picnic',
    [['chicken', 'butt'], ['sausage', 'butt'], ['ribs', 'butt'], ['chicken', 'ribs']]),
  finale: bookingRow('finale', 40, null, 50, 105, 3, 'ev_finale', null),   // Q-2: 105 s window, any length
  yard: bookingRow('yard', 0, [], C.PATIENCE_BASE, 80, 1, 'ev_yard', [])
});

// The rows genOffers draws from when no types list is passed (weeks 1 to 8).
const DEFAULT_TYPES = Object.freeze([BOOKINGS.birthday, BOOKINGS.picnic]);

const LOOK_KEYS = Object.freeze(['skin', 'hair', 'hairColor', 'face', 'hat', 'apron']);
const LOOK_COUNTS = Object.freeze({ skin: 6, hair: 6, hairColor: 6, face: 4, hat: 4, apron: 6 });
const DEFAULT_LOOK = Object.freeze({ skin: 1, hair: 0, hairColor: 1, face: 0, hat: 1, apron: 0 });

// Units kept overnight go costliest first (W10.4): brisket, butt, ribs, chicken, sausage.
const KEEP_ORDER = Object.freeze(MEAT_IDS.slice().sort((a, b) => MEATS[b].unit - MEATS[a].unit || MEAT_IDS.indexOf(a) - MEAT_IDS.indexOf(b)));

// ---------------------------------------------------------------------------------------------
// W4.4 Names and W4.3 look validation (pure, never throw)
// ---------------------------------------------------------------------------------------------

function nameString(str) {
  if (str === undefined || str === null) return '';   // deviation 32
  try { return String(str); } catch (e) { return ''; }
}

// Allowed: ASCII letters and digits and C.NAME_PUNCT. Curly apostrophes become straight ones,
// runs of spaces collapse to one, the result is cut to max (default C.NAME_MAX; pit names use
// C.PIT_NAME_MAX). No trim (game.js runs it on
// every input event so a typed trailing space survives).
function filterName(str, max) {
  const lim = max > 0 ? max : C.NAME_MAX;
  const s = nameString(str);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    let ch = s[i];
    if (ch === '\u2018' || ch === '\u2019') ch = "'";
    const code = ch.charCodeAt(0);
    const ok = (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
      || C.NAME_PUNCT.indexOf(ch) >= 0;
    if (!ok) continue;
    if (ch === ' ' && out.length > 0 && out[out.length - 1] === ' ') continue;
    out += ch;
  }
  return out.slice(0, lim);
}

function cleanName(str, fallback, max) {
  try {
    const lim = max > 0 ? max : C.NAME_MAX;
    const s = filterName(str, lim).trim().slice(0, lim).trim();
    if (s !== '') return s;
    return nameString(fallback);
  } catch (e) {
    return '';
  }
}

// A valid look: every key an integer index in range; anything else takes the default's value.
function cleanLook(look) {
  const out = {};
  for (const k of LOOK_KEYS) {
    const v = readKey(look, k);
    out[k] = (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LOOK_COUNTS[k]) ? v : DEFAULT_LOOK[k];
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// X5.1, X6.1 and X6.3 Crew cards (pure, never throw)
// ---------------------------------------------------------------------------------------------

// A star value: a finite number clamped 1 to 5; anything else reads as 1 star (X5.1).
function starNum(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? clamp(v, 1, 5) : 1;
}

function roleOf(role) {
  return (typeof role === 'string' && ROLE_IDS.includes(role)) ? role : 'run';
}

// X5.1: overall stars, the average of the two skills rounded down to the half.
function cardStars(skills) {
  let a = 1, b = 1;
  try {
    if (Array.isArray(skills)) { a = starNum(skills[0]); b = starNum(skills[1]); }
  } catch (e) { a = 1; b = 1; }
  return Math.floor(((a + b) / 2) * 2) / 2;
}

// X5.1: the table wage for overall stars and a role.
function wageFor(stars, role) {
  const s = starNum(stars);
  const i = clamp(Math.round((s - 1) * 2), 0, C.WAGE_TABLE.length - 1);
  return Math.round(C.WAGE_TABLE[i] * C.ROLE_WAGE[roleOf(role)]);
}

// X5.1: a SKILL_CURVE value at a star level, piecewise linear through the 1, 3 and 5 star columns.
function skillValue(key, stars) {
  const v = (typeof key === 'string' && Object.prototype.hasOwnProperty.call(C.SKILL_CURVE, key)) ? C.SKILL_CURVE[key] : null;
  if (v === null) return NaN;
  const s = starNum(stars);
  return s <= 3 ? v[0] + (v[1] - v[0]) * (s - 1) / 2 : v[1] + (v[2] - v[1]) * (s - 3) / 2;
}

// X5.2: skills plus the mood's half stars, clamped 1 to 5.
function effectiveSkills(card) {
  const add = C.MOOD_STARS[clamp(Math.trunc(Number(card.mood)) || 0, -2, 2) + 2];
  return [clamp(card.skills[0] + add, 1, 5), clamp(card.skills[1] + add, 1, 5)];
}

// The curve values a role's two skills drive at the effective stars (ROLE_SKILLS order).
function curveValues(role, eff) {
  const out = {};
  const keys = C.ROLE_SKILLS[roleOf(role)];
  for (let i = 0; i < 2; i++) for (const k of keys[i]) out[k] = skillValue(k, eff[i]);
  return out;
}

function seedOf(inp) {
  let n;
  try { n = Number(readKey(inp, 'seed')); } catch (e) { n = 0; }
  return Number.isFinite(n) ? (n >>> 0) : 0;
}

function nameSet(list) {
  const out = new Set();
  if (!Array.isArray(list)) return out;
  const n = Math.min(list.length >>> 0, 1000);
  for (let i = 0; i < n; i++) {
    let v;
    try { v = list[i]; } catch (e) { continue; }
    if (typeof v === 'string') out.add(v);
  }
  return out;
}

// X6.1: i = floor(r() * 60), stepping forward one at a time (wrapping) past the used names.
function drawName(r, used) {
  const names = STRINGS.names;
  let i = Math.floor(r() * names.length);
  for (let k = 0; k < names.length && used.has(names[i]); k++) i = (i + 1) % names.length;
  used.add(names[i]);
  return names[i];
}

// Review 1: a crew look, six draws in LOOK_KEYS order. The hat draw lands on no hat for 1 - HAT_SHARE
// of its range and splits the rest evenly over the three hats; long hair never goes under a cap (the
// strands read as a hood), so that pair drops the cap. Pool, walk-ins and migrated cards share it.
const LOOK_HAIR_LONG = 2, LOOK_HAT_CAP = 1;
function drawLook(r) {
  const o = {};
  for (const k of LOOK_KEYS) {
    const u = r();
    if (k === 'hat') {
      const hats = LOOK_COUNTS.hat - 1;
      const edge = 1 - C.HAT_SHARE;
      o.hat = u < edge ? 0 : 1 + Math.min(hats - 1, Math.floor((u - edge) / C.HAT_SHARE * hats));
    } else o[k] = Math.floor(u * LOOK_COUNTS[k]);
  }
  if (o.hair === LOOK_HAIR_LONG && o.hat === LOOK_HAT_CAP) o.hat = 0;
  return o;
}

function fanThirdOf(rep) {
  return rep >= C.THIRD_EDGES[1] ? 2 : (rep >= C.THIRD_EDGES[0] ? 1 : 0);
}

// X6.1: the Hiring Day pool, 18 applicants (six of each role), 1 to 3 stars, potential 2 to 5.
// Review 1: the first card of each role (in pool order) is a headliner, each skill drawn as
// HEADLINER[0] + floor(r() * HEADLINER[1]) / 2 (2.5 to 3 stars), so every pool holds one 2.5 or 3 star
// card a role, the cards other outfits go after first. Same draws, same order.
function genPool(input) {
  const inp = isPlainObject(input) ? input : {};
  const seed = seedOf(inp);
  const year = toInt(readKey(inp, 'year'), 1, 1, C.YEAR_MAX);
  const used = nameSet(readKey(inp, 'avoid'));
  const rp = mulberry32(mix32((seed ^ 0x504F4F4C) >>> 0, year, 0));
  const roles = [];
  const each = Math.floor(C.POOL_SIZE / ROLE_IDS.length);
  for (const role of ROLE_IDS) for (let i = 0; i < each; i++) roles.push(role);
  for (let i = roles.length - 1; i >= 1; i--) {
    const j = Math.floor(rp() * (i + 1));
    const tmp = roles[i]; roles[i] = roles[j]; roles[j] = tmp;
  }
  const out = [];
  const headed = new Set();
  for (let idx = 0; idx < roles.length; idx++) {
    const role = roles[idx];
    const name = drawName(rp, used);
    const head = !headed.has(role);
    headed.add(role);
    const s0 = head ? C.HEADLINER[0] + Math.floor(rp() * C.HEADLINER[1]) / 2 : 1 + Math.floor(rp() * 5) / 2;
    const s1 = head ? C.HEADLINER[0] + Math.floor(rp() * C.HEADLINER[1]) / 2 : 1 + Math.floor(rp() * 5) / 2;
    const potential = Math.min(5, Math.max(Math.max(s0, s1) + 0.5, 2 + Math.floor(rp() * 7) / 2));
    const mood = rp() < 0.5 ? 0 : 1;
    const look = drawLook(rp);
    const stars = cardStars([s0, s1]);
    out.push({ name, role, skills: [s0, s1], potential, mood, look, stars, wage: wageFor(stars, role), idx });
  }
  return out;
}

// X6.3: this week's walk-ins, 2, 2 or 3 by the fan rating third; trained cards of 2 to 4 stars.
// Review 1: none in week 1 (Hiring Day was this morning), and a walk-in comes at its ceiling
// (potential = its best skill; the potential draw still happens so the stream keeps its order).
function genWalkins(input) {
  const inp = isPlainObject(input) ? input : {};
  const seed = seedOf(inp);
  const year = toInt(readKey(inp, 'year'), 1, 1, C.YEAR_MAX);
  const week = toInt(readKey(inp, 'week'), 1, 1, C.SEASON_WEEKS);
  const rep = finiteOr0(readKey(inp, 'rep'));
  const used = nameSet(readKey(inp, 'avoid'));
  const rw = mulberry32(mix32((seed ^ 0x57414C4B) >>> 0, year, week));
  const n = week === 1 ? 0 : C.WALKINS[fanThirdOf(rep)];
  const out = [];
  for (let i = 0; i < n; i++) {
    const role = ROLE_IDS[Math.floor(rw() * ROLE_IDS.length)];
    const name = drawName(rw, used);
    const s0 = 2 + Math.floor(rw() * 5) / 2;
    const s1 = 2 + Math.floor(rw() * 5) / 2;
    rw();   // the v3.1 potential draw, kept so the mood and look draws stay in place
    const potential = Math.max(s0, s1);
    const mood = rw() < 0.5 ? 0 : 1;
    const look = drawLook(rw);
    const stars = cardStars([s0, s1]);
    out.push({ name, role, skills: [s0, s1], potential, mood, look, stars, wage: wageFor(stars, role) });
  }
  return out;
}

// Plain replacement of every {token} (W15).
function fillText(tpl, map) {
  let s = String(tpl);
  for (const k of Object.keys(map)) s = s.split('{' + k + '}').join(String(map[k]));
  return s;
}

// ---------------------------------------------------------------------------------------------
// W3.2 to W3.4 The offer generator (pure, deterministic)
// ---------------------------------------------------------------------------------------------

function mix32(a, b, c) {
  let h = (a >>> 0) ^ Math.imul(b | 0, 0x9E3779B1) ^ Math.imul(c | 0, 0x85EBCA77);
  h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D); h ^= h >>> 15; h = Math.imul(h, 0x846CA68B); h ^= h >>> 16;
  return h >>> 0;
}

function lengthRow(len) {
  return C.LENGTH_ORDER.includes(len) ? C.LENGTHS[len] : C.LENGTHS.normal;
}

function hasGear(gear, id) {
  return readKey(gear, id) === true;
}

function unlockMet(rowDef, rep, gear) {
  const u = readKey(rowDef, 'unlock');
  if (!isPlainObject(u)) return true;
  if (u.rep !== undefined && !(rep >= u.rep)) return false;
  if (u.gear !== undefined && !hasGear(gear, u.gear)) return false;
  return true;
}

// The finale menu: every meat the owned gear can cook, in MEAT_IDS order (brisket needs the drum).
function finaleMenu(gear) {
  return MEAT_IDS.filter((m) => !MEATS[m].drumOnly || hasGear(gear, 'drum'));
}

function menuOf(rowDef, gear) {
  if (rowDef.id === 'yard') return [];
  const menu = rowDef.menu === null || rowDef.menu === undefined ? finaleMenu(gear) : rowDef.menu;
  return MEAT_IDS.filter((m) => menu.includes(m));
}

// The Needs line for a menu the owned gear cannot cook, '' when it can.
function needsFor(menu, gear) {
  for (const m of menu) {
    const r = CATALOG_BY_ID[m];
    if (r.needs && r.needs.gear && !hasGear(gear, r.needs.gear)) return r.needsText;
  }
  return '';
}

// W3.2 rail split: the add-on takes ADDON_SHARE of the headcount, the rest splits evenly over
// the menu with the first (rest % n) meats in menu order getting one more.
function railSplit(headcount, menu, addon) {
  const rail = zeroByMeat();
  let rest = headcount;
  if (addon !== null) {
    const a = Math.round(C.ADDON_SHARE * headcount);
    rail[addon] += a;
    rest -= a;
  }
  const n = menu.length;
  if (n > 0 && rest > 0) {
    const base = Math.floor(rest / n);
    const extra = rest % n;
    for (let i = 0; i < n; i++) rail[menu[i]] += base + (i < extra ? 1 : 0);
  }
  return rail;
}

// P-1: slot seconds a rail needs, ceil(plates / plates a unit) * slots * cook per rail meat.
function slotSeconds(rail) {
  let need = 0;
  for (const m of MEAT_IDS) if (rail[m] > 0) need += Math.ceil(rail[m] / MEATS[m].plates) * MEATS[m].slots * MEATS[m].cook;
  return need;
}

// P-1: the grate seconds the cookers give before last call, at SAFE_LOAD.
function grateSeconds(k2, drum, win) {
  return (C.KETTLE_SLOTS * (k2 ? 2 : 1) + (drum ? C.DRUM_SLOTS : 0)) * (C.GATE_OPENS + win) * C.SAFE_LOAD;
}

// P-1: the Needs line when the rail needs more grate time than the owned cookers give before last
// call, '' when it fits. Names the cooker that makes it fit. The finale (sized to the grate, R-3)
// and the Yard day are exempt.
function capacityNeeds(rowDef, rail, gear, win) {
  if (rowDef.id === 'yard' || rowDef.id === 'finale') return '';
  const need = slotSeconds(rail);
  const fits = (k2, drum) => need <= grateSeconds(k2, drum, win) + 1e-9;
  const k2 = hasGear(gear, 'kettle2'), dr = hasGear(gear, 'drum');
  if (fits(k2, dr)) return '';
  if (!k2 && fits(true, dr)) return STRINGS.ui.needsKettle2;
  if (!dr && fits(true, true)) return STRINGS.ui.needsDrum;
  return '';
}

// R-3: the Season finale books the most guests, up to its row's headcount at the length, whose rail
// fits the owned grate at SAFE_LOAD; never fewer than one guest a meat.
function finaleHeadcount(rowDef, menu, gear, L, win) {
  const top = Math.round(rowDef.guests * L.factor);
  const least = Math.min(top, menu.length);
  const cap = grateSeconds(hasGear(gear, 'kettle2'), hasGear(gear, 'drum'), win) + 1e-9;
  for (let h = top; h > least; h--) if (slotSeconds(railSplit(h, menu, null)) <= cap) return h;
  return least;
}

// X3.3: every booking fee, finale included. k is THIRD_PAY[third], times STRETCH_PAY on the stretch.
function feeFor(headcount, menu, k) {
  if (menu.length === 0) return 0;
  let sum = 0;
  for (const m of menu) sum += MEATS[m].price;
  const avg = sum / menu.length;
  return Math.round(headcount * avg * C.FEE_MULT * k / C.FEE_ROUND) * C.FEE_ROUND;
}

// Fee, deposit and the rest of an offer at a length, without the host. Q-2: the Season finale
// ignores the length (its own window, Normal's headcount factor). X3.4 step 3: `menuIn` is the week's
// menu pair (undefined reads the row's own menu) and `k` the third's fee factor.
function offerFields(rowDef, gear, len, menuIn, k) {
  const L = rowDef.id === 'finale' ? C.LENGTHS.normal : lengthRow(len);
  const isYard = rowDef.id === 'yard';
  const menu = menuOf(menuIn === undefined ? rowDef : { id: rowDef.id, menu: menuIn }, gear);
  const win = rowDef.window * L.window / C.BASE_WINDOW;
  const headcount = isYard ? 0 : (rowDef.id === 'finale' ? finaleHeadcount(rowDef, menu, gear, L, win) : Math.round(rowDef.guests * L.factor));
  const rail = railSplit(headcount, menu, null);
  const pay = isYard ? 0 : feeFor(headcount, menu, typeof k === 'number' && Number.isFinite(k) ? k : 1);
  const deposit = isYard ? 0 : Math.round(pay * C.DEPOSIT_FRAC);
  const needs = isYard ? '' : (needsFor(menu, gear) || capacityNeeds(rowDef, rail, gear, win));
  return {
    id: rowDef.id, type: rowDef.id, label: rowDef.label, venue: rowDef.venue, host: null,
    headcount, menu, rail, pay, deposit,
    difficulty: rowDef.flames, window: win,
    patience: rowDef.patience, safe: needs === '', needs, icon: rowDef.icon,
    // X3.2
    tier: 'safe', invite: false, base: headcount, menuIdx: 0
  };
}

// X3.4 steps 5 and 6: a card at a new headcount; rail, pay and deposit follow (safe and needs do not).
function resizeOffer(o, h, k) {
  o.headcount = h;
  o.rail = railSplit(h, o.menu, null);
  o.pay = feeFor(h, o.menu, k);
  o.deposit = Math.round(o.pay * C.DEPOSIT_FRAC);
}

function freezeOffer(o, host) {
  o.host = host;
  o.day = C.BOOK_DAY[o.type] === undefined ? null : C.BOOK_DAY[o.type];   // D3.3
  o.menu = Object.freeze(o.menu);
  o.rail = Object.freeze(o.rail);
  return Object.freeze(o);
}

// X3.1 and X18.1 item 27: the menu pairs a row rotates through; a row without menus (or with an
// empty list) reads [row.menu].
function rowMenus(t) {
  const m = readKey(t, 'menus');
  if (Array.isArray(m) && m.length > 0) return m;
  return [readKey(t, 'menu')];
}

// W3.4 as amended by X3.4. input = { seed, year, week, rep, cash, gear, length, types? }. Returns
// Offer[] in display order. Three generators: r (the shuffle and the hosts, W3.4), ry (the menu
// rotation, one per season) and rv (the stretch draw and the safe sizes, one per week).
function genOffers(input) {
  const inp = isPlainObject(input) ? input : {};
  let seedN;
  try { seedN = Number(readKey(inp, 'seed')); } catch (e) { seedN = 0; }
  const seed = Number.isFinite(seedN) ? (seedN >>> 0) : 0;
  const year = toInt(readKey(inp, 'year'), 1, 1, C.YEAR_MAX);
  const week = toInt(readKey(inp, 'week'), 1, 1, C.SEASON_WEEKS);
  const rep = finiteOr0(readKey(inp, 'rep'));
  const cash = finiteOr0(readKey(inp, 'cash'));
  const gearIn = readKey(inp, 'gear');
  const gear = isPlainObject(gearIn) ? gearIn : {};
  const len = C.LENGTH_ORDER.includes(readKey(inp, 'length')) ? readKey(inp, 'length') : 'normal';
  const r = mulberry32(mix32(seed, year, week));
  const ry = mulberry32(mix32(seed ^ 0x4D454E55, year, 0));
  const rv = mulberry32(mix32(seed ^ 0x56415249, year, week));
  const names = STRINGS.names;
  const used = nameSet(readKey(inp, 'avoid'));   // review 1: hosts never share a crew or pitmaster name
  function drawHost() {
    let i = Math.floor(r() * names.length);
    for (let k = 0; k < names.length && used.has(names[i]); k++) i = (i + 1) % names.length;
    used.add(names[i]);
    return names[i];
  }

  // 2. The fan rating third (read first: the finale's fee takes the third's pay too).
  const third = rep >= C.THIRD_EDGES[1] ? 2 : (rep >= C.THIRD_EDGES[0] ? 1 : 0);
  const kThird = C.THIRD_PAY[third];
  const kStretch = C.THIRD_PAY[third] * C.STRETCH_PAY;

  // 1. Week 9: the Season finale alone, one host draw, with the third's pay (X3.3).
  if (week === C.SEASON_WEEKS) return [freezeOffer(offerFields(BOOKINGS.finale, gear, len, undefined, kThird), drawHost())];

  const slots = C.OFFER_SLOTS[third];
  const invite = third === C.INVITE_THIRD;

  // 3. The unlocked types, once each, with their index in the types input for ties. X3.4: one ry()
  // draw for every array index before any filtering (item 27); the week's menu pair rotates, and
  // steps forward past a pair the owned gear cannot cook when the first pair can (item 26).
  const typesIn = readKey(inp, 'types');
  const types = Array.isArray(typesIn) ? typesIn : DEFAULT_TYPES;
  const info = [];
  const seen = new Set();
  for (let i = 0; i < types.length; i++) {
    let t;
    try { t = types[i]; } catch (e) { t = undefined; }
    const menus = isPlainObject(t) ? rowMenus(t) : [null];
    const m0 = Math.floor(ry() * menus.length);
    if (!isPlainObject(t) || typeof t.id !== 'string' || t.id === 'yard' || t.id === 'finale' || seen.has(t.id)) continue;
    if (!unlockMet(t, rep, gear)) continue;
    seen.add(t.id);
    const n = menus.length;
    let mi = (m0 + week - 1) % n;
    let o = offerFields(t, gear, len, menus[mi], kThird);
    if (!o.safe && mi !== 0) {
      const first = offerFields(t, gear, len, menus[0], kThird);
      if (first.safe) {
        for (let k = 1; k < n; k++) {
          const j = (mi + k) % n;
          const oj = j === 0 ? first : offerFields(t, gear, len, menus[j], kThird);
          if (oj.safe) { mi = j; o = oj; break; }
        }
      }
    }
    o.menuIdx = mi;
    info.push({ row: t, idx: i, menus, o });
  }

  // 4. Low cash: the Birthday first. Then Fisher Yates over the rest, from the last index down to 1,
  // one draw a swap; the slots; the "no picked offer is safe" swap (W3.4, unchanged).
  const picked = [];
  const bday = info.find((x) => x.row.id === 'birthday') || null;
  if (cash < C.LOW_CASH_BIRTHDAY && bday !== null) picked.push(bday);
  const rest = info.filter((x) => !picked.includes(x));
  for (let i = rest.length - 1; i >= 1; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp;
  }
  for (const x of rest) {
    if (picked.length >= slots) break;
    picked.push(x);
  }
  if (picked.length > 0 && !picked.some((x) => x.o.safe)) {
    let best = null;
    for (const x of info) {
      if (!x.o.safe) continue;
      if (best === null || x.o.pay < best.o.pay || (x.o.pay === best.o.pay && x.idx < best.idx)) best = x;
    }
    if (best !== null) picked[picked.length - 1] = best;
  }
  // W3.4 step 6, found here and placed by X3.4 step 7: the highest fee safe type not yet picked.
  let typeInvite = null;
  if (invite) {
    for (const x of info) {
      if (!x.o.safe || picked.includes(x)) continue;
      if (typeInvite === null || x.o.pay > typeInvite.o.pay || (x.o.pay === typeInvite.o.pay && x.idx < typeInvite.idx)) typeInvite = x;
    }
  }

  // 5. The stretch. A picked card with a Needs line is the week's gear stretch: the first such keeps
  // its base headcount at the stretch pay, and every other picked card takes a SAFE_SIZES draw in
  // picked order (step 6, X3.4 as built in v3.1).
  // Review 1 (contract X20.3) for a week with no Needs card: one rv() draw u, then one SAFE_SIZES draw
  // for every picked card in picked order. A card can be the stretch when its largest headcount that
  // fits the grate at STRETCH_LOAD (STRETCH_SIZE down to STRETCH_MIN of its base), at the stretch pay,
  // pays more than STRETCH_EDGE times every other picked card at its safe size. u picks one of those
  // in picked order; the rest take their safe sizes. With no such card the week has no stretch and
  // every card takes its safe size. So the STRETCH card always pays the most.
  const toStretch = (x) => {
    x.o.tier = 'stretch';
    x.o.patience = x.row.patience + C.STRETCH_PATIENCE;
    x.o.difficulty = Math.min(3, x.row.flames + 1);
  };
  const gearStretch = picked.find((x) => x.o.needs !== '') || null;
  if (gearStretch !== null) {
    toStretch(gearStretch);
    resizeOffer(gearStretch.o, gearStretch.o.headcount, kStretch);
    // X18.1 item 26: any other picked card with a Needs line reads as a stretch (never SAFE BET over
    // a Needs line), with no stretch pay and no sizing.
    for (const x of picked) if (x !== gearStretch && x.o.needs !== '') x.o.tier = 'stretch';
    // 6. The safe cards: one rv() draw each, in picked order, for every other picked card.
    for (const x of picked) {
      if (x === gearStretch) continue;
      const f = C.SAFE_SIZES[Math.floor(rv() * C.SAFE_SIZES.length)];
      if (x.o.needs !== '') continue;   // item 26: a Needs card keeps its size
      resizeOffer(x.o, Math.max(x.o.menu.length, Math.round(x.o.base * f)), kThird);
    }
  } else if (picked.length > 0) {
    const u = rv();
    const slotsN = C.KETTLE_SLOTS * (hasGear(gear, 'kettle2') ? 2 : 1) + (hasGear(gear, 'drum') ? C.DRUM_SLOTS : 0);
    const safeN = new Map();
    for (const x of picked) {
      const f = C.SAFE_SIZES[Math.floor(rv() * C.SAFE_SIZES.length)];
      safeN.set(x, Math.max(x.o.menu.length, Math.round(x.o.base * f)));
    }
    const fitN = new Map();
    const cands = [];
    for (const x of picked) {
      const cap = slotsN * (C.GATE_OPENS + x.o.window) * C.STRETCH_LOAD + 1e-9;
      let fit = -1;
      for (let h = Math.round(x.o.base * C.STRETCH_SIZE); h >= Math.ceil(x.o.base * C.STRETCH_MIN); h--) {
        if (slotSeconds(railSplit(h, x.o.menu, null)) <= cap) { fit = h; break; }
      }
      if (fit < 0) continue;
      let safeTop = 0;
      for (const y of picked) if (y !== x) safeTop = Math.max(safeTop, feeFor(safeN.get(y), y.o.menu, kThird));
      if (feeFor(fit, x.o.menu, kStretch) > safeTop * C.STRETCH_EDGE) { fitN.set(x, fit); cands.push(x); }
    }
    const held = cands.length > 0 ? cands[Math.floor(u * cands.length)] : null;
    for (const x of picked) {
      if (x === held) { toStretch(x); resizeOffer(x.o, fitN.get(x), kStretch); }
      else resizeOffer(x.o, safeN.get(x), kThird);
    }
  }

  // 7. The invite: the v3.0 type invite when step 6 of W3.4 found one, else a repeat card of the
  // highest pay loadable picked type with its next menu pair that the owned gear can cook (item 29).
  let inviteO = null;
  if (invite) {
    if (typeInvite !== null) {
      typeInvite.o.invite = true;
      inviteO = typeInvite.o;
    } else {
      let best = null;
      for (const x of picked) {
        if (!x.o.safe) continue;
        if (best === null || x.o.pay > best.o.pay || (x.o.pay === best.o.pay && x.idx < best.idx)) best = x;
      }
      if (best !== null) {
        const n = best.menus.length;
        for (let k = 1; k <= n; k++) {
          const j = (best.o.menuIdx + k) % n;
          const oj = offerFields(best.row, gear, len, best.menus[j], kThird);
          if (!oj.safe) continue;
          oj.id = 'invite';
          oj.invite = true;
          oj.menuIdx = j;
          inviteO = oj;
          break;
        }
      }
    }
  }

  // 8. Display order: loadable first; then the safe tier before the stretch; then difficulty, pay
  // and the row index; the invite after every other booking card; then the Yard day. Hosts from r.
  picked.sort((a, b) => (a.o.safe === b.o.safe ? 0 : (a.o.safe ? -1 : 1))
    || (a.o.tier === b.o.tier ? 0 : (a.o.tier === 'safe' ? -1 : 1))
    || a.o.difficulty - b.o.difficulty || a.o.pay - b.o.pay || a.idx - b.idx);
  const out = picked.map((x) => freezeOffer(x.o, drawHost()));
  if (inviteO !== null) out.push(freezeOffer(inviteO, drawHost()));
  out.push(freezeOffer(offerFields(BOOKINGS.yard, gear, len, undefined, kThird), null));
  return out;
}

// ---------------------------------------------------------------------------------------------
// W8.1 Client stars (pure)
// ---------------------------------------------------------------------------------------------

function finiteOr0(v) {
  let n;
  try { n = Number(v); } catch (e) { n = NaN; }
  return Number.isFinite(n) ? n : 0;
}

function starsFor(score) {
  const E = C.STAR_EDGES;
  return score >= E[3] ? 5 : (score >= E[2] ? 4 : (score >= E[1] ? 3 : (score >= E[0] ? 2 : 1)));
}

function scoreEvent(input) {
  const booked = Math.max(0, finiteOr0(readKey(input, 'booked')));
  const fed = Math.max(0, finiteOr0(readKey(input, 'fed')));
  const waitSum = Math.max(0, finiteOr0(readKey(input, 'waitSum')));
  const burnt = Math.max(0, finiteOr0(readKey(input, 'burnt')));
  const offMenu = Math.max(0, finiteOr0(readKey(input, 'offMenu')));
  const cold = Math.max(0, finiteOr0(readKey(input, 'cold')));
  const prepBonus = Math.max(0, finiteOr0(readKey(input, 'prepBonus')));   // D4.4: 0 when absent
  const unfed = Math.max(0, booked - fed);
  const avgWait = booked > 0 ? (waitSum + C.WAIT_ZERO_S * unfed) / booked : C.WAIT_ZERO_S;
  const fedPts = booked > 0 ? C.SCORE_FED * fed / booked : 0;
  const waitPts = C.SCORE_WAIT * clamp((C.WAIT_ZERO_S - avgWait) / (C.WAIT_ZERO_S - C.WAIT_FULL_S), 0, 1);
  // P-2: quality scales with the share fed, and cold booked plates cost COLD_PENALTY each.
  const qualRaw = Math.max(0, Math.min(C.SCORE_QUALITY, C.SCORE_QUALITY + prepBonus - C.BURNT_PENALTY * burnt - C.OFFMENU_PENALTY * offMenu - C.COLD_PENALTY * cold));
  const qualPts = booked > 0 ? qualRaw * Math.min(1, fed / booked) : 0;
  const score = Math.round(fedPts + waitPts + qualPts);
  return {
    score,
    stars: starsFor(score),
    parts: { fed: Math.round(fedPts), wait: Math.round(waitPts), quality: Math.round(qualPts) },
    avgWait: Math.round(avgWait)
  };
}

// ---------------------------------------------------------------------------------------------
// D9, K6, W13.3 and X11 Save validation: accepts v 1 to 5, always returns v 5
// ---------------------------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function readKey(obj, key) {
  try { return isPlainObject(obj) ? obj[key] : undefined; } catch (e) { return undefined; }
}

function toInt(v, def, lo, hi) {
  let n;
  try { n = Number(v); } catch (e) { n = NaN; }
  if (typeof n !== 'number' || !Number.isFinite(n)) n = def;
  n = Math.trunc(n);
  if (n < lo) n = lo;
  if (n > hi) n = hi;
  return n;
}

function toBool(v) {
  return v === true;
}

// W22.15: plain objects with a known type, a finale only as the ninth entry, at most nine.
// D9: seven entries, a DayKind below `day` (a bad entry reads 'off'), null from `day` on.
function readDayLog(arr, day) {
  const out = [];
  for (let i = 0; i < C.WEEK_DAYS; i++) {
    if (i >= day) { out.push(null); continue; }
    let e;
    try { e = Array.isArray(arr) ? arr[i] : undefined; } catch (x) { e = undefined; }
    out.push(typeof e === 'string' && DAY_KINDS.includes(e) ? e : 'off');
  }
  return out;
}

function readResults(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  const n = Math.min(arr.length >>> 0, 10000);
  for (let i = 0; i < n && out.length < C.SEASON_WEEKS; i++) {
    let e;
    try { e = arr[i]; } catch (x) { continue; }
    if (!isPlainObject(e)) continue;
    const type = readKey(e, 'type');
    if (typeof type !== 'string' || !BOOKING_IDS.includes(type)) continue;
    if (type === 'finale' && out.length !== C.SEASON_WEEKS - 1) continue;
    out.push({ type, stars: type === 'yard' ? 0 : toInt(readKey(e, 'stars'), 1, 1, 5) });
  }
  return out;
}

// X11.2: a star value rounded to the half and clamped; a non number takes the default.
function halfStar(v, def, lo, hi) {
  const n = (typeof v === 'number' && Number.isFinite(v)) ? Math.round(v * 2) / 2 : def;
  return clamp(n, lo, hi);
}

function readSkills(v) {
  let a, b;
  if (Array.isArray(v)) { try { a = v[0]; b = v[1]; } catch (e) { a = undefined; b = undefined; } }
  return [halfStar(a, 1, 1, 5), halfStar(b, 1, 1, 5)];
}

// The first list name from names[start % 60], stepping forward, that `used` does not hold.
function firstFreeName(start, used) {
  const names = STRINGS.names;
  const s = ((Math.trunc(start) % names.length) + names.length) % names.length;
  for (let k = 0; k < names.length; k++) {
    const nm = names[(s + k) % names.length];
    if (!used.has(nm)) return nm;
  }
  return names[s];
}

function keepName(v, start, used) {
  const nm = (typeof v === 'string' && STRINGS.names.includes(v) && !used.has(v)) ? v : firstFreeName(start, used);
  used.add(nm);
  return nm;
}

// X11.2: one crew card, clamped field by field (the id is checked by the caller).
function cleanCard(e, id, used) {
  const role = readKey(e, 'role');
  const skills = readSkills(readKey(e, 'skills'));
  const top = Math.max(skills[0], skills[1]);
  const mood = toInt(readKey(e, 'mood'), 0, -2, 2);
  return {
    id,
    name: keepName(readKey(e, 'name'), id, used),
    role,
    skills,
    potential: halfStar(readKey(e, 'potential'), top, top, 5),
    xp: toInt(readKey(e, 'xp'), 0, 0, C.LEVEL_XP - 1),
    banked: toInt(readKey(e, 'banked'), 0, 0, C.BANK_MAX),
    mood,
    wage: toInt(readKey(e, 'wage'), wageFor(cardStars(skills), role), 1, 999),
    contract: toInt(readKey(e, 'contract'), 1, 1, 2),
    seasons: toInt(readKey(e, 'seasons'), 0, 0, 99),
    rookie: toBool(readKey(e, 'rookie')),
    trait: null,
    look: cleanLook(readKey(e, 'look')),
    bring: toBool(readKey(e, 'bring')),
    raised: toBool(readKey(e, 'raised')),
    notice: toBool(readKey(e, 'notice')) && mood === -2,
    worked: toInt(readKey(e, 'worked'), 0, 0, 9999),
    bench: toInt(readKey(e, 'bench'), 0, 0, C.BENCH_STREAK - 1)
  };
}

// X11.2: the first CREW_MAX plain objects with a known role; a bad or repeated id drops the card;
// then at most one bring per role (later ones in array order rest).
function readCrew(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  const n = Math.min(arr.length >>> 0, 10000);
  const cands = [];
  for (let i = 0; i < n && cands.length < C.CREW_MAX; i++) {
    let e;
    try { e = arr[i]; } catch (x) { continue; }
    if (!isPlainObject(e)) continue;
    const role = readKey(e, 'role');
    if (typeof role !== 'string' || !ROLE_IDS.includes(role)) continue;
    cands.push(e);
  }
  const ids = new Set();
  const used = new Set();
  for (const e of cands) {
    const id = readKey(e, 'id');
    if (!(typeof id === 'number' && Number.isInteger(id) && id >= 1 && id <= 9999) || ids.has(id)) continue;
    ids.add(id);
    out.push(cleanCard(e, id, used));
  }
  const brought = new Set();
  for (const c of out) {
    if (!c.bring) continue;
    if (brought.has(c.role)) c.bring = false;
    else brought.add(c.role);
  }
  return out;
}

// X11.2: an applicant (a walk-in or a pool entry) validated like a card's name, role, skills,
// potential and look, plus mood 0 or 1. Names are checked only against the list they sit in
// (X18.1 item 34). null when the entry is not a plain object with a known role.
function cleanApplicant(e, i, used) {
  if (!isPlainObject(e)) return null;
  const role = readKey(e, 'role');
  if (typeof role !== 'string' || !ROLE_IDS.includes(role)) return null;
  const skills = readSkills(readKey(e, 'skills'));
  const top = Math.max(skills[0], skills[1]);
  return {
    name: keepName(readKey(e, 'name'), i, used),
    role,
    skills,
    potential: halfStar(readKey(e, 'potential'), top, top, 5),
    mood: toInt(readKey(e, 'mood'), 0, 0, 1),
    look: cleanLook(readKey(e, 'look'))
  };
}

// X11.2: up to 3 walk-ins with their hired flags; an invalid entry drops the list to [].
function readWalkins(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const used = new Set();
  const n = Math.min(arr.length >>> 0, 3);
  for (let i = 0; i < n; i++) {
    let e;
    try { e = arr[i]; } catch (x) { return []; }
    const a = cleanApplicant(e, i, used);
    if (a === null) return [];
    a.hired = toBool(readKey(e, 'hired'));
    out.push(a);
  }
  return out;
}

// X11.2: Hiring Day mid way: round 1 to 4, tryouts 0 to TRYOUTS and exactly 18 valid pool entries,
// else null.
function readHiring(h, year) {
  if (!isPlainObject(h)) return null;
  const y = readKey(h, 'year'), round = readKey(h, 'round'), tryouts = readKey(h, 'tryouts');
  if (y !== year) return null;
  if (!(typeof round === 'number' && Number.isInteger(round) && round >= 1 && round <= C.HIRE_ROUNDS + 1)) return null;
  if (!(typeof tryouts === 'number' && Number.isInteger(tryouts) && tryouts >= 0 && tryouts <= C.TRYOUTS)) return null;
  const pool = readKey(h, 'pool');
  if (!Array.isArray(pool) || pool.length !== C.POOL_SIZE) return null;
  const used = new Set();
  const out = [];
  for (let i = 0; i < C.POOL_SIZE; i++) {
    let e;
    try { e = pool[i]; } catch (x) { return null; }
    const a = cleanApplicant(e, i, used);
    if (a === null) return null;
    const status = readKey(e, 'status');
    if (status !== 'open' && status !== 'mine' && status !== 'taken') return null;
    a.status = status;
    a.tried = toBool(readKey(e, 'tried'));
    out.push(a);
  }
  return { year: y, round, tryouts, pool: out };
}

// X11.3: v1 to v4 hires become cards, buddy first (a RUN card, 2.5 stars) then the fire tender (a
// FIRE card, 3 stars). Names and looks are drawn from the season seed.
function migrateHires(hires, seed) {
  const rows = [];
  if (hires.buddy) rows.push({ role: 'run', skills: [2.5, 2.5], wage: C.BUDDY_WAGE });
  if (hires.tender) rows.push({ role: 'fire', skills: [3, 3], wage: C.TENDER_WAGE });
  const names = STRINGS.names;
  const used = new Set();
  return rows.map((r, n) => {
    let i = mix32(seed, 0x4E414D45, n) % names.length;
    for (let k = 0; k < names.length && used.has(names[i]); k++) i = (i + 1) % names.length;
    used.add(names[i]);
    const lr = mulberry32(mix32(seed, 0x4C4F4F4B, n));
    return {
      id: n + 1, name: names[i], role: r.role, skills: r.skills.slice(), potential: 4,
      xp: 0, banked: 0, mood: 0, wage: r.wage, contract: 1, seasons: 0, rookie: false, trait: null,
      look: drawLook(lr), bring: true, raised: false, notice: false, worked: 1, bench: 0
    };
  });
}

function validateSave(obj) {
  try {
    if (!isPlainObject(obj)) return null;
    const v = readKey(obj, 'v');
    if (v !== 1 && v !== 2 && v !== 3 && v !== 4 && v !== 5 && v !== 6) return null;
    const day = toInt(readKey(obj, 'day'), 1, 1, C.MAX_DAY);
    const cash = toInt(readKey(obj, 'cash'), C.START_CASH, 0, C.MAX_CASH);
    const rep = toInt(readKey(obj, 'rep'), C.START_REP, 0, 100);
    const stockIn = readKey(obj, 'stock');
    const stock = {};
    for (const m of MEAT_IDS) stock[m] = toInt(readKey(stockIn, m), 0, 0, C.STEPPER_MAX);
    const charcoal = toInt(readKey(obj, 'charcoal'), 0, 0, C.CHARCOAL_MAX);
    const wood = v >= 4 ? toInt(readKey(obj, 'wood'), 0, 0, C.WOOD_MAX) : 0;
    const gearIn = readKey(obj, 'gear');
    const gear = {};
    for (const g of GEAR_IDS) gear[g] = toBool(readKey(gearIn, g));
    if (!gear.kettle2) gear.drum = false;
    // A v1 save had no decor, so it migrates with none.
    const decorIn = v >= 2 ? readKey(obj, 'decor') : undefined;
    const decor = {};
    for (const d of DECOR_IDS) decor[d] = toBool(readKey(decorIn, d));
    if (!decor.chair1) decor.chair2 = false;
    // v1 to v4 hires (the legacy tender check of W13.3 first); X11.3 turns them into cards below.
    const hiresIn = v <= 4 ? readKey(obj, 'hires') : undefined;
    const hires = {};
    for (const h of HIRE_IDS) hires[h] = toBool(readKey(hiresIn, h));
    if (!gear.drum) hires.tender = false;
    if (!gear.drum) stock.brisket = 0;
    const statsIn = readKey(obj, 'stats');
    const stats = {};
    for (const s of STAT_IDS_V1) stats[s] = toInt(readKey(statsIn, s), 0, 0, C.MAX_STAT);
    stats.seated = v >= 2 ? toInt(readKey(statsIn, 'seated'), 0, 0, C.MAX_STAT) : 0;
    const drivewayShown = toBool(readKey(obj, 'drivewayShown'));
    // [T 2.8]: only a version 3 or later day 1 save can still owe the tutorial. v1 and v2 players have played.
    const tutIn = v >= 3 ? readKey(obj, 'tutorial') : undefined;
    const owed = isPlainObject(tutIn) && readKey(tutIn, 'done') === false && day === 1;
    // W13.3: the season. v1 to v3 start season 1 week 1.
    const fallbackSeed = mix32(day, cash, stats.served);
    const season = { year: 1, week: 1, seed: fallbackSeed, pick: null, addon: null, weekCash: cash, results: [] };
    let savedWeek = 0, v6Day = 0, v6Log, holdsWeek = false;
    const seasonIn = v >= 4 ? readKey(obj, 'season') : undefined;
    if (isPlainObject(seasonIn)) {
      season.year = toInt(readKey(seasonIn, 'year'), 1, 1, C.YEAR_MAX);
      let seedN;
      try { seedN = Number(readKey(seasonIn, 'seed')); } catch (e) { seedN = NaN; }
      season.seed = Number.isFinite(seedN) ? (seedN >>> 0) : fallbackSeed;
      season.weekCash = toInt(readKey(seasonIn, 'weekCash'), cash, 0, C.MAX_CASH);
      season.results = readResults(readKey(seasonIn, 'results'));
      let week = toInt(readKey(seasonIn, 'week'), 1, 1, C.SEASON_WEEKS);
      savedWeek = week;
      // D9: a v6 save may already hold this week's result (the booking played, a later day open).
      if (v === 6) {
        v6Day = toInt(readKey(seasonIn, 'day'), 0, 0, C.WEEK_DAYS - 1);
        v6Log = readDayLog(readKey(seasonIn, 'dayLog'), v6Day);
        holdsWeek = v6Log.includes('event') && season.results.length === week;
      }
      if (holdsWeek) { /* week kept with its result */ }
      else if (season.results.length >= C.SEASON_WEEKS) week = C.SEASON_WEEKS;
      else {
        if (season.results.length > week - 1) season.results.length = week - 1;
        week = season.results.length + 1;
      }
      season.week = week;
      const complete = season.results.length >= C.SEASON_WEEKS && !holdsWeek;
      const pickIn = readKey(seasonIn, 'pick');
      const pickOk = week === C.SEASON_WEEKS ? pickIn === 'finale'
        : (pickIn === 'birthday' || pickIn === 'picnic' || pickIn === 'yard' || pickIn === 'invite');   // X11.2: 'invite' in weeks 1 to 8
      season.pick = !complete && pickOk ? pickIn : null;
      const addonIn = readKey(seasonIn, 'addon');
      season.addon = (typeof addonIn === 'string' && MEAT_IDS.includes(addonIn) && (!MEATS[addonIn].drumOnly || gear.drum)) ? addonIn : null;
    }
    // W13.3 and W22.1: the save key player holds the creator data (state.profile).
    const playerIn = v >= 4 ? readKey(obj, 'player') : undefined;
    let player = isPlainObject(playerIn)
      ? { name: cleanName(readKey(playerIn, 'name'), STRINGS.defaultName), look: cleanLook(readKey(playerIn, 'look')) }
      : null;
    const pitName = v >= 4 ? cleanName(readKey(obj, 'pitName'), STRINGS.defaultPit, C.PIT_NAME_MAX) : STRINGS.defaultPit;
    const lenIn = v >= 4 ? readKey(readKey(obj, 'settings'), 'length') : undefined;
    const settings = { length: C.LENGTH_ORDER.includes(lenIn) ? lenIn : 'normal' };
    if (owed) {
      player = null;
      season.results = [];
      season.week = 1;
    }
    // D9: the five v3.2 day keys. A v5 or older save, or a week that did not hold, opens on Monday.
    const sameWeek = v === 6 && !owed && isPlainObject(seasonIn) && season.week === savedWeek
      && (season.results.length === season.week - 1 || holdsWeek);
    season.day = sameWeek ? v6Day : 0;
    season.dayLog = sameWeek ? v6Log : readDayLog(undefined, 0);
    season.prepped = sameWeek && toBool(readKey(seasonIn, 'prepped'));
    season.loadin = sameWeek && season.pick !== null && season.day >= 5 && toBool(readKey(seasonIn, 'loadin'));
    const onIn = sameWeek && season.loadin && season.day === 5 ? readKey(seasonIn, 'overnight') : undefined;
    const onMeat = readKey(onIn, 'meat'), onN = readKey(onIn, 'n');
    season.overnight = (typeof onMeat === 'string' && C.OVERNIGHT_MEATS.includes(onMeat) && (!MEATS[onMeat].drumOnly || gear.drum)
      && typeof onN === 'number' && Number.isInteger(onN) && onN >= 1 && onN <= C.OVERNIGHT_PIECES) ? { meat: onMeat, n: onN } : null;
    // X11.2 and X11.3: the crew, the next card id, Hiring Day and the three season keys.
    const seasonV5 = v >= 5 && isPlainObject(seasonIn) ? seasonIn : undefined;
    const crew = v >= 5 ? readCrew(readKey(obj, 'crew')) : migrateHires(hires, season.seed);
    let maxId = 0;
    for (const c of crew) maxId = Math.max(maxId, c.id);
    const seqLo = Math.min(9999, maxId + 1);
    const crewSeq = v >= 5 ? clamp(toInt(readKey(obj, 'crewSeq'), seqLo, 1, 9999), seqLo, 9999) : seqLo;
    const draftedIn = readKey(seasonV5, 'drafted');
    season.drafted = typeof draftedIn === 'boolean' ? draftedIn : (season.results.length > 0 || crew.length > 0);
    const trainedIn = readKey(seasonV5, 'trained');
    season.trained = (typeof trainedIn === 'number' && Number.isInteger(trainedIn) && trainedIn >= 1 && trainedIn <= crewSeq - 1) ? trainedIn : null;
    season.walkins = v >= 5 ? readWalkins(readKey(seasonV5, 'walkins')) : [];
    let hiring = null;
    if (v >= 5 && season.results.length === 0 && season.drafted === false && player !== null && !owed) {
      hiring = readHiring(readKey(obj, 'hiring'), season.year);
    }
    return {
      v: C.SAVE_VERSION, day, cash, rep, stock, charcoal, wood, gear, decor, stats, drivewayShown,
      tutorial: { done: !owed },
      season, crew, crewSeq, hiring, player, pitName, settings
    };
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Small pure helpers used by the sim
// ---------------------------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
function zeroByMeat() { const o = {}; for (const m of MEAT_IDS) o[m] = 0; return o; }
function emptySeats() { const o = {}; for (const s of SEAT_IDS) o[s] = null; return o; }
function sumValues(o) { let s = 0; for (const k in o) s += o[k]; return s; }
function cheapestUnit() {
  let best = Infinity;
  for (const m of MEAT_IDS) if (!MEATS[m].drumOnly && MEATS[m].unit < best) best = MEATS[m].unit;
  return best;
}
function quickestInStock(stock) {
  let best = null;
  for (const m of MEAT_IDS) {
    if (stock[m] > 0 && (best === null || MEATS[m].cook < MEATS[best].cook)) best = m;
  }
  return best;
}
function plateWaste(meat) { return Math.round(MEATS[meat].unit / MEATS[meat].plates); }

// ---------------------------------------------------------------------------------------------
// 2.5 createSim
// ---------------------------------------------------------------------------------------------

function createSim(saved, seed) {
  const seedUsed = (seed === undefined || seed === null || !Number.isFinite(Number(seed)))
    ? (Date.now() >>> 0)
    : (Math.trunc(Number(seed)) >>> 0);
  const rng = mulberry32(seedUsed);

  const state = {};
  const events = [];
  let acc = 0;              // step accumulator in seconds
  let tickCount = 0;        // ticks since openGate, drives state.clock
  let pieceSeq = 0;         // piece ids within the day
  let custSeq = 0;          // customer ids within the day
  let buddyPick = null;     // meat reserved by the buddy during his pickup
  let gateOpenFired = false;
  const decayAcc = { kettle1: 0, kettle2: 0, drum: 0 };   // seconds since each cooker's last whole second of decay
  let tutEndAt = null;      // clock at which the end step runs out (K1: internal, never saved)
  let tutLastId = null;     // last (id, target) pair emitted as tutorial_step
  let tutLastTarget = null;
  // v3.0 (W5.1): the look generator, apart from rng so tapping Random never moves the game's
  // stream. (W7.2): today's booked arrival times and tickets left per meat; internal, never saved.
  const lookRng = mulberry32((seedUsed ^ 0x4C4F4F4B) >>> 0);
  let schedule = [];
  let schedIdx = 0;
  let tickets = zeroByMeat();
  // R-4: gear and decor bought since the morning opened, and the cash it opened with (never saved).
  let morningBuys = [];
  let morningCash = 0;
  // v3.1: signing fees and send-offs since the morning opened (X18.1 item 32, never saved), the
  // booked guests' party index per schedule entry and the pull forward timer (X5.10, item 38), and
  // whether today's fire was sampled from the gate on (X5.5, item 37).
  let crewSpend = [];
  let schedParty = [];
  let pullT = 0;
  let fireSampled = false;

  function emit(type, payload) {
    const e = { type };
    if (payload) Object.assign(e, payload);
    events.push(e);
  }

  // ---- state construction -------------------------------------------------------------------

  function newMover(x, y, face) {
    return { x, y, px: x * TILE, py: y * TILE, face, next: null, path: [], walking: false, anim: 0 };
  }

  function newCooker(id) {
    const st = STATION_BY_ID[id];
    return { id, fire: 0, slots: st.slots, pieces: [], lowWarned: true, outFired: true };
  }

  function newToday() {
    return {
      revenue: 0, tips: 0, foodCost: 0, bags: 0, wages: 0, spoilCost: 0, wasteCost: 0, wastePlates: 0, wasteBurnt: 0, grateCost: 0,
      customers: 0, served: 0, walkouts: 0, past: 0, close: 0, happy: 0, ok: 0, burnt: 0,
      seated: 0, togo: 0, togoQuick: 0, seatTips: 0,
      spoiled: zeroByMeat(), grateLeft: zeroByMeat(),
      repStart: state.rep || C.START_REP,
      wageNames: [],
      // v3.0 (W4.2); loadUp() and openGate() set the kind and the three times
      kind: 'tutorial', gateAt: C.GATE_OPENS, lastCallAt: C.LAST_CALL, endAt: C.DAY_SECONDS,
      booking: null, addon: null, rail: zeroByMeat(), sold: zeroByMeat(),
      booked: 0, pending: 0, fed: 0, missed: 0, waitSum: 0, offMenu: 0, addonServed: 0, addonBurnt: 0,
      deposit: 0,
      // playtest round 1: cold booked plates (P-2), raw meat thrown out (P-3), a sold out miss (P-6)
      cold: 0, rawWaste: 0, soldOutMiss: false,
      // v3.1 (X4.4): one entry per lineup card, the fire from the gate on, the fan third at load up
      crew: {},
      fireGoodS: { kettle1: 0, kettle2: 0, drum: 0 },
      fireDipped: { kettle1: false, kettle2: false, drum: false },
      fireHotS: { kettle1: 0, kettle2: 0, drum: 0 },   // review 1: seconds after the gate at FIRE_HOT or above
      third: 0,
      // v3.2 (D3.4)
      weekday: false, prepBonus: 0, overnight: null, dayIdx: 0
    };
  }

  function tableSpotCount() {
    return state.gear.bigtable ? C.TABLE_SPOTS_BIG : C.TABLE_SPOTS;
  }

  function queueSpotCount() {
    return state.gear.bigtable ? C.QUEUE_SPOTS_BIG : C.QUEUE_SPOTS;
  }

  function newPlayer() {
    return Object.assign(newMover(MAP.spawn.x, MAP.spawn.y, MAP.spawn.face), { carrying: null, busy: null, target: null, queued: null });
  }

  function fillState(save) {
    for (const k of Object.keys(state)) delete state[k];
    const s = save || null;
    state.day = s ? s.day : 1;
    state.phase = 'morning';
    state.paused = false;
    state.broke = false;
    state.clock = 0;
    state.cash = s ? s.cash : C.START_CASH;
    state.rep = s ? s.rep : C.START_REP;
    state.stock = zeroByMeat();
    if (s) for (const m of MEAT_IDS) state.stock[m] = s.stock[m];
    state.charcoal = s ? s.charcoal : 0;
    state.gear = {};
    for (const g of GEAR_IDS) state.gear[g] = s ? s.gear[g] === true : false;
    state.decor = {};
    for (const d of DECOR_IDS) state.decor[d] = s && s.decor ? s.decor[d] === true : false;
    if (!state.decor.chair1) state.decor.chair2 = false;
    state.seats = emptySeats();
    // v3.1 (X4.1): crew cards replace state.hires.
    state.crew = s ? s.crew.map(copyCard) : [];
    state.crewSeq = s ? s.crewSeq : 1;
    state.hiring = null;
    state.stats = {};
    for (const k of STAT_IDS) {
      const v = s && s.stats ? Number(s.stats[k]) : 0;
      state.stats[k] = Number.isFinite(v) ? v : 0;
    }
    state.drivewayShown = s ? s.drivewayShown === true : false;
    // [T 2.1]: a new game runs the tutorial; a save runs it only when it still owes it (deviation 25).
    const owed = !s || (isPlainObject(s.tutorial) && s.tutorial.done === false && s.day === 1);
    state.tutorial = owed ? { step: 'open', done: false } : { step: null, done: true };
    state.rain = false;
    state.comingNext = false;
    state.yesterday = null;
    state.cart = { meat: zeroByMeat(), charcoal: 0 };
    state.selected = 'sausage';
    state.spawnAt = Infinity;
    state.arrivals = 0;
    state.lastCallFired = false;
    state.gateSoonFired = false;
    state.stations = {
      kettle1: newCooker('kettle1'),
      kettle2: newCooker('kettle2'),
      drum: newCooker('drum'),
      board: { stacks: [], slicing: null, waiting: [] },
      table: { spots: new Array(tableSpotCount()).fill(null) }
    };
    state.player = newPlayer();
    state.buddy = null;
    state.tender = null;
    state.prep = null;
    state.customers = [];
    state.today = newToday();
    state.till = null;
    // v3.0 (W4.1, W22.1): the season, the creator's profile, the pit name, settings and wood.
    // createSim() settles state.loop from the save (W13.3).
    state.wood = s ? s.wood : 0;
    state.loop = owed ? 'tutorial' : 'week';
    const ss = s ? s.season : null;
    state.season = {
      year: ss ? ss.year : 1,
      week: ss ? ss.week : 1,
      seed: ss ? ss.seed : ((seedUsed ^ 0x5EA5011D) >>> 0),
      weekCash: ss ? ss.weekCash : state.cash,
      offers: [],
      booking: null,
      addon: null,
      results: ss ? ss.results.map((x) => ({ type: x.type, stars: x.stars })) : [],
      // v3.1 (X4.1): createSim() restores the saved trained pick and walk-ins after startWeek().
      drafted: ss ? ss.drafted === true : false,
      trained: null,
      walkins: [],
      // v3.2 (D3.1): createSim() restores the saved day keys after startWeek().
      day: 0,
      dayLog: new Array(C.WEEK_DAYS).fill(null),
      prepped: false,
      loadin: false,
      overnight: null
    };
    state.dayCard = null;
    state.profile = s && s.player ? { name: s.player.name, look: cleanLook(s.player.look) } : null;
    state.pitName = s ? s.pitName : STRINGS.defaultPit;
    state.settings = { length: s ? s.settings.length : 'normal' };
    acc = 0;
    tickCount = 0;
    pieceSeq = 0;
    custSeq = 0;
    buddyPick = null;
    gateOpenFired = false;
    tutEndAt = null;
    tutLastId = null;
    tutLastTarget = null;
    schedule = [];
    schedIdx = 0;
    tickets = zeroByMeat();
    crewSpend = [];
    schedParty = [];
    pullT = 0;
    fireSampled = false;
  }

  // ---- grid and walkability ([V2.2.1]) ------------------------------------------------------

  function inMap(x, y) {
    return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
  }

  function stationActive(st) {
    return tileOwned(st, state.gear);
  }

  // The active station whose active footprint holds (x, y), or null.
  function stationAt(x, y) {
    for (const st of STATIONS) {
      if (!stationActive(st)) continue;
      for (const t of st.tiles) {
        if (t.x === x && t.y === y && tileOwned(t, state.gear)) return st;
      }
    }
    return null;
  }

  function activeUseTiles(st) {
    return st.use.filter((u) => tileOwned(u, state.gear));
  }

  // Player, buddy and tender: ground PAVER, no fixed prop, no active station tile.
  function walkable(x, y) {
    x = Math.trunc(Number(x));
    y = Math.trunc(Number(y));
    if (!inMap(x, y)) return false;
    if (TILES[y * MAP_W + x] !== T.PAVER) return false;
    if (PROP_BLOCKED[y * MAP_W + x] === 1) return false;
    return stationAt(x, y) === null;
  }

  function decorOwned(id) {
    return state.decor[id] === true;
  }

  // A blocking tile of an owned decor footprint.
  function decorBlocks(x, y) {
    for (const d of DECOR) {
      if (!decorOwned(d.id)) continue;
      for (const b of d.blocks) if (b.x === x && b.y === y) return true;
    }
    return false;
  }

  function ownedSeatAt(x, y) {
    for (const s of SEATS) {
      if (s.x === x && s.y === y && tileOwned(s, state.gear, state.decor)) return s;
    }
    return null;
  }

  // Customers: the spawn, or ground LAWN or GATE; no fixed prop; no blocking tile of owned decor;
  // no owned seat tile unless it is the BFS goal (gx, gy). The dog calls it with (-1, -1).
  function custWalkable(x, y, gx, gy) {
    x = Math.trunc(Number(x));
    y = Math.trunc(Number(y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x === MAP.custSpawn.x && y === MAP.custSpawn.y) return true;
    if (!inMap(x, y)) return false;
    const g = TILES[y * MAP_W + x];
    if (g !== T.LAWN && g !== T.GATE) return false;
    if (PROP_BLOCKED[y * MAP_W + x] === 1) return false;
    if (decorBlocks(x, y)) return false;
    if (ownedSeatAt(x, y) !== null && !(x === gx && y === gy)) return false;
    return true;
  }

  // Breadth first search, 4 directions, neighbor order up, down, left, right. `goal(x, y)` ends
  // the search; `passable(x, y)` says whether a tile may be entered. The grid has one row below
  // the map so the customer spawn (9,12) can be reached. Returns the path after the start tile
  // (array of {x, y}), [] when the start is a goal, or null.
  function bfs(sx, sy, goal, passable) {
    if (goal(sx, sy)) return [];
    if (!(sx >= 0 && sx < MAP_W && sy >= 0 && sy < GRID_H)) return null;
    const n = MAP_W * GRID_H;
    const prev = new Int16Array(n).fill(-1);
    const seen = new Uint8Array(n);
    const queue = [];
    const startIdx = sy * MAP_W + sx;
    seen[startIdx] = 1;
    queue.push(startIdx);
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const cx = idx % MAP_W;
      const cy = (idx - cx) / MAP_W;
      for (const d of DIR_ORDER) {
        const nx = cx + DIRS[d].dx;
        const ny = cy + DIRS[d].dy;
        if (!(nx >= 0 && nx < MAP_W && ny >= 0 && ny < GRID_H)) continue;
        const nIdx = ny * MAP_W + nx;
        if (seen[nIdx]) continue;
        if (!passable(nx, ny)) continue;
        seen[nIdx] = 1;
        prev[nIdx] = idx;
        if (goal(nx, ny)) {
          const path = [];
          let cur = nIdx;
          while (cur !== startIdx) {
            const px2 = cur % MAP_W;
            path.push({ x: px2, y: (cur - px2) / MAP_W });
            cur = prev[cur];
          }
          path.reverse();
          return path;
        }
        queue.push(nIdx);
      }
    }
    return null;
  }

  function playerBfs(sx, sy, goal) {
    return bfs(sx, sy, goal, walkable);
  }

  function nearestWalkableTo(x, y) {
    let best = null;
    let bestD = Infinity;
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (!walkable(tx, ty)) continue;
        const d = Math.abs(tx - x) + Math.abs(ty - y);
        if (d < bestD) { bestD = d; best = { x: tx, y: ty }; }
      }
    }
    return best;
  }

  function faceToward(fromX, fromY, toX, toY) {
    if (toX > fromX) return 'right';
    if (toX < fromX) return 'left';
    if (toY > fromY) return 'down';
    return 'up';
  }

  // ---- charm ([V2.6], D7) -------------------------------------------------------------------

  function charm() {
    let sum = 0;
    for (const d of DECOR_IDS) if (decorOwned(d)) sum += CATALOG_BY_ID[d].charm;
    return Math.min(C.CHARM_MAX, sum);
  }

  function seatBonus() {
    return Math.min(C.SEAT_BONUS_MAX, C.SEAT_BONUS_BASE + Math.floor(charm() / C.CHARM_STEP));
  }

  function seatCount() {
    let n = 2;
    for (const d of DECOR_IDS) if (decorOwned(d)) n += CATALOG_BY_ID[d].seats;
    return n;
  }

  function repMax() {
    return C.REP_DAY_MAX + Math.floor(charm() / C.CHARM_STEP);
  }

  // ---- movers -------------------------------------------------------------------------------

  // Advance a mover along its path at `speed` tiles per second for `dt` seconds. Distance left
  // over after reaching a tile carries into the next tile of the path (deviation 16).
  // Returns true when at least one tile step completed this call.
  function advanceMover(m, speed, dt) {
    if (m.next === null && m.path.length === 0) {
      m.walking = false;
      m.anim = 0;
      return false;
    }
    let budget = speed * TILE * dt;
    let arrived = false;
    m.anim += dt;
    while (budget > 1e-9) {
      if (m.next === null) {
        if (m.path.length === 0) break;
        m.next = m.path.shift();
        m.face = faceToward(m.x, m.y, m.next.x, m.next.y);
      }
      const tx = m.next.x * TILE;
      const ty = m.next.y * TILE;
      const dx = tx - m.px;
      const dy = ty - m.py;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist <= budget + 1e-6) {
        m.px = tx;
        m.py = ty;
        m.x = m.next.x;
        m.y = m.next.y;
        m.next = null;
        arrived = true;
        budget -= dist;
      } else {
        if (dx !== 0) m.px += Math.sign(dx) * budget;
        else m.py += Math.sign(dy) * budget;
        budget = 0;
      }
    }
    if (m.next === null && m.path.length === 0) {
      m.walking = false;
      m.anim = 0;
    } else {
      m.walking = true;
    }
    return arrived;
  }

  function moverAnchor(m) {
    return m.next ? m.next : { x: m.x, y: m.y };
  }

  function playerIdle() {
    return state.phase === 'service' && !state.paused && state.player.busy === null;
  }

  // ---- 2.5.5 tap to walk and keyboard --------------------------------------------------------

  function walkTo(tx, ty) {
    tx = Math.trunc(Number(tx));
    ty = Math.trunc(Number(ty));
    if (state.phase === 'service' && !state.paused && state.player.busy !== null) {
      // Mid slice: keep the last tap and start it the tick the slice completes.
      if (!inMap(tx, ty)) { emit('blocked'); return false; }
      state.player.queued = { tx, ty };
      emit('tap_queued');
      return true;
    }
    if (!playerIdle()) return false;
    const p = state.player;
    if (!inMap(tx, ty)) { emit('blocked'); return false; }
    const st = stationAt(tx, ty);
    const anchor = moverAnchor(p);
    if (st) {
      const uses = activeUseTiles(st);
      const onUse = p.next === null ? uses.find((u) => u.x === p.x && u.y === p.y) : null;
      if (onUse) {
        p.path = [];
        p.face = onUse.face;
        p.target = { station: st.id, auto: true };
        return true;
      }
      const path = playerBfs(anchor.x, anchor.y, (x, y) => uses.some((u) => u.x === x && u.y === y));
      if (path === null) { emit('blocked'); return false; }
      p.path = path;
      p.target = { station: st.id, auto: true };
      return true;
    }
    if (walkable(tx, ty)) {
      const path = playerBfs(anchor.x, anchor.y, (x, y) => x === tx && y === ty);
      if (path === null) { emit('blocked'); return false; }
      p.path = path;
      p.target = null;
      return true;
    }
    emit('blocked');
    return false;
  }

  function move(dir) {
    if (!playerIdle()) return false;
    if (!DIRS[dir]) return false;
    const p = state.player;
    p.path = [];
    p.target = null;
    p.face = dir;
    if (p.next !== null) return false;
    const nx = p.x + DIRS[dir].dx;
    const ny = p.y + DIRS[dir].dy;
    if (!walkable(nx, ny)) return false;
    p.next = { x: nx, y: ny };
    p.walking = true;
    return true;
  }

  // ---- 2.5.4 reach --------------------------------------------------------------------------

  function reach() {
    const p = state.player;
    const d = DIRS[p.face] || DIRS.up;
    const st = stationAt(p.x + d.dx, p.y + d.dy);
    return st ? st.id : null;
  }

  // When the player arrives on a use tile of the target station, face it.
  function faceTarget(st) {
    const p = state.player;
    const u = activeUseTiles(st).find((t) => t.x === p.x && t.y === p.y);
    if (u) { p.face = u.face; return; }
    // Not on a listed use tile: face the nearest footprint tile that is 4-adjacent, if any.
    for (const d of DIR_ORDER) {
      const s2 = stationAt(p.x + DIRS[d].dx, p.y + DIRS[d].dy);
      if (s2 && s2.id === st.id) { p.face = d; return; }
    }
  }

  // ---- hands, stacks, table -----------------------------------------------------------------

  function totalStock() { return sumValues(state.stock); }

  // Q-3: some owned cooker has a free slot for this meat (brisket only the drum).
  function roomToCook(meat) {
    const m = MEATS[meat];
    for (const id of COOKER_IDS) {
      if (!stationActive(STATION_BY_ID[id])) continue;
      if (m.drumOnly && id !== 'drum') continue;
      if (freeSlotFor(state.stations[id], m.slots) >= 0) return true;
    }
    return false;
  }

  function freeSlotFor(cooker, size) {
    const taken = new Array(cooker.slots).fill(false);
    for (const p of cooker.pieces) {
      for (let i = 0; i < p.size; i++) taken[p.slot + i] = true;
    }
    for (let i = 0; i + size <= cooker.slots; i++) {
      let ok = true;
      for (let j = 0; j < size; j++) if (taken[i + j]) { ok = false; break; }
      if (ok) return i;
    }
    return -1;
  }

  // 5.2 pull order: burnt first by burn time, then overshoot fraction, then earliest put on.
  function pullCandidate(cooker) {
    let best = null;
    let bestKey = -Infinity;
    for (const p of cooker.pieces) {
      if (p.state === 'cooking') continue;
      const m = MEATS[p.meat];
      const key = p.state === 'burnt' ? 1 + (state.clock - p.burntAt) : (p.prog - m.cook) / m.window;
      if (best === null || key > bestKey || (key === bestKey && p.putOn < best.putOn)) {
        best = p;
        bestKey = key;
      }
    }
    return best;
  }

  function tableStackOf(meat) {
    for (const sp of state.stations.table.spots) {
      if (sp && sp.meat === meat && sp.times.length > 0) return sp;
    }
    return null;
  }

  // [S 19.6] Spot indexes nearest first to a point (sim px): the counter used end to end.
  function spotsNearest(x) {
    const spots = state.stations.table.spots;
    const spx = STATION_BY_ID.table.spotPx;
    const order = [];
    for (let i = 0; i < spots.length; i++) order.push(i);
    order.sort((a, b) => {
      const da = spx[a] ? Math.abs(spx[a].x - x) : 1e9;
      const db = spx[b] ? Math.abs(spx[b].x - x) : 1e9;
      return da - db || a - b;
    });
    return order;
  }

  // The end of the counter nearest the line: the first queue spot's centre.
  function lineEndX() { return MAP.queue[0].x * 16 + 8; }

  // [S 19.6] Each set-down fills the next free spot from the end nearest the line outward;
  // only with no spot free does a plate stack on a spot of its meat with room (TABLE_STACK).
  // Other meats that will want a spot of their own soon: asked for in the line, on the board or
  // its knife, or in someone's hands, and not already on the counter.
  function otherMeatsDue(meat) {
    const due = new Set();
    for (const c of waitingCustomers()) if (c.want) due.add(c.want);
    const brd = state.stations.board;
    for (const st of brd.stacks) if (st.times.length > 0) due.add(st.meat);
    if (brd.slicing) due.add(brd.slicing.meat);
    for (const who of [state.player, state.buddy]) {
      const h = who && who.carrying;
      if (h && (h.kind === 'plates' || h.kind === 'cooked')) due.add(h.meat);
    }
    due.delete(meat);
    for (const sp of state.stations.table.spots) if (sp) due.delete(sp.meat);
    return due.size;
  }

  // [S 19.6] Each set-down fills the next free spot from the end nearest the line outward. It
  // stacks on a spot of its meat with room (TABLE_STACK) instead only when no spot is free, or when
  // a free spot is all that is left for another meat that is due, so the counter never holds less
  // than the old one meat a spot rule did.
  function tableSpotIndexFor(meat) {
    const spots = state.stations.table.spots;
    const order = spotsNearest(lineEndX());
    let free = -1, freeN = 0, stack = -1;
    for (const i of order) {
      const sp = spots[i];
      if (sp === null) { freeN += 1; if (free < 0) free = i; }
      else if (stack < 0 && sp.meat === meat && sp.times.length < C.TABLE_STACK) stack = i;
    }
    if (free >= 0 && (stack < 0 || freeN - 1 >= otherMeatsDue(meat))) return free;
    return stack >= 0 ? stack : free;
  }

  function tableFits(meat) { return tableSpotIndexFor(meat) >= 0; }

  function boardStackOf(meat) {
    return state.stations.board.stacks.find((s) => s.meat === meat) || null;
  }

  // R-2: a stack of that meat with room for every plate, else a free stack.
  function boardStackWithRoom(meat, plates) {
    return state.stations.board.stacks.find((s) => s.meat === meat && s.times.length + plates <= C.BOARD_STACK) || null;
  }

  function boardFits(meat, plates) {
    if (boardStackWithRoom(meat, plates)) return true;
    return state.stations.board.stacks.length < C.BOARD_STACKS && plates <= C.BOARD_STACK;
  }

  function lineCustomers() {
    return state.customers
      .filter((c) => c.queueIndex >= 0 && (c.mode === 'waiting' || c.mode === 'arriving'))
      .sort((a, b) => a.queueIndex - b.queueIndex);
  }

  function waitingCustomers() {
    return state.customers
      .filter((c) => c.queueIndex >= 0 && c.mode === 'waiting')
      .sort((a, b) => a.queueIndex - b.queueIndex);
  }

  // 5.2 and 5.3 stack rule: the stack a waiting customer ordered that is not on the table,
  // front of line first, else the oldest stack.
  function chooseBoardStack() {
    const stacks = state.stations.board.stacks;
    if (stacks.length === 0) return null;
    for (const c of waitingCustomers()) {
      const st = boardStackOf(c.want);
      if (st && !tableStackOf(c.want)) return st;
    }
    return stacks[0];
  }

  function takeFromBoardStack(stack, n) {
    const times = stack.times.splice(0, n);
    if (stack.times.length === 0) {
      const i = state.stations.board.stacks.indexOf(stack);
      if (i >= 0) state.stations.board.stacks.splice(i, 1);
    }
    return times;
  }

  function addToBoard(meat, times) {
    const existing = boardStackWithRoom(meat, times.length);
    if (existing) existing.times.push(...times);
    else state.stations.board.stacks.push({ meat, times: times.slice() });
  }

  // ---- customers: routes ([V2.5] steps 1 and 11) ---------------------------------------------

  // Customer grid BFS from the customer's anchor tile to (gx, gy).
  function custRoute(c, gx, gy) {
    const a = moverAnchor(c);
    return bfs(a.x, a.y, (x, y) => x === gx && y === gy, (x, y) => custWalkable(x, y, gx, gy));
  }

  // Give a customer a new route and face its first step; mid step they keep facing the step in
  // progress, and with an empty route they keep their facing.
  function setRoute(c, path) {
    c.path = path;
    if (c.next === null && path.length > 0) c.face = faceToward(c.x, c.y, path[0].x, path[0].y);
  }

  function routeToSpot(c) {
    const spot = MAP.queue[c.queueIndex];
    setRoute(c, custRoute(c, spot.x, spot.y) || []);
  }

  // Leaving the yard: route to the spawn, optionally holding LEAVE_TURN_SECONDS first. An empty
  // route (no way out) removes the customer as soon as nothing holds them (moveCustomers).
  function sendOut(c, reason, mood, turnPause) {
    c.mode = 'leaving';
    c.reason = reason;
    c.mood = mood;
    c.eat = 0;
    c.pause = turnPause ? C.LEAVE_TURN_SECONDS : 0;
    setRoute(c, custRoute(c, MAP.custSpawn.x, MAP.custSpawn.y) || []);
  }

  // Remove a customer from the line and shift everyone behind forward one spot.
  function leaveLine(c) {
    const idx = c.queueIndex;
    c.queueIndex = -1;
    if (idx >= 0) {
      for (const o of state.customers) {
        if (o.queueIndex > idx) {
          o.queueIndex -= 1;
          if (o.mode === 'arriving' || o.mode === 'waiting') routeToSpot(o);
        }
      }
    }
  }

  // [V2.5] step 3: the first seat in SEAT_ORDER that is owned, free and reachable from the
  // customer's anchor tile by customer BFS. Returns { seat, path } or null.
  function pickSeat(c) {
    for (const id of SEAT_IDS) {
      const s = SEAT_BY_ID[id];
      if (!tileOwned(s, state.gear, state.decor)) continue;
      if (state.seats[id] !== null) continue;
      const path = custRoute(c, s.x, s.y);
      if (path !== null) return { seat: s, path };
    }
    return null;
  }

  // ---- serving ([V2.5] steps 3 to 7, D8) -----------------------------------------------------

  // Serve one customer from the table stack of their meat. Returns true when served.
  function serveFromTable(c) {
    const spots = state.stations.table.spots;
    // [S 19.6] The plate in front of the guest, else the nearest one with their meat.
    const qs = c.queueIndex >= 0 ? MAP.queue[c.queueIndex] : null;
    const gx = (qs ? qs.x : c.x) * 16 + 8;
    let idx = -1;
    for (const i of spotsNearest(gx)) {
      if (spots[i] && spots[i].meat === c.want && spots[i].times.length > 0) { idx = i; break; }
    }
    if (idx < 0) return false;
    const sp = spots[idx];
    const sliced = sp.times.shift();
    const ranPlate = Array.isArray(sp.run) ? sp.run.shift() === true : false;   // X5.3
    if (sp.times.length === 0) spots[idx] = null;
    c.runPlate = ranPlate;
    const m = MEATS[c.want];
    const t = state.today;
    const booked = c.booked === true;
    const price = booked ? 0 : m.price;   // W7.2: a booked guest pays no plate price
    const frac = Math.min(1, c.wait / c.patienceMax);
    const plateAge = state.clock - sliced;
    // Review 1 (contract X20.1): a plate the RUN card set down tips (1 + runTip) times the plate tip.
    const runRec = ranPlate && state.buddy && state.buddy.vals ? state.today.crew[String(state.buddy.cardId)] || null : null;
    const tipK = runRec !== null ? 1 + state.buddy.vals.runTip : 1;
    const tip = Math.round(m.price * C.TIP_RATE * (1 - frac) * tipK) + (plateAge < C.HOT_PLATE_SECONDS ? C.HOT_PLATE_TIP : 0);
    if (runRec !== null) runRec.tips += tip;
    const quick = c.wait < C.REP_QUICK_FRAC * c.patienceMax;
    state.cash += price + tip;
    t.revenue += price;
    t.tips += tip;
    t.served += 1;
    state.stats.served += 1;
    t.sold[c.want] += 1;
    if (booked) {
      t.fed += 1;
      t.waitSum += c.wait;
      if (plateAge >= C.HOT_PLATE_SECONDS) t.cold += 1;   // P-2
      if (t.addon !== null && c.want === t.addon) t.addonServed += 1;
      if (!(t.rail[c.want] > 0)) t.offMenu += 1;
    }
    const spot = STATION_BY_ID.table.spotPx[idx];
    const pick = pickSeat(c);
    leaveLine(c);
    c.mood = 'happy';
    c.hop = SERVED_HOP;
    emit('served', { id: c.id, meat: c.want, price, tip, quick, x: spot.x, y: spot.y, booked });
    // W7.2: the per serve word of mouth counters skip booked guests (their stars carry it).
    if (pick !== null) {
      const id = pick.seat.id;
      state.seats[id] = c.id;
      c.seat = id;
      c.eatMax = C.EAT_MIN + (C.EAT_MAX - C.EAT_MIN) * rng();
      c.eat = 0;
      c.mode = 'toSeat';
      c.reason = null;
      c.pause = C.LEAVE_TURN_SECONDS;
      setRoute(c, pick.path);
      if (!booked) { if (quick) t.happy += 1; else t.ok += 1; }
      emit('seat_taken', { id: c.id, seat: id });
    } else {
      t.togo += 1;
      if (!booked) { if (quick) t.togoQuick += 1; else t.ok += 1; }
      sendOut(c, 'togo', 'happy', true);
      emit('to_go', { id: c.id });
    }
    return true;
  }

  function serveLine() {
    for (const c of waitingCustomers()) serveFromTable(c);
  }

  // Set down the plates in `hands` (a Carry of kind plates). Places what fits, serves anyone
  // waiting for that meat, repeats while plates remain and room opens. Returns plates placed.
  // X5.3: `byRun` marks each plate the RUN card set down (spot.run runs beside spot.times).
  function setDown(hands, byRun) {
    let placed = 0;
    const spots = state.stations.table.spots;
    while (hands.times.length > 0) {
      const idx = tableSpotIndexFor(hands.meat);
      if (idx < 0) break;
      if (spots[idx] === null) spots[idx] = { meat: hands.meat, times: [], run: [] };
      const sp = spots[idx];
      if (!Array.isArray(sp.run)) sp.run = sp.times.map(() => false);
      // [S 19.6] One plate per pass, so the next plate looks for the next free spot.
      sp.times.push(hands.times.shift());
      sp.run.push(byRun === true);
      placed += 1;
      serveLine();
    }
    return placed;
  }

  // 5.3 default selection: the meat a waiting customer ordered that is not cooking or plated,
  // else the quickest meat in stock. Only meats with stock count.
  function autoSelect() {
    const stock = state.stock;
    for (const c of waitingCustomers()) {
      const m = c.want;
      if (stock[m] <= 0) continue;
      let busy = tableStackOf(m) !== null || boardStackOf(m) !== null;
      if (!busy) {
        for (const id of COOKER_IDS) {
          if (state.stations[id].pieces.some((p) => p.meat === m && p.state !== 'burnt')) { busy = true; break; }
        }
      }
      if (!busy) { state.selected = m; return; }
    }
    const q = quickestInStock(stock);
    if (q !== null) state.selected = q;
  }

  function selectMeat(id) {
    if (!MEATS[id]) return false;
    if (!(state.stock[id] > 0)) return false;
    state.selected = id;
    return true;
  }

  function cycleMeat(delta) {
    const n = MEAT_IDS.length;
    const start = Math.max(0, MEAT_IDS.indexOf(state.selected));
    const d = delta < 0 ? -1 : 1;
    for (let i = 1; i <= n; i++) {
      const m = MEAT_IDS[(start + d * i + n * n) % n];
      if (state.stock[m] > 0) { state.selected = m; break; }
    }
    return state.selected;
  }

  function holding() {
    const c = state.player.carrying;
    if (c === null) return STRINGS.handsEmpty;
    if (c.kind === 'charcoal') return 'Holding: charcoal';
    const label = MEATS[c.meat].label;
    if (c.kind === 'plates') {
      const n = c.times.length;
      return 'Holding: ' + n + (n === 1 ? ' plate of ' : ' plates of ') + label;
    }
    return 'Holding: ' + c.kind + ' ' + label;
  }

  // ---- 5.2 the action table -----------------------------------------------------------------

  function noop(label, station) {
    return { label, enabled: false, auto: false, station, run: null };
  }
  function act(label, auto, station, run) {
    return { label, enabled: true, auto, station, run };
  }

  function trashCarry(carry) {
    const m = MEATS[carry.meat];
    if (carry.kind === 'plates') {
      state.today.wastePlates += carry.times.length;
      state.today.wasteCost += plateWaste(carry.meat) * carry.times.length;
    } else if (carry.kind === 'burnt') {
      state.today.wasteBurnt += 1;
      state.today.wasteCost += m.unit;
    } else if (carry.kind === 'cooked') {
      state.today.wastePlates += m.plates;
      state.today.wasteCost += m.unit;
    } else {
      state.today.wasteCost += m.unit;
      state.today.rawWaste += m.unit;   // P-3: raw meat never reached the grate, so foodCost missed it
    }
    emit('trash', { meat: carry.meat, kind: carry.kind });
  }

  function resolveAction() {
    const p = state.player;
    const id = reach();
    if (id === null) return noop(STRINGS.walk, null);
    const st = STATION_BY_ID[id];
    const c = p.carrying;
    const stationId = st.id;

    if (st.type === 'cooler') {
      if (c === null) {
        if (totalStock() === 0) return noop('Cooler is empty', stationId);
        if (!(state.stock[state.selected] > 0)) autoSelect();
        const m = state.selected;
        return act('Take ' + MEATS[m].label + ' (' + state.stock[m] + ' left)', true, stationId, () => {
          state.stock[m] -= 1;
          p.carrying = { kind: 'raw', meat: m };
          if (state.stock[m] === 0) autoSelect();
        });
      }
      if (c.kind === 'raw') {
        // Q-3: a tap puts it back when no owned cooker has room for it (the tutorial's full grate).
        return act('Put ' + MEATS[c.meat].label + ' back', !roomToCook(c.meat), stationId, () => {
          state.stock[c.meat] += 1;
          p.carrying = null;
        });
      }
      return noop(fullLabel(c), stationId);
    }

    if (st.type === 'pile') {
      if (c === null) {
        if (state.charcoal <= 0) return noop('Out of charcoal', stationId);
        return act('Grab charcoal (' + state.charcoal + (state.charcoal === 1 ? ' bag)' : ' bags)'), true, stationId, () => {
          state.charcoal -= 1;
          state.today.bags += 1;
          p.carrying = { kind: 'charcoal' };
        });
      }
      return noop(fullLabel(c), stationId);
    }

    if (st.type === 'cooker') {
      const cooker = state.stations[st.id];
      if (c !== null && c.kind === 'charcoal') {
        const cold = cooker.fire < C.COLD_UNDER;
        return act(cold ? 'Light the fire' : 'Add charcoal', true, stationId, () => {
          addCharcoal(cooker);
          p.carrying = null;
        });
      }
      if (c !== null && c.kind === 'raw') {
        const m = MEATS[c.meat];
        if (m.drumOnly && st.id !== 'drum') return noop('Brisket needs the drum', stationId);
        const slot = freeSlotFor(cooker, m.slots);
        if (slot < 0) return noop('Grate is full', stationId);
        return act('Put ' + m.label + ' on', true, stationId, () => {
          pieceSeq += 1;
          // D4.5: the first overnight pieces of that meat start part done.
          const on = state.today.overnight;
          let prog0 = 0;
          if (on !== null && on.left > 0 && on.meat === m.id) { prog0 = Math.round(C.OVERNIGHT_HEAD * m.cook); on.left -= 1; }
          cooker.pieces.push({ id: pieceSeq, meat: m.id, slot, size: m.slots, prog: prog0, state: 'cooking', putOn: state.clock, burntAt: null, warn: false });
          state.today.foodCost += m.unit;
          p.carrying = null;
        });
      }
      if (c === null) {
        const pick = pullCandidate(cooker);
        if (pick) {
          const pullLabel = pick.state === 'done' && pick.warn === true ? STRINGS.pullNow : 'Pull ' + MEATS[pick.meat].label;
          return act(pullLabel, true, stationId, () => {
            const i = cooker.pieces.indexOf(pick);
            if (i >= 0) cooker.pieces.splice(i, 1);
            p.carrying = { kind: pick.state === 'burnt' ? 'burnt' : 'cooked', meat: pick.meat };
          });
        }
        if (cooker.pieces.length > 0) {
          let left = Infinity;
          for (const pc of cooker.pieces) left = Math.min(left, MEATS[pc.meat].cook - pc.prog);
          return noop('Not done yet (' + Math.max(1, Math.ceil(left)) + 's)', stationId);
        }
        return noop('Grate is empty', stationId);
      }
      return noop(fullLabel(c), stationId);
    }

    if (st.type === 'board') {
      const board = state.stations.board;
      if (c !== null && c.kind === 'cooked') {
        const m = MEATS[c.meat];
        // X5.3 and X18.1 item 39: with a PREP card on, leave the piece for them while the board holds
        // fewer than PREP_WAIT and has room for it next to the pieces of that meat already waiting.
        if (state.prep && board.waiting.length < C.PREP_WAIT && boardFits(c.meat, m.plates + waitingPlates(c.meat))) {
          const name = prepName();
          return act('Leave ' + m.label + ' for ' + name, true, stationId, () => {
            board.waiting.push({ meat: m.id });
            p.carrying = null;
            emit('left_for_prep', { meat: m.id, name });
          });
        }
        if (board.slicing !== null) return noop('Board is busy', stationId);
        if (!boardFits(c.meat, m.plates)) return noop('Board is full. Use the trash', stationId);   // R-2
        return act('Slice ' + m.label, true, stationId, () => {
          p.busy = { what: 'slice', meat: m.id, t: 0, total: m.slice };
          board.slicing = { meat: m.id, t: 0, total: m.slice, who: 'player' };
          p.carrying = null;
        });
      }
      if (c === null) {
        const stack = chooseBoardStack();
        if (!stack) return noop('Board is empty', stationId);
        const cap = state.gear.tray ? C.TRAY_PLATES : 1;
        const n = Math.min(cap, stack.times.length);
        const label = 'Take ' + MEATS[stack.meat].label + (n === 1 ? ' plate' : ' plates');
        return act(label, true, stationId, () => {
          const times = takeFromBoardStack(stack, n);
          p.carrying = { kind: 'plates', meat: stack.meat, times };
        });
      }
      if (c.kind === 'plates' && state.gear.tray && c.times.length === 1) {
        const stack = boardStackOf(c.meat);
        if (stack) {
          return act('Take 1 more ' + MEATS[c.meat].label + ' plate', true, stationId, () => {
            const times = takeFromBoardStack(stack, 1);
            c.times.push(...times);
          });
        }
        return noop(fullLabel(c), stationId);
      }
      if (c.kind === 'burnt') return noop("That's burnt. Trash it", stationId);
      return noop(fullLabel(c), stationId);
    }

    if (st.type === 'table') {
      if (c === null) return noop(STRINGS.nothing, stationId);
      if (c.kind === 'plates') {
        if (!tableFits(c.meat)) return noop('No room on the table', stationId);
        return act('Set down ' + MEATS[c.meat].label, true, stationId, () => {
          const meat = c.meat;
          const n = setDown(c);
          if (c.times.length === 0) p.carrying = null;
          emit('set_down', { meat, n });
        });
      }
      return noop(STRINGS.handsFull, stationId);
    }

    if (st.type === 'trash') {
      if (c === null || c.kind === 'charcoal') return noop(STRINGS.nothing, stationId);
      if (c.kind === 'burnt') {
        return act('Trash the burnt ' + MEATS[c.meat].label, true, stationId, () => {
          trashCarry(c);
          p.carrying = null;
        });
      }
      return act('Throw away ' + MEATS[c.meat].label, false, stationId, () => {
        trashCarry(c);
        p.carrying = null;
      });
    }

    return noop(c === null ? STRINGS.nothing : fullLabel(c), stationId);
  }

  function addCharcoal(cooker) {
    if (cooker.fire < C.COLD_UNDER) cooker.fire = C.FIRE_LIGHT;
    else cooker.fire = Math.min(C.FIRE_MAX, cooker.fire + C.FIRE_ADD);
    decayAcc[cooker.id] = 0;
    refreshFireFlags(cooker);
  }

  function refreshFireFlags(cooker) {
    if (cooker.fire >= C.FIRE_LOW_WARN) cooker.lowWarned = false;
    if (cooker.fire > 0) cooker.outFired = false;
  }

  function verbAt() {
    if (state.phase !== 'service' || state.paused) {
      return { label: STRINGS.walk, enabled: false, auto: false, station: null };
    }
    if (state.player.busy !== null) {
      return { label: STRINGS.slicing, enabled: false, auto: false, station: reach() };
    }
    const a = resolveAction();
    return { label: a.label, enabled: a.enabled, auto: a.auto, station: a.station };
  }

  // Runs the action in reach. `autoOnly` true (tap arrival) skips button only rows.
  function performAction(autoOnly) {
    const a = resolveAction();
    if (!a.enabled) return { ok: false, verb: a.label, message: a.label };
    if (autoOnly && !a.auto) return { ok: false, verb: a.label, message: '' };
    a.run();
    return { ok: true, verb: a.label, message: '' };
  }

  function interact() {
    let r;
    if (state.phase !== 'service' || state.paused) r = { ok: false, verb: STRINGS.walk, message: STRINGS.walk };
    else if (state.player.busy !== null) r = { ok: false, verb: STRINGS.slicing, message: STRINGS.slicing };
    else r = performAction(false);
    checkTutorial();
    return r;
  }

  // ---- customers: arrival, movement, patience, seats ----------------------------------------

  function spawnInterval() {
    let interval = C.SPAWN_MAX - (C.SPAWN_MAX - C.SPAWN_MIN) * state.rep / 100;
    if (state.rain && !state.gear.canopy) interval = interval / C.RAIN_ARRIVALS;
    return interval;
  }

  function weightedPick(weights, r) {
    let total = 0;
    for (const m of MEAT_IDS) total += weights[m];
    if (total <= 0) return null;
    let acc2 = 0;
    const target = r * total;
    for (const m of MEAT_IDS) {
      acc2 += weights[m];
      if (weights[m] > 0 && target < acc2) return m;
    }
    for (let i = MEAT_IDS.length - 1; i >= 0; i--) if (weights[MEAT_IDS[i]] > 0) return MEAT_IDS[i];
    return null;
  }

  // 6.2 order roll. `rBranch` and `rWeight` are the two rng draws for this spawn. `mask` (W7.2,
  // W22.6) is a booked guest's tickets left per meat: a meat at 0 weighs 0, and a branch whose
  // weights are all 0 counts as empty. A walk-in passes no mask (v2, unchanged: a branch with any
  // entry always has a positive weight, so "any" and "sum above 0" agree).
  function rollOrder(rBranch, rWeight, mask) {
    const allow = (m) => mask === undefined || mask === null || mask[m] > 0;
    const tableW = zeroByMeat();
    for (const sp of state.stations.table.spots) {
      if (sp && sp.times.length > 0 && allow(sp.meat)) tableW[sp.meat] += sp.times.length;
    }
    const tableAny = sumValues(tableW) > 0;
    const cookW = zeroByMeat();
    for (const id of COOKER_IDS) {
      for (const p of state.stations[id].pieces) {
        if (p.state === 'burnt' || !allow(p.meat)) continue;
        cookW[p.meat] += 1;
      }
    }
    for (const st of state.stations.board.stacks) {
      if (st.times.length > 0 && allow(st.meat)) cookW[st.meat] += 1;
    }
    const sl = state.stations.board.slicing;
    if (sl && allow(sl.meat)) cookW[sl.meat] += 1;
    for (const w of state.stations.board.waiting) if (allow(w.meat)) cookW[w.meat] += 1;   // X18.1 item 39
    const cookAny = sumValues(cookW) > 0;
    if (tableAny) {
      if (rBranch < C.ORDER_FROM_TABLE || !cookAny) return weightedPick(tableW, rWeight);
      return weightedPick(cookW, rWeight);
    }
    if (cookAny) return weightedPick(cookW, rWeight);
    const stockW = zeroByMeat();
    for (const m of MEAT_IDS) {
      if (state.stock[m] > 0 && allow(m)) stockW[m] = state.stock[m] * MEATS[m].plates;
    }
    if (sumValues(stockW) > 0) return weightedPick(stockW, rWeight);
    // Hands: the last piece may be on its way to the board or the table.
    const handsW = zeroByMeat();
    for (const who of [state.player, state.buddy]) {
      const c = who ? who.carrying : null;
      if (c && (c.kind === 'raw' || c.kind === 'cooked' || c.kind === 'plates') && allow(c.meat)) handsW[c.meat] += 1;
    }
    if (sumValues(handsW) > 0) return weightedPick(handsW, rWeight);
    return null;
  }

  // A customer record at the spawn. Counts the arrival (custSeq, body, arrivals, today.customers).
  function newCustomer(want, patienceMax) {
    custSeq += 1;
    const body = state.arrivals % 4;
    state.arrivals += 1;
    state.today.customers += 1;
    return Object.assign(newMover(MAP.custSpawn.x, MAP.custSpawn.y, 'up'), {
      id: custSeq, body, want, patienceMax, patience: patienceMax, wait: 0,
      queueIndex: -1, mode: 'arriving', mood: 'neutral', reason: null, pause: 0, hop: 0,
      seat: null, eat: 0, eatMax: 0, bonusPaid: false, booked: false, runPlate: false
    });
  }

  function spawnCustomer() {
    const rJitter = rng();
    const rPatience = rng();
    const rBranch = rng();
    const rWeight = rng();
    const jitter = C.SPAWN_JITTER_LO + (C.SPAWN_JITTER_HI - C.SPAWN_JITTER_LO) * rJitter;
    state.spawnAt = state.clock + spawnInterval() * jitter;

    const order = rollOrder(rBranch, rWeight);
    const want = order || 'sausage';
    const patienceMax = C.PATIENCE_BASE + (rPatience * 2 - 1) * C.PATIENCE_SPREAD;
    const c = newCustomer(want, patienceMax);
    const inLine = state.customers.filter((o) => o.queueIndex >= 0).length;
    if (order === null || inLine >= queueSpotCount()) {
      // Nothing left to sell, or no room in line: look in from the gate and leave at no cost.
      c.mode = 'passing';
      setRoute(c, custRoute(c, MAP.passStop.x, MAP.passStop.y) || []);
      state.customers.push(c);
      state.today.past += 1;
      state.stats.past += 1;
      emit('walk_past', { id: c.id, reason: order === null ? 'soldout' : 'full' });
      return;
    }
    c.queueIndex = inLine;
    routeToSpot(c);
    state.customers.push(c);
    emit('customer_arrived', { id: c.id, meat: c.want });
  }

  // ---- W7.2 booked guests ---------------------------------------------------------------------

  // Built in loadUp() from rng: party sizes PARTY_MIN to PARTY_MAX until the headcount is
  // covered; party k of P arrives at gateAt + ARRIVAL_SPAN * window * ((k + 0.5) / P) ^ CURVE and
  // its members PARTY_GAP_S apart.
  function buildSchedule(b, gateAt) {
    schedule = [];
    schedParty = [];
    schedIdx = 0;
    const sizes = [];
    let left = b.headcount;
    while (left > 0) {
      const n = C.PARTY_MIN + Math.floor(rng() * (C.PARTY_MAX - C.PARTY_MIN + 1));
      const size = Math.max(1, Math.min(n, left));
      sizes.push(size);
      left -= size;
    }
    const P = sizes.length;
    for (let k = 0; k < P; k++) {
      const at = gateAt + C.ARRIVAL_SPAN * b.window * Math.pow((k + 0.5) / P, C.ARRIVAL_CURVE);
      for (let j = 0; j < sizes[k]; j++) { schedule.push(at + j * C.PARTY_GAP_S); schedParty.push(k); }
    }
  }

  // W22.6: when every branch is empty, the meat with the most tickets left (ties in MEAT_IDS order).
  function mostTickets() {
    let best = null;
    for (const m of MEAT_IDS) if (tickets[m] > 0 && (best === null || tickets[m] > tickets[best])) best = m;
    if (best !== null) return best;
    for (const m of MEAT_IDS) if (state.today.rail[m] > 0) return m;
    return 'sausage';
  }

  // One booked guest into the line. rng order: patience, order branch, order weight (no jitter).
  function spawnBookedGuest() {
    const t = state.today;
    const rPatience = rng();
    const rBranch = rng();
    const rWeight = rng();
    const patienceMax = t.booking.patience + (rPatience * 2 - 1) * C.PATIENCE_SPREAD;
    const want = rollOrder(rBranch, rWeight, tickets) || mostTickets();
    tickets[want] = Math.max(0, tickets[want] - 1);
    const c = newCustomer(want, patienceMax);
    c.booked = true;
    c.queueIndex = state.customers.filter((o) => o.queueIndex >= 0).length;
    routeToSpot(c);
    state.customers.push(c);
    t.pending -= 1;
    emit('customer_arrived', { id: c.id, meat: c.want });
  }

  // Stage 6 on a booking: every guest whose time has come joins, in schedule order, while the
  // line has a free spot. A guest who finds it full waits first in the schedule; nobody walks past.
  // Q-1: they keep joining until the hard end less LAST_CALL_GUARD, not only until last call.
  function tickBookedSpawns() {
    const t = state.today;
    if (t.pending <= 0 || state.clock + 1e-9 >= t.endAt - C.LAST_CALL_GUARD) return;
    // X5.10 and X18.1 item 38: after ARRIVAL_PULL_S with no booked guest arriving or waiting while
    // food is in progress, the next party arrives now.
    if (state.clock + 1e-9 >= t.gateAt) {
      const busy = state.customers.some((c) => c.booked === true && (c.mode === 'arriving' || c.mode === 'waiting'));
      pullT = busy ? 0 : pullT + C.TICK_SECONDS;
      if (!busy && pullT + 1e-9 >= C.ARRIVAL_PULL_S && foodInProgress()) {
        pullParty();
        pullT = 0;
      }
    }
    let free = queueSpotCount() - state.customers.filter((c) => c.queueIndex >= 0).length;
    while (free > 0 && t.pending > 0 && schedIdx < schedule.length && state.clock + 1e-9 >= schedule[schedIdx]) {
      schedIdx += 1;
      spawnBookedGuest();
      free -= 1;
    }
  }

  // X5.10: an active cooker piece not burnt, a board stack, a piece left for the PREP card, a slice,
  // or a plate on the table. Hands do not count (X18.1 item 38).
  function foodInProgress() {
    for (const id of COOKER_IDS) {
      if (!stationActive(STATION_BY_ID[id])) continue;
      if (state.stations[id].pieces.some((pc) => pc.state !== 'burnt')) return true;
    }
    const board = state.stations.board;
    if (board.stacks.length > 0 || board.waiting.length > 0 || board.slicing !== null) return true;
    return state.stations.table.spots.some((sp) => sp !== null && sp.times.length > 0);
  }

  // X5.10: the party starting at schedIdx moves to the clock, its members PARTY_GAP_S apart, when its
  // time is later than the clock. Later parties keep their times. No rng() draw.
  function pullParty() {
    if (schedIdx >= schedule.length || !(schedule[schedIdx] > state.clock + 1e-9)) return;
    const party = schedParty[schedIdx];
    for (let i = schedIdx, j = 0; i < schedule.length && schedParty[i] === party; i++, j++) schedule[i] = state.clock + j * C.PARTY_GAP_S;
  }

  // Q-6: booked guests whose arrival time has come who wait off canvas for a line spot.
  function gateWaiting() {
    const t = state.today;
    if (state.phase !== 'service' || !t || t.kind !== 'booking' || !(t.pending > 0)) return 0;
    let n = 0;
    for (let i = schedIdx; i < schedule.length && n < t.pending && state.clock + 1e-9 >= schedule[i]; i++) n += 1;
    return n;
  }

  // W7.3: guests still pending give up (the hard end, Q-1, or sold out: P-6 marks which for the report).
  function missPending(soldOutNow) {
    const t = state.today;
    if (t.pending > 0) {
      const n = t.pending;
      t.missed += n;
      t.pending = 0;
      if (soldOutNow === true) t.soldOutMiss = true;
      emit('guests_missed', { n });
    }
  }

  // Stage 2: customers walk. Eaters only count down their hop; everything else about them runs
  // in stage 5 (D8). Customers who reach the spawn on their way out are removed.
  function moveCustomers(dt) {
    const keep = [];
    for (const c of state.customers) {
      if (c.hop > 0) c.hop = Math.max(0, c.hop - dt);
      if (c.mode === 'eating') { keep.push(c); continue; }
      if (c.pause > 0) {
        c.pause = Math.max(0, c.pause - dt);
        c.walking = false;
        if (c.pause === 0 && c.mode === 'passing' && c.next === null && c.path.length === 0) {
          // Done looking in: back out through the gate.
          const out = custRoute(c, MAP.custSpawn.x, MAP.custSpawn.y);
          if (out === null || out.length === 0) continue;
          setRoute(c, out);
        }
        keep.push(c);
        continue;
      }
      const stepped = advanceMover(c, C.NPC_TILES_PER_S, dt);
      if (c.next === null && c.path.length === 0) {
        if (c.mode === 'arriving' || c.mode === 'waiting') {
          const spot = c.queueIndex >= 0 ? MAP.queue[c.queueIndex] : null;
          if (spot && c.x === spot.x && c.y === spot.y) {
            if (c.mode === 'arriving' || stepped) c.face = spot.face;
            c.mode = 'waiting';
          }
        } else if (c.mode === 'toSeat') {
          const s = SEAT_BY_ID[c.seat];
          if (s && c.x === s.x && c.y === s.y) {
            c.mode = 'eating';
            c.face = s.face;
            c.eat = c.eatMax;
            c.pause = 0;
          }
        } else if (c.mode === 'passing') {
          if (c.x === MAP.passStop.x && c.y === MAP.passStop.y) {
            c.pause = C.WALK_PAST_PAUSE;
            c.face = 'up';
          } else {
            continue;   // back at the spawn, out of the yard
          }
        } else if (c.mode === 'leaving') {
          continue;     // at the spawn (or no way out): out of the yard
        }
      }
      keep.push(c);
    }
    state.customers = keep;
  }

  // [V2.5] step 5: the seat tip, paid when eating ends or at the hard end.
  // X5.3 as amended by review 1 (contract X20.1): a plate the RUN card set down adds
  // round(2 * runSeatTip) coins to seatBonus() (0 at 3 stars and under, so v2's bonus there; 1 from
  // 4 stars), so the perk shows at every charm level. v2's bonus when no RUN card works.
  function payBonus(c, atClose) {
    const share = c.runPlate === true && state.buddy && state.buddy.vals ? state.buddy.vals.runSeatTip : null;
    const bonus = seatBonus() + (share === null ? 0 : Math.round(2 * share));
    if (share !== null) {
      const rec = state.today.crew[String(state.buddy.cardId)];
      if (rec) rec.tips += bonus;
    }
    state.cash += bonus;
    state.today.seatTips += bonus;
    state.today.seated += 1;
    state.stats.seated += 1;
    c.bonusPaid = true;
    const s = SEAT_BY_ID[c.seat];
    emit('seat_done', { id: c.id, seat: c.seat, bonus, x: s.x * TILE, y: s.y * TILE, atClose: atClose === true });
  }

  function freeSeat(c) {
    if (c.seat && state.seats[c.seat] === c.id) state.seats[c.seat] = null;
  }

  // Stage 5: serve checks, patience, walk-outs, then eating, the heart pause and standing up.
  function customersStage(dt) {
    serveLine();
    // [T 2.4] D: patience, wait and mood hold while the tutorial runs.
    const waiters = tutRunning() ? [] : waitingCustomers();
    for (const c of waiters) {
      c.wait += dt;
      c.patience -= dt;
      if (c.patience <= 0) {
        c.patience = 0;
        state.today.walkouts += 1;
        state.stats.walkouts += 1;
        leaveLine(c);
        sendOut(c, 'walkout', 'unhappy', true);
        emit('walk_out', { id: c.id });
      } else if (c.patience <= c.patienceMax * C.PATIENCE_WARN_FRAC && c.mood === 'neutral') {
        c.mood = 'unhappy';
      }
    }
    let gone = null;
    for (const c of state.customers) {
      if (c.mode !== 'eating') continue;
      if (c.eat > 0) {
        c.eat -= dt;
        if (c.eat <= 1e-9) {
          c.eat = 0;
          payBonus(c, false);
          c.pause = C.HEART_SECONDS;
        }
        continue;
      }
      c.pause -= dt;
      if (c.pause <= 1e-9) {
        c.pause = 0;
        freeSeat(c);
        sendOut(c, 'seated', 'happy', false);
        if (c.next === null && c.path.length === 0) {
          if (gone === null) gone = new Set();
          gone.add(c);   // no way out from the seat: removed on the spot
        }
      }
    }
    if (gone !== null) state.customers = state.customers.filter((c) => !gone.has(c));
  }

  function closeOutLine() {
    for (const c of lineCustomers()) {
      state.today.close += 1;
      leaveLine(c);
      sendOut(c, 'close', 'neutral', true);
      emit('left_at_close', { id: c.id });
    }
  }

  // Hard end, after the line closes out: pay every unpaid seat tip (atClose), then stand everyone
  // up so nobody is left in toSeat or eating (deviation 17).
  function closeOutSeats() {
    for (const c of state.customers) {
      if (c.mode !== 'toSeat' && c.mode !== 'eating') continue;
      if (!c.bonusPaid) payBonus(c, true);
      freeSeat(c);
      sendOut(c, 'seated', 'happy', false);
    }
  }

  function seatsBusy() {
    return state.customers.some((c) => c.mode === 'toSeat' || c.mode === 'eating');
  }

  // ---- 5.8 the buddy ([V2.4]) -----------------------------------------------------------------

  function buddyRouteTo(b, x, y) {
    return playerBfs(b.x, b.y, (tx, ty) => tx === x && ty === y);
  }

  // X5.3: the RUN card. v2's route and tasks, with runSpeed for the walk and runHandle for every
  // pause at the board and the table, read from the card's effective skills at load up.
  function tickBuddy(dt) {
    const b = state.buddy;
    if (!b) return;
    const speed = b.vals ? b.vals.runSpeed : C.NPC_TILES_PER_S;   // a mover without vals plays v2's 3 star numbers
    const handle = b.vals ? b.vals.runHandle : C.BUDDY_HANDLE;
    const boardUse = STATION_BY_ID.board.use[2];    // (5,5), facing up
    const tableUse = STATION_BY_ID.table.use[0];    // (6,5), facing down
    if (b.task === 'idle') {
      const stack = chooseBoardStack();
      if (stack && tableFits(stack.meat)) {
        const path = buddyRouteTo(b, boardUse.x, boardUse.y);
        if (path === null) return;   // cannot reach the board: stay idle
        buddyPick = stack.meat;
        b.task = 'pickup';
        b.path = path;
        b.t = handle;
        if (path.length === 0) b.face = boardUse.face;
      }
      return;
    }
    if (b.task === 'pickup') {
      if (b.next !== null || b.path.length > 0) {
        advanceMover(b, speed, dt);
        if (b.next === null && b.path.length === 0) {
          b.face = boardUse.face;
          b.t = handle;   // the handle runs only after he arrives
        }
        return;
      }
      b.t -= dt;
      if (b.t > 1e-9) return;
      b.t = 0;
      const stack = buddyPick ? boardStackOf(buddyPick) : null;
      buddyPick = null;
      if (!stack || stack.times.length === 0) {
        b.path = buddyRouteTo(b, MAP.buddyIdle.x, MAP.buddyIdle.y) || [];
        b.task = 'return';
        return;
      }
      const times = takeFromBoardStack(stack, 1);
      b.carrying = { kind: 'plates', meat: stack.meat, times };
      const path = buddyRouteTo(b, tableUse.x, tableUse.y);
      if (path === null) {
        // Cannot reach the counter: put the plate back and go home.
        addToBoard(b.carrying.meat, b.carrying.times);
        b.carrying = null;
        b.path = buddyRouteTo(b, MAP.buddyIdle.x, MAP.buddyIdle.y) || [];
        b.task = 'return';
        return;
      }
      b.path = path;
      b.task = 'carry';
      if (path.length === 0) { b.face = tableUse.face; b.task = 'wait'; b.t = 0; }
      return;
    }
    if (b.task === 'carry') {
      advanceMover(b, speed, dt);
      if (b.next === null && b.path.length === 0) {
        b.face = tableUse.face;
        b.task = 'wait';
        b.t = 0;
      }
      return;
    }
    if (b.task === 'wait') {
      if (b.carrying) {
        if (!tableFits(b.carrying.meat)) return;
        const meat = b.carrying.meat;
        const n = setDown(b.carrying, true);
        if (n > 0) emit('set_down', { meat, n });
        const rec = state.today.crew[String(b.cardId)];
        if (rec) rec.plates += n;
        if (b.carrying.times.length === 0) b.carrying = null;
        b.t = handle;
        return;
      }
      b.t -= dt;
      if (b.t > 1e-9) return;
      b.path = buddyRouteTo(b, MAP.buddyIdle.x, MAP.buddyIdle.y) || [];
      b.task = 'return';
      return;
    }
    if (b.task === 'return') {
      advanceMover(b, speed, dt);
      if (b.next === null && b.path.length === 0) {
        b.face = MAP.buddyIdle.face;
        b.task = 'idle';
        b.t = 0;
      }
    }
  }

  // ---- 5.9 the fire tender ------------------------------------------------------------------

  // X5.3: the threshold is the FIRE card's fireSense (v2's TENDER_THRESHOLD at 3 stars).
  function cookerNeedingFire(threshold) {
    let best = null;
    for (const id of COOKER_IDS) {
      const st = STATION_BY_ID[id];
      if (!stationActive(st)) continue;
      const ck = state.stations[id];
      if (ck.fire < threshold && (best === null || ck.fire < best.fire)) best = ck;
    }
    return best;
  }

  // Review 1 (contract X20.2, overrides X18.1 item 40): the FIRE card walks at
  // NPC_TILES_PER_S * TENDER_CYCLE / firePace, clamped to FIRE_WALK (v2's 4 tiles a second at 3 stars),
  // so Pace shows in the yard too. Its grab and add pauses stay v2's.
  function tenderSpeed(t) {
    if (!t.vals) return C.NPC_TILES_PER_S;
    return clamp(C.NPC_TILES_PER_S * C.TENDER_CYCLE / t.vals.firePace, C.FIRE_WALK[0], C.FIRE_WALK[1]);
  }

  // X5.3: a bag the FIRE card adds counts on its crew row.
  function tenderAdd(t) {
    addCharcoal(state.stations[t.cooker]);
    const rec = state.today.crew[String(t.cardId)];
    if (rec) rec.bags += 1;
  }

  function tickTender(dt) {
    const t = state.tender;
    if (!t) return;
    if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.task === 'idle') {
      if (t.cooldown > 0 || state.charcoal <= 0) return;
      const ck = cookerNeedingFire(t.vals ? t.vals.fireSense : C.TENDER_THRESHOLD);
      if (!ck) return;
      state.charcoal -= 1;
      state.today.bags += 1;
      t.carrying = { kind: 'charcoal' };
      t.cooker = ck.id;
      t.cooldown = t.vals ? t.vals.firePace : C.TENDER_CYCLE;
      t.task = 'grab';
      t.t = C.BUDDY_HANDLE;
      return;
    }
    if (t.task === 'grab') {
      t.t -= dt;
      if (t.t > 0) return;
      const st = STATION_BY_ID[t.cooker];
      const uses = activeUseTiles(st);
      const path = playerBfs(t.x, t.y, (x, y) => uses.some((u) => u.x === x && u.y === y));
      if (path === null) {
        tenderAdd(t);
        t.carrying = null;
        t.cooker = null;
        t.task = 'idle';
        return;
      }
      t.path = path;
      t.task = 'walk';
      return;
    }
    if (t.task === 'walk') {
      advanceMover(t, tenderSpeed(t), dt);
      if (t.next === null && t.path.length === 0) {
        const st = STATION_BY_ID[t.cooker];
        const u = activeUseTiles(st).find((e) => e.x === t.x && e.y === t.y);
        if (u) t.face = u.face;
        t.task = 'add';
        t.t = C.BUDDY_HANDLE;
      }
      return;
    }
    if (t.task === 'add') {
      t.t -= dt;
      if (t.t > 0) return;
      if (t.cooker) tenderAdd(t);
      t.carrying = null;
      t.cooker = null;
      const home = MAP.tenderIdle;
      t.path = playerBfs(t.x, t.y, (x, y) => x === home.x && y === home.y) || [];
      t.task = 'return';
      return;
    }
    if (t.task === 'return') {
      advanceMover(t, tenderSpeed(t), dt);
      if (t.next === null && t.path.length === 0) {
        t.face = MAP.tenderIdle.face;
        t.task = 'idle';
        t.t = 0;
      }
    }
  }

  // ---- X5.3 the PREP card ---------------------------------------------------------------------

  // Plates of the pieces of this meat already left on the board for the PREP card.
  function waitingPlates(meat) {
    let n = 0;
    for (const w of state.stations.board.waiting) if (w.meat === meat) n += MEATS[meat].plates;
    return n;
  }

  function prepName() {
    const card = state.prep ? findCard(state.prep.cardId) : null;
    return card ? card.name : STRINGS.roleName.prep;
  }

  // Slices the pieces left on the board, one at a time, at MAP.prepUse; walks at prepPace and cuts in
  // MEATS[m].slice * prepKnife. Draws nothing from rng().
  function tickPrep(dt) {
    const pr = state.prep;
    if (!pr) return;
    const board = state.stations.board;
    const use = MAP.prepUse;
    const home = MAP.prepIdle;
    const speed = pr.vals ? pr.vals.prepPace : C.NPC_TILES_PER_S;
    const firstFits = () => board.waiting.length > 0 && board.slicing === null
      && boardFits(board.waiting[0].meat, MEATS[board.waiting[0].meat].plates);
    if (pr.task === 'idle') {
      if (!firstFits()) return;
      const path = playerBfs(pr.x, pr.y, (x, y) => x === use.x && y === use.y);
      if (path === null) return;   // cannot reach the board: stay home
      pr.path = path;
      pr.task = 'walk';
      if (path.length === 0) { pr.face = use.face; pr.task = 'wait'; }
      return;
    }
    if (pr.task === 'walk') {
      advanceMover(pr, speed, dt);
      if (pr.next === null && pr.path.length === 0) { pr.face = use.face; pr.task = 'wait'; }
      return;
    }
    if (pr.task === 'wait') {
      if (board.waiting.length === 0) {
        pr.path = playerBfs(pr.x, pr.y, (x, y) => x === home.x && y === home.y) || [];
        pr.task = 'return';
        return;
      }
      if (!firstFits()) return;
      const w = board.waiting.shift();
      const m = MEATS[w.meat];
      board.slicing = { meat: m.id, t: 0, total: m.slice * (pr.vals ? pr.vals.prepKnife : 1), who: 'prep' };
      pr.task = 'slice';
      return;
    }
    if (pr.task === 'slice') {
      const sl = board.slicing;
      if (sl === null || sl.who !== 'prep') { pr.task = 'wait'; return; }
      sl.t += dt;
      if (sl.t + 1e-9 < sl.total) return;
      const m = MEATS[sl.meat];
      const times = [];
      for (let i = 0; i < m.plates; i++) times.push(state.clock);
      addToBoard(m.id, times);
      board.slicing = null;
      emit('slice_done', { meat: m.id, plates: m.plates, by: 'prep' });
      const rec = state.today.crew[String(pr.cardId)];
      // Review 1: the time saved counts the knife: your own slice time freed plus what the card's
      // knife gains on you (2 - prepKnife times MEATS[m].slice; 1 times at 3 stars).
      if (rec) { rec.cuts += 1; rec.savedS += m.slice * (2 - (pr.vals ? pr.vals.prepKnife : 1)); }
      pr.task = 'wait';
      return;
    }
    if (pr.task === 'return') {
      advanceMover(pr, speed, dt);
      if (pr.next === null && pr.path.length === 0) {
        pr.face = home.face;
        pr.task = 'idle';
        pr.t = 0;
      }
    }
  }

  // ---- 2.5.3 fixed step and the six stages --------------------------------------------------

  function tickPlayer(dt) {
    const p = state.player;
    if (p.busy !== null) {
      p.busy.t += dt;
      const bsl = state.stations.board.slicing;
      if (bsl && bsl.who === 'player') bsl.t = p.busy.t;
      if (p.busy.t >= p.busy.total - 1e-9) {
        const m = MEATS[p.busy.meat];
        const times = [];
        for (let i = 0; i < m.plates; i++) times.push(state.clock);
        addToBoard(m.id, times);
        emit('slice_done', { meat: m.id, plates: m.plates, by: 'player' });
        p.busy = null;
        state.stations.board.slicing = null;
        // The first plate comes off the board into the free hands; the rest stay stacked.
        if (p.carrying === null) {
          const stack = chooseBoardStack();
          if (stack) {
            const cap = state.gear.tray ? C.TRAY_PLATES : 1;
            const n = Math.min(cap, stack.times.length);
            p.carrying = { kind: 'plates', meat: stack.meat, times: takeFromBoardStack(stack, n) };
          }
        }
        if (p.queued) {
          const q = p.queued;
          p.queued = null;
          walkTo(q.tx, q.ty);
        }
      }
      return;
    }
    const hadStep = p.next !== null || p.path.length > 0;
    if (hadStep) advanceMover(p, C.WALK_TILES_PER_S, dt);
    if (p.next === null && p.path.length === 0 && p.target !== null) {
      const st = STATION_BY_ID[p.target.station];
      const autoOnly = p.target.auto;
      p.target = null;
      if (st && stationActive(st)) {
        faceTarget(st);
        performAction(autoOnly);
      }
    }
  }

  function tickFire(dt) {
    for (const id of COOKER_IDS) {
      const ck = state.stations[id];
      if (!stationActive(STATION_BY_ID[id])) { ck.fire = 0; continue; }
      refreshFireFlags(ck);
      if (ck.fire <= 0) { decayAcc[id] = 0; continue; }
      // Decay lands once per whole second of the cooker's own timer, which a bag resets, so a
      // fresh light reads exactly FIRE_LIGHT for a full second. Same average rate as continuous.
      decayAcc[id] += dt;
      while (decayAcc[id] + 1e-9 >= 1) {
        decayAcc[id] -= 1;
        const before = ck.fire;
        ck.fire = Math.max(0, ck.fire - STATION_BY_ID[id].decay);
        // [T 2.4] G: a lit cooker never decays below the floor while the tutorial runs.
        if (tutRunning() && before >= C.TUTORIAL_FIRE_FLOOR && ck.fire < C.TUTORIAL_FIRE_FLOOR) ck.fire = C.TUTORIAL_FIRE_FLOOR;
      }
      if (!ck.lowWarned && ck.fire < C.FIRE_LOW_WARN) {
        ck.lowWarned = true;
        emit('fire_low', { cooker: id });
      }
      if (!ck.outFired && ck.fire <= 0) {
        ck.outFired = true;
        emit('fire_out', { cooker: id });
      }
    }
  }

  function tickPieces(dt) {
    for (const id of COOKER_IDS) {
      const ck = state.stations[id];
      if (ck.pieces.length === 0) continue;
      const mult = fireMult(ck.fire);
      if (mult <= 0) continue;
      const doneRate = burnMult(ck.fire);
      const hold = tutRunning();
      for (const pc of ck.pieces) {
        if (pc.state === 'burnt') continue;
        const m = MEATS[pc.meat];
        if (pc.state === 'done') {
          if (hold) continue;   // [T 2.4] E: a done piece holds at done while the tutorial runs
          pc.prog += doneRate * dt;
        } else {
          pc.prog += mult * dt;   // the tick that crosses cook runs at fireMult for the whole tick
        }
        if (pc.state === 'cooking' && pc.prog >= m.cook) {
          pc.state = 'done';
          emit('piece_done', { cooker: id, meat: pc.meat });
        }
        // [T 3.3]: the warning stage is the last WARN_FRAC of the window, announced once a piece.
        if (pc.state === 'done' && pc.warn !== true && pc.prog >= m.cook + m.window * (1 - C.WARN_FRAC)) {
          pc.warn = true;
          emit('burn_warning', { station: id, slot: pc.slot, meat: pc.meat });
        }
        if (pc.state === 'done' && pc.prog >= m.cook + m.window) {
          pc.state = 'burnt';
          pc.burntAt = state.clock;
          state.today.burnt += 1;
          state.stats.burnt += 1;
          if (state.today.addon !== null && pc.meat === state.today.addon) state.today.addonBurnt += 1;
          emit('piece_burnt', { cooker: id, meat: pc.meat });
        }
      }
    }
  }

  // W7.1: the three times come from today (the tutorial day keeps the v2.1 values).
  function tickClockEvents() {
    const clock = state.clock;
    const t = state.today;
    if (!state.gateSoonFired && clock >= t.gateAt - 10) {
      state.gateSoonFired = true;
      emit('gate_soon');
    }
    if (!gateOpenFired && clock >= t.gateAt) {
      gateOpenFired = true;
      emit('gate_open');
      if (state.loop === 'prep') state.loop = 'cook';
    }
    if (!state.lastCallFired && clock >= t.lastCallAt) {
      state.lastCallFired = true;
      state.spawnAt = Infinity;
      emit('last_call');
    }
  }

  function tickSpawns() {
    const t = state.today;
    if (t.kind === 'booking') { tickBookedSpawns(); return; }
    if (state.clock >= t.lastCallAt) { state.spawnAt = Infinity; return; }
    if (state.clock + 1e-9 >= state.spawnAt) spawnCustomer();
  }

  // Nothing left to sell anywhere: cooler, grates, board, table and hands. Charcoal and burnt
  // pieces are not sellable, so they do not hold the day open.
  function soldOut() {
    if (totalStock() > 0) return false;
    for (const id of COOKER_IDS) {
      if (!stationActive(STATION_BY_ID[id])) continue;
      if (state.stations[id].pieces.some((pc) => pc.state !== 'burnt')) return false;
    }
    const board = state.stations.board;
    if (board.stacks.length > 0 || board.slicing !== null || board.waiting.length > 0) return false;   // X5.3
    for (const sp of state.stations.table.spots) if (sp !== null) return false;
    const pc = state.player.carrying;
    if (pc !== null && pc.kind !== 'charcoal' && pc.kind !== 'burnt') return false;
    if (state.buddy && state.buddy.carrying) return false;
    return true;
  }

  // The early end ([V2.5] step 9): sold out, or after last call with nobody in line, and in both
  // cases nobody walking to a seat or eating. A booking (W7.3) ends early once nobody is pending
  // and no customer is arriving, waiting, walking to a seat or eating.
  function dayShouldEnd() {
    const t = state.today;
    if (state.clock + 1e-9 >= t.endAt) return true;
    if (t.kind === 'booking') {
      if (state.clock + 1e-9 < t.gateAt || t.pending > 0) return false;
      return !state.customers.some((c) => c.mode === 'arriving' || c.mode === 'waiting' || c.mode === 'toSeat' || c.mode === 'eating');
    }
    if (state.clock + 1e-9 >= t.gateAt && soldOut()) return !seatsBusy();
    if (state.clock + 1e-9 >= t.lastCallAt) {
      return !state.customers.some((c) => c.mode === 'arriving' || c.mode === 'waiting') && !seatsBusy();
    }
    return false;
  }

  function tick() {
    if (state.phase !== 'service' || state.paused) return;
    tickStages();
    checkTutorial();
  }

  function tickStages() {
    const dt = C.TICK_SECONDS;
    const t = state.today;
    // [T 2.4] A: the yard clock holds at its value until the first plate lands.
    if (!tutClockHeld()) {
      tickCount += 1;
      state.clock = tickCount * C.TICK_SECONDS;
    }
    tickClockEvents();
    tickPlayer(dt);
    tickBuddy(dt);
    tickTender(dt);
    tickPrep(dt);
    moveCustomers(dt);
    tickFire(dt);
    // X18.1 item 37: the fire sampled once a tick after tickFire, from the gate on.
    if (state.clock + 1e-9 >= t.gateAt) {
      fireSampled = true;
      for (const id of COOKER_IDS) {
        if (state.stations[id].fire >= C.FIRE_GOOD) t.fireGoodS[id] += dt;
        else t.fireDipped[id] = true;
        if (state.stations[id].fire >= C.FIRE_HOT) t.fireHotS[id] += dt;   // review 1: the hot band, for the FIRE line
      }
    }
    tickPieces(dt);
    customersStage(dt);
    if (state.clock + 1e-9 >= t.endAt) {
      if (t.kind === 'booking') missPending();   // Q-1: the guests still waiting give up at the hard end
      closeOutLine();
      closeOutSeats();
      endDay();
      return;
    }
    if (state.clock + 1e-9 >= t.gateAt && soldOut()) {
      // Sold out stays sold out: close the line and stop arrivals while the eaters finish.
      closeOutLine();
      state.spawnAt = Infinity;
      if (t.kind === 'booking') missPending(true);
    }
    tickSpawns();
    if (dayShouldEnd()) {
      closeOutLine();
      endDay();
    }
  }

  function step(dt) {
    if (state.phase !== 'service' || state.paused) return;
    let d = Number(dt);
    if (!Number.isFinite(d) || d < 0) d = 0;
    if (d > C.MAX_FRAME_DT) d = C.MAX_FRAME_DT;
    acc += d;
    while (acc + 1e-9 >= C.TICK_SECONDS) {
      acc -= C.TICK_SECONDS;
      tick();
      if (state.phase !== 'service' || state.paused) { acc = 0; break; }
    }
  }

  // ---- 2.7.5 day end ------------------------------------------------------------------------

  // The end of any event (W7.3). `forced` (settle(), W8.4) is { score, stars, parts, avgWait } in
  // place of scoreEvent() for a booking.
  function endDay(forced) {
    // [T 2.4] H: the till never runs with the tutorial still running.
    if (tutRunning()) finishTutorial(false);
    const t = state.today;
    const s = state.season;
    const played = state.day;
    const isBooking = t.kind === 'booking' && t.booking !== null;
    for (const id of COOKER_IDS) {
      for (const pc of state.stations[id].pieces) {
        t.grateLeft[pc.meat] += 1;
        t.grateCost += MEATS[pc.meat].unit;
      }
    }
    for (const st of state.stations.board.stacks) {
      t.wastePlates += st.times.length;
      t.wasteCost += plateWaste(st.meat) * st.times.length;
    }
    for (const sp of state.stations.table.spots) {
      if (!sp) continue;
      t.wastePlates += sp.times.length;
      t.wasteCost += plateWaste(sp.meat) * sp.times.length;
    }
    // X5.3: pieces left for the PREP card and a PREP slice in progress are thrown out.
    const brd = state.stations.board;
    for (const w of brd.waiting) { t.wastePlates += MEATS[w.meat].plates; t.wasteCost += MEATS[w.meat].unit; }
    if (brd.slicing !== null && brd.slicing.who === 'prep') { t.wastePlates += MEATS[brd.slicing.meat].plates; t.wasteCost += MEATS[brd.slicing.meat].unit; }
    // X5.4: wages for every lineup card, booking or Yard day.
    t.wages = 0;
    for (const c of state.crew) if (inLineupToday(c)) t.wages += c.wage;
    const maxToday = repMax();
    let rawDelta;
    let net;
    let sc = null;
    let stars = 0;
    let fee = 0;
    let payRest = 0;
    let menuBonus = 0;
    if (isBooking) {
      if (t.pending > 0) { t.missed += t.pending; t.pending = 0; }
      // W8.1, W8.2, W9: client stars, the rest of the fee, the Menu bonus, word of mouth by stars.
      sc = forced || scoreEvent({ booked: t.booked, fed: t.fed, waitSum: t.waitSum, burnt: t.burnt, offMenu: t.offMenu, cold: t.cold, prepBonus: t.prepBonus });
      stars = sc.stars;
      fee = t.booking.pay;
      payRest = Math.max(0, Math.round(fee * (C.PAY_BASE + C.PAY_PER_STAR * stars)) - t.deposit);
      menuBonus = (t.addon !== null && t.addonServed >= 1 && t.addonBurnt === 0) ? Math.round(fee * C.MENU_BONUS) : 0;
      state.cash += payRest + menuBonus;
      rawDelta = C.STAR_FANS[stars - 1];
      net = t.deposit + payRest + menuBonus + t.tips + t.seatTips - t.wages - C.DAILY_COSTS;   // P-3 takes the meat, charcoal and spoilage off below
    } else {
      rawDelta = t.happy * C.REP_QUICK + t.togoQuick * C.REP_TOGO_QUICK + t.ok * C.REP_OK
        + t.walkouts * C.REP_WALKOUT + t.close * C.CLOSE_PENALTY;
      net = t.revenue + t.tips + t.seatTips - t.wages - C.DAILY_COSTS;
    }
    const repDelta = clamp(rawDelta, C.REP_DAY_MIN, maxToday);
    const repCapped = repDelta !== rawDelta;
    const repEnd = clamp(state.rep + repDelta, 0, 100);
    state.rep = repEnd;
    state.cash = Math.max(C.CASH_FLOOR, state.cash - t.wages - C.DAILY_COSTS);
    // W10.4: the cooler keeps up to its capacity overnight, costliest units first; the rest spoils.
    const cap = coolerCap();
    let spoiledUnits = 0;
    if (totalStock() > cap) {
      let room = cap;
      for (const m of KEEP_ORDER) {
        const keep = Math.min(state.stock[m], room);
        room -= keep;
        const gone = state.stock[m] - keep;
        if (gone > 0) {
          t.spoiled[m] += gone;
          t.spoilCost += gone * MEATS[m].unit;
          state.stock[m] = keep;
          spoiledUnits += gone;
        }
      }
    }
    const spoilReason = spoiledUnits === 0 ? 'none' : (cap === 0 ? 'nocooler' : 'full');
    // X5.5 to X5.8: XP, mood, notice and moving on, from the moods as they stood at the end.
    const crewOut = t.kind === 'tutorial' ? { rows: [], left: [], changes: [], levels: [], notices: [] }
      : crewAfterEvent(isBooking, stars, forced !== undefined);
    // P-3: a booking's take is what the cook made after what it used, so the report's rows add up.
    if (isBooking) net -= t.foodCost + t.rawWaste + t.bags * C.CHARCOAL_PRICE + t.spoilCost;
    state.day += 1;
    state.stats.days += 1;
    state.yesterday = { served: t.served, walkouts: t.walkouts, past: t.past };
    if (isBooking) s.results.push({ type: t.booking.type, stars });   // D4.3: a Yard day never writes a result
    const till = {};
    for (const k of Object.keys(t)) {
      const v = t[k];
      till[k] = (v && typeof v === 'object') ? (Array.isArray(v) ? v.slice() : Object.assign({}, v)) : v;
    }
    till.day = played;
    till.repEnd = repEnd;
    till.repDelta = repDelta;
    till.repCapped = repCapped;
    till.repMax = maxToday;
    till.net = net;
    till.cashAfter = state.cash;
    // W4.2 additions
    till.kind = t.kind;
    till.label = isBooking ? t.booking.label : STRINGS.booking.yard;
    till.host = isBooking ? t.booking.host : null;
    till.year = s.year;
    till.week = s.week;
    till.booked = t.booked;
    till.fed = t.fed;
    till.missed = t.missed;
    till.avgWait = sc ? sc.avgWait : 0;
    till.score = sc ? sc.score : 0;
    till.parts = sc ? { fed: sc.parts.fed, wait: sc.parts.wait, quality: sc.parts.quality } : { fed: 0, wait: 0, quality: 0 };
    till.stars = stars;
    till.fee = fee;
    till.deposit = t.deposit;
    till.payRest = payRest;
    till.menuBonus = menuBonus;
    till.repReason = isBooking ? 'stars' : 'serves';
    till.coolerCap = cap;
    till.coolerAfter = Object.assign({}, state.stock);
    till.charcoalAfter = state.charcoal;
    till.spoilReason = spoilReason;
    // R-4: what the shop took that morning besides the cart, and the cash the morning opened with.
    till.gearSpent = morningBuys.reduce((a, b) => a + b.price, 0);
    till.gearBought = morningBuys.map((b) => b.label);
    till.cashStart = morningCash;   // v3.2: the cash this day opened with (quick days move cash mid week)
    // X4.4: the crew rows, who moved on, signing fees and send-offs, and the fan thirds.
    till.crew = crewOut.rows;
    till.left = crewOut.left.map((c) => ({ id: c.id, name: c.name }));
    till.crewSpent = crewSpend.reduce((a, b) => a + b.amount, 0);
    till.crewPaid = crewSpend.map((b) => b.name);
    till.third = t.third;
    till.thirdTo = fanThird();
    state.till = till;
    state.seats = emptySeats();
    state.phase = 'evening';
    state.player.busy = null;
    state.stations.board.slicing = null;
    if (t.kind !== 'tutorial') state.loop = 'report';
    if (isBooking) {
      emit('client_stars', { stars, score: sc.score, fed: t.fed, booked: t.booked,
        pay: Math.round(fee * (C.PAY_BASE + C.PAY_PER_STAR * stars)), bonus: menuBonus });
    }
    if (spoiledUnits > 0) emit('spoiled', { units: spoiledUnits, meat: Object.assign({}, t.spoiled) });
    // X9: crew_mood, level_ready (lineup id order), crew_notice, crew_left, then day_over.
    if (crewOut.changes.length > 0) emit('crew_mood', { changes: crewOut.changes });
    for (const e of crewOut.levels) emit('level_ready', e);
    for (const e of crewOut.notices) emit('crew_notice', e);
    for (const c of crewOut.left) emit('crew_left', { id: c.id, name: c.name });
    emit('day_over');
    emit('save_wanted', { reason: 'till' });
  }

  // ---- morning ------------------------------------------------------------------------------

  // The Broke test. In the week the largest deposit on offer counts as cash (W6, W22.4).
  function brokeTest() {
    const units = totalStock();
    const cheapest = cheapestUnit();
    let cash = state.cash;
    if (state.loop === 'week') {
      let d = 0;
      for (const o of state.season.offers) d = Math.max(d, o.deposit);
      cash += d;
    }
    return (state.charcoal === 0 && cash < C.CHARCOAL_PRICE)
      || (units === 0 && cash < cheapest + (state.charcoal === 0 ? C.CHARCOAL_PRICE : 0));
  }

  function updateComingNext(fromMorning) {
    // Q-8: no Coming next card while the Driveway cannot be bought (v3.3 flips C.DRIVEWAY_BUYABLE).
    const show = C.DRIVEWAY_BUYABLE === true && state.gear.drum === true && state.rep >= C.DRIVEWAY_REP && state.cash >= C.DRIVEWAY_PRICE;
    if (fromMorning) state.comingNext = show;
    else if (show) state.comingNext = true;
    if (show && !state.drivewayShown) {
      state.drivewayShown = true;
      emit('coming_next');
    }
  }

  // The morning's yard reset, without the rain roll.
  function clearYard() {
    state.phase = 'morning';
    state.paused = false;
    state.buddy = null;
    state.tender = null;
    state.prep = null;
    state.customers = [];
    state.seats = emptySeats();
    state.player.busy = null;
    state.player.target = null;
    state.player.queued = null;
    state.player.path = [];
    state.player.next = null;
    state.player.walking = false;
    state.stations.board.slicing = null;
  }

  // `nextLoop` is the loop this morning opens into: 'tutorial', 'creator' or 'week'. The rain roll
  // always draws (rng order unchanged); the Broke test runs here only for the tutorial (W22.4,
  // deviation 34), and startWeek() runs it with the deposit.
  function beginMorning(nextLoop) {
    clearYard();
    morningBuys = [];
    crewSpend = [];
    morningCash = state.cash;
    const roll = rng();
    const raining = state.day >= C.RAIN_FROM_DAY && roll < C.RAIN_CHANCE;
    state.rain = raining;
    if (state.day >= C.RAIN_FROM_DAY) emit('rain', { raining });
    if (nextLoop === 'week' || nextLoop === 'creator' || nextLoop === 'hiring') {   // X8: not on Hiring Day either
      state.broke = false;
    } else {
      state.broke = brokeTest();
      if (state.broke) emit('broke');
    }
    state.cart = { meat: zeroByMeat(), charcoal: 0 };
    if (state.day === 1 && totalStock() === 0 && state.charcoal === 0) {
      // A first morning starts with a sensible cart (34 of the 80) instead of a row of zeros.
      state.cart = { meat: Object.assign(zeroByMeat(), { sausage: 3, chicken: 2 }), charcoal: 5 };
    }
    state.selected = quickestInStock(state.stock) || 'sausage';
    updateComingNext(true);
  }

  // About how many people today's rep and weather bring between the gate and last call: the
  // event length setting's window (W5.2), the v2.1 window on the tutorial day.
  function expectedCrowd() {
    const win = state.loop === 'tutorial' ? (C.LAST_CALL - C.GATE_OPENS) : lengthRow(state.settings.length).window;
    return Math.round(win / spawnInterval());
  }

  // ---- shop ---------------------------------------------------------------------------------

  // D4.2: meat and charcoal at today's price in the week, gear and decor at list.
  function dayMult() {
    return state.loop === 'week' ? C.DAY_PRICE[state.season.day] : 1;
  }

  function lineCost(id, qty) {
    return qty > 0 ? Math.round(qty * CATALOG_BY_ID[id].price * dayMult()) : 0;
  }

  // The most of row `id` that `budget` pays for at today's price.
  function affordQty(id, budget) {
    if (budget < 0) return 0;
    let q = Math.floor(budget / (CATALOG_BY_ID[id].price * dayMult()));
    while (lineCost(id, q + 1) <= budget) q += 1;
    while (q > 0 && lineCost(id, q) > budget) q -= 1;
    return q;
  }

  function cartTotal() {
    let total = lineCost('charcoal', state.cart.charcoal);
    for (const m of MEAT_IDS) total += lineCost(m, state.cart.meat[m]);
    return total;
  }

  function morningOpen() {
    return state.phase === 'morning' && state.broke === false;
  }

  function coolerFullMessage() {
    const cap = coolerCap();
    return cap === 0 ? STRINGS.ui.coolerFullNone : STRINGS.ui.coolerFull.replace('{cap}', String(cap));   // R-8
  }

  // W5.2: the morning shop of the tutorial and the week. Meat and charcoal may spend the picked
  // offer's deposit too; charcoal caps at CHARCOAL_MAX in the pile; meat also stops at meatRoom().
  function buy(id, qty) {
    const rowDef = CATALOG_BY_ID[id];
    if (!rowDef || typeof id !== 'string') return { ok: false, message: '' };
    if (state.loop !== 'tutorial' && state.loop !== 'week') return { ok: false, message: '' };
    if (!morningOpen()) return { ok: false, message: '' };
    if (rowDef.kind === 'meat' || rowDef.kind === 'fuel') {
      const isMeat = rowDef.kind === 'meat';
      if (isMeat && MEATS[id].drumOnly && !state.gear.drum) return { ok: false, message: rowDef.needsText };
      const q = Math.trunc(Number(qty));
      if (!Number.isFinite(q) || q === 0) return { ok: false, message: '' };
      const cur = isMeat ? state.cart.meat[id] : state.cart.charcoal;
      const lineMax = isMeat ? Math.max(0, C.STEPPER_MAX - state.stock[id]) : Math.max(0, C.CHARCOAL_MAX - state.charcoal);
      let next = clamp(cur + q, 0, lineMax);
      let roomCut = false;
      if (isMeat && next > cur) {
        const lim = cur + meatRoom();
        if (next > lim) { next = Math.max(cur, lim); roomCut = true; }
      }
      const b = state.loop === 'week' ? state.season.booking : null;
      const deposit = b !== null ? b.deposit : 0;
      const others = cartTotal() - lineCost(id, cur);
      const affordable = affordQty(id, state.cash + deposit - others);
      if (next > cur) next = Math.min(next, Math.max(cur, affordable));
      if (next === cur) {
        let message = '';
        if (q > 0) {
          if (roomCut) message = coolerFullMessage();
          else if (cur + q > affordable) message = 'Not enough cash';
        }
        return { ok: false, message };
      }
      if (isMeat) state.cart.meat[id] = next; else state.cart.charcoal = next;
      return { ok: true, message: roomCut && next > cur ? coolerFullMessage() : '' };
    }
    if (rowDef.kind === 'gear' || rowDef.kind === 'decor') {
      const chk = canBuy(id);
      if (!chk.ok) return { ok: false, message: chk.message };
      state.cash -= rowDef.price;
      morningBuys.push({ id, label: rowDef.label, price: rowDef.price });
      if (rowDef.kind === 'gear') {
        state.gear[id] = true;
        reconfigureYard();
        emit('purchase', { id, label: rowDef.label, price: rowDef.price, kind: 'gear' });
        emit('save_wanted', { reason: 'gear' });
        updateComingNext(false);
        if (state.loop === 'week') regenOffers(false, true);   // W22.11; review 1: the shown cards keep their sizes
      } else {
        state.decor[id] = true;
        emit('purchase', { id, label: rowDef.label, price: rowDef.price, kind: 'decor' });
        emit('save_wanted', { reason: 'decor' });
      }
      return { ok: true, message: 'Bought ' + rowDef.label + '.' };
    }
    if (rowDef.kind === 'goal') return { ok: false, message: 'Not built yet.' };
    return { ok: false, message: '' };
  }

  // R-1 (the P-4 rule as a pure check): can a gear or decor row be bought now? In the week the
  // picked offer's deposit counts toward the cart, never toward the price itself: price <= cash and
  // cash + deposit - cart >= price. `left` is what that leaves for the cart's day, deposit counted.
  function canBuy(id) {
    const rowDef = typeof id === 'string' ? CATALOG_BY_ID[id] : undefined;
    if (!rowDef || (rowDef.kind !== 'gear' && rowDef.kind !== 'decor')) return { ok: false, message: '', left: 0 };
    const dep = state.loop === 'week' && state.season.booking !== null ? state.season.booking.deposit : 0;
    const left = state.cash + dep - cartTotal() - rowDef.price;
    const no = (message) => ({ ok: false, message, left });
    if (state.loop !== 'tutorial' && state.loop !== 'week') return no('');
    if (!morningOpen()) return no('');
    const isGear = rowDef.kind === 'gear';
    if ((isGear ? state.gear : state.decor)[id] === true) return no('Owned');
    const need = rowDef.needs ? (isGear ? rowDef.needs.gear : rowDef.needs.decor) : undefined;
    if (need && (isGear ? state.gear : state.decor)[need] !== true) return no(rowDef.needsText);
    if (rowDef.price > state.cash || left < 0) return no('Not enough cash');
    return { ok: true, message: '', left };
  }

  function reconfigureYard() {
    const spots = state.stations.table.spots;
    const want = tableSpotCount();
    while (spots.length < want) spots.push(null);
    while (spots.length > want) spots.pop();
    const p = state.player;
    if (!walkable(p.x, p.y)) {
      const t = nearestWalkableTo(p.x, p.y);
      if (t) {
        p.x = t.x; p.y = t.y; p.px = t.x * TILE; p.py = t.y * TILE;
        p.next = null; p.path = []; p.walking = false; p.target = null;
      }
    }
    for (const id of COOKER_IDS) {
      if (!stationActive(STATION_BY_ID[id])) {
        state.stations[id].fire = 0;
        state.stations[id].pieces = [];
      }
    }
  }

  // X4.1: the v2 hire rows are gone ([S 6.10]); hire() stays as an inert stub that emits nothing.
  function hire(id) {
    return { ok: false, hired: false, message: '' };
  }

  function sellOne(id) {
    const rowDef = CATALOG_BY_ID[id];
    const price = Math.floor(rowDef.price * C.SELL_BACK);
    state.cash += price;
    if (rowDef.kind === 'decor') state.decor[id] = false;
    else state.gear[id] = false;
    emit('sell', { id, label: rowDef.label, price });
    return { label: rowDef.label, price };
  }

  function sell(id) {
    if (state.loop !== 'tutorial' && state.loop !== 'week') return { ok: false, message: '', price: 0 };
    if (!(state.phase === 'morning' && state.broke)) return { ok: false, message: '', price: 0 };
    const isGear = GEAR_IDS.includes(id);
    const isDecor = DECOR_IDS.includes(id);
    if (!isGear && !isDecor) return { ok: false, message: '', price: 0 };
    if ((isGear ? state.gear[id] : state.decor[id]) !== true) return { ok: false, message: '', price: 0 };
    const sales = [];
    if (id === 'kettle2' && state.gear.drum) {
      sales.push(sellOne('kettle2'));
      sales.push(sellDrum());
    } else if (id === 'drum') {
      sales.push(sellDrum());
    } else if (id === 'chair1' && state.decor.chair2) {
      sales.push(sellOne('chair1'));
      sales.push(sellOne('chair2'));
    } else {
      sales.push(sellOne(id));
    }
    reconfigureYard();
    emit('save_wanted', { reason: 'sell' });
    state.broke = brokeTest();
    let total = 0;
    const parts = sales.map((s) => { total += s.price; return s.label + ' for ' + s.price; });
    return { ok: true, message: 'Sold ' + parts.join(' and ') + '.', price: total };
  }

  function sellDrum() {
    const s = sellOne('drum');
    const brisket = state.stock.brisket;
    if (brisket > 0) {
      const each = Math.floor(MEATS.brisket.unit / 2);
      state.cash += each * brisket;
      s.price += each * brisket;
      state.stock.brisket = 0;
    }
    state.cart.meat.brisket = 0;
    return s;
  }

  // The tutorial day's morning only (W5.2, W22.17); the week uses canLoadUp().
  function canOpen() {
    if (state.loop !== 'tutorial') return { ok: false, reason: '' };
    if (!morningOpen()) return { ok: false, reason: '' };
    if (state.charcoal + state.cart.charcoal === 0) return { ok: false, reason: 'Buy at least one bag of charcoal.' };
    if (totalStock() + sumValues(state.cart.meat) === 0) return { ok: false, reason: 'Buy at least one unit of meat.' };
    return { ok: true, reason: '' };
  }

  // Charge the cart and move it into the cooler and the pile.
  function commitCart() {
    state.cash -= cartTotal();
    for (const m of MEAT_IDS) { state.stock[m] += state.cart.meat[m]; state.cart.meat[m] = 0; }
    state.charcoal = Math.min(C.CHARCOAL_MAX, state.charcoal + state.cart.charcoal);
    state.cart.charcoal = 0;
  }

  // The v2 service setup shared by openGate() and loadUp().
  function startService(kind) {
    tickCount = 0;
    acc = 0;
    pieceSeq = 0;
    custSeq = 0;
    buddyPick = null;
    gateOpenFired = false;
    schedule = [];
    schedIdx = 0;
    tickets = zeroByMeat();
    state.clock = 0;
    state.phase = 'service';
    state.paused = false;
    state.comingNext = false;
    state.spawnAt = Infinity;
    state.arrivals = 0;
    state.lastCallFired = false;
    state.gateSoonFired = false;
    state.customers = [];
    state.seats = emptySeats();
    for (const id of COOKER_IDS) { state.stations[id] = newCooker(id); decayAcc[id] = 0; }
    state.stations.board = { stacks: [], slicing: null, waiting: [] };
    state.stations.table = { spots: new Array(tableSpotCount()).fill(null) };
    state.player = newPlayer();
    state.today = newToday();
    state.today.kind = kind;
    state.today.repStart = state.rep;
    state.today.wageNames = [];
    state.today.third = fanThird();
    schedParty = [];
    pullT = 0;
    fireSampled = false;
    // X7 and X18.1 item 41: the lineup's movers, each with its card id, effective skills and curve
    // values fixed for the event (X5.2). The FIRE card works from the first kettle. None on the
    // tutorial day.
    state.buddy = null;
    state.tender = null;
    state.prep = null;
    if (kind === 'tutorial') return;
    for (const card of lineupCards()) {
      const eff = effectiveSkills(card);
      const vals = curveValues(card.role, eff);
      state.today.crew[String(card.id)] = { role: card.role, plates: 0, cuts: 0, bags: 0, savedS: 0, tips: 0 };
      state.today.wageNames.push(card.name);
      const crewBits = { cardId: card.id, eff, vals };
      if (card.role === 'run') {
        state.buddy = Object.assign(newMover(MAP.buddyIdle.x, MAP.buddyIdle.y, MAP.buddyIdle.face), { carrying: null, task: 'idle', t: 0 }, crewBits);
      } else if (card.role === 'fire') {
        state.tender = Object.assign(newMover(MAP.tenderIdle.x, MAP.tenderIdle.y, MAP.tenderIdle.face), { carrying: null, task: 'idle', t: 0, cooker: null, cooldown: 0 }, crewBits);
      } else {
        state.prep = Object.assign(newMover(MAP.prepIdle.x, MAP.prepIdle.y, MAP.prepIdle.face), { carrying: null, task: 'idle', t: 0 }, crewBits);
      }
    }
  }

  // The tutorial day only (W5.2): v2.1 timings whatever the setting (W7.1).
  function openGate() {
    if (state.loop !== 'tutorial') return { ok: false, message: '' };
    const can = canOpen();
    if (!can.ok) return { ok: false, message: can.reason };
    commitCart();
    startService('tutorial');
    const t = state.today;
    t.gateAt = C.GATE_OPENS;
    t.lastCallAt = C.LAST_CALL;
    t.endAt = C.DAY_SECONDS;
    state.spawnAt = tutRunning() ? Infinity : C.GATE_OPENS;   // [T 2.4] C
    if (!(state.stock[state.selected] > 0)) autoSelect();
    emit('save_wanted', { reason: 'open' });
    emit('yard_open', { kind: 'tutorial' });
    checkTutorial();
    return { ok: true, message: '' };
  }

  // ---- v3.0 the week (W5.1, W6) ---------------------------------------------------------------

  function inWeek() {
    return state.loop === 'week' && state.phase === 'morning';
  }

  function ownedCookers() {
    let n = 0;
    for (const id of COOKER_IDS) if (stationActive(STATION_BY_ID[id])) n += 1;
    return n;
  }

  function offerInput() {
    const s = state.season;
    return { seed: s.seed, year: s.year, week: s.week, rep: state.rep, cash: s.weekCash,
      gear: Object.assign({}, state.gear), length: state.settings.length, avoid: avoidNames() };
  }

  function addonLegal(offer, meat) {
    return offer !== null && offer !== undefined && offer.type !== 'yard' && typeof meat === 'string'
      && MEAT_IDS.includes(meat) && !offer.menu.includes(meat) && (!MEATS[meat].drumOnly || state.gear.drum === true);
  }

  function emitOffersReady() {
    const s = state.season;
    emit('offers_ready', { year: s.year, week: s.week, ids: s.offers.map((o) => o.id) });
  }

  // W5.1 (internal) with W22.3 and W22.4: the week's offers, the first one picked, the cart
  // prefilled, then the Broke test with the largest deposit on offer.
  function startWeek(weekCash) {
    const s = state.season;
    s.weekCash = weekCash === undefined ? clamp(Math.trunc(state.cash), 0, C.MAX_CASH) : weekCash;
    s.offers = genOffers(offerInput());
    // Q-7: last week's booking type again when it is offered and safe, else the first card.
    const last = s.results.length > 0 ? s.results[s.results.length - 1] : null;
    const again = last !== null && last.type !== 'yard' ? (s.offers.find((o) => o.type === last.type && o.safe) || null) : null;
    s.booking = again !== null ? again : (s.offers.length > 0 ? s.offers[0] : null);
    s.addon = null;
    state.loop = 'week';
    state.phase = 'morning';
    // X6.3: this week's walk-ins and an open training pick; signing fees count from here (item 32).
    s.walkins = genWalkins({ seed: s.seed, year: s.year, week: s.week, rep: state.rep, avoid: avoidNames() })
      .map((a) => Object.assign(a, { hired: false }));
    s.trained = null;
    s.day = 0;
    s.dayLog = new Array(C.WEEK_DAYS).fill(null);
    s.prepped = false;
    s.loadin = false;
    s.overnight = null;
    state.dayCard = null;
    state.cart = morningCart();   // V32-8
    crewSpend = [];
    emitOffersReady();
    state.broke = brokeTest();
    if (state.broke) emit('broke');
  }

  // Review 1 (contract X20.4): after a gear buy every card already on the hub keeps what it showed
  // (headcount, menu, pay, deposit, host, tier); only its Needs line and Load up and go follow the
  // gear. A card the buy adds (the top third's invite) comes in fresh.
  function keepShown(next) {
    const old = state.season.offers;
    return next.map((o) => {
      const was = old.find((x) => x.id === o.id && x.type === o.type) || null;
      if (was === null || o.type === 'yard' || o.type === 'finale') return o;
      const row = BOOKINGS[o.type];
      const needs = needsFor(was.menu, state.gear) || capacityNeeds(row, was.rail, state.gear, was.window);
      return Object.freeze(Object.assign({}, was, { needs, safe: needs === '' }));
    });
  }

  // W22.11 and setLength(): this week's offers again from the stored inputs. Without `force` they
  // are replaced only when the result differs. The pick keeps by id, the add-on when still legal.
  // `keep` (a gear buy) holds the shown cards' numbers (keepShown).
  function regenOffers(force, keep) {
    const s = state.season;
    const next = keep === true ? keepShown(genOffers(offerInput())) : genOffers(offerInput());
    if (!force && JSON.stringify(next) === JSON.stringify(s.offers)) return false;
    const pickId = s.booking !== null ? s.booking.id : null;
    s.offers = next;
    s.booking = next.find((o) => o.id === pickId) || next[0] || null;
    if (s.addon !== null && !addonLegal(s.booking, s.addon)) s.addon = null;
    state.cart = prefill();
    emitOffersReady();
    return true;
  }

  function railFor(offer, addon) {
    if (!isPlainObject(offer) || offer.type === 'yard' || !Array.isArray(offer.menu)) return zeroByMeat();
    const menu = MEAT_IDS.filter((m) => offer.menu.includes(m));
    const a = (typeof addon === 'string' && MEAT_IDS.includes(addon) && !menu.includes(addon)) ? addon : null;
    const hc = Number(offer.headcount);
    return railSplit(Number.isFinite(hc) && hc > 0 ? Math.trunc(hc) : 0, menu, a);
  }

  function bookOffer(id) {
    if (!inWeek()) return { ok: false, message: '' };
    const s = state.season;
    const o = s.offers.find((x) => x.id === id) || null;
    if (o === null) return { ok: false, message: '' };
    if (s.loadin) return { ok: false, message: STRINGS.ui.bookLocked };   // D4.5
    if ((o.day !== null && o.day < s.day) || eventPlayed()) return { ok: false, message: STRINGS.ui.bookPast };   // D5
    s.booking = o;
    s.addon = null;
    state.cart = prefill();
    emit('booking_picked', { id: o.id, booking: o.type });   // integration I-1: 'type' is the event's own key
    emit('save_wanted', { reason: 'book' });
    return { ok: true, message: '' };
  }

  function setAddon(meat) {
    if (!inWeek()) return { ok: false, message: '' };
    const s = state.season;
    if (s.booking === null) return { ok: false, message: '' };
    if (s.loadin) return { ok: false, message: STRINGS.ui.bookLocked };   // D4.5
    if (meat !== null && !addonLegal(s.booking, meat)) return { ok: false, message: STRINGS.ui.addonNo };
    s.addon = meat;
    state.cart = prefill();
    emit('save_wanted', { reason: 'addon' });
    return { ok: true, message: '' };
  }

  function canLoadUp() {
    if (!inWeek() || state.broke) return { ok: false, reason: '' };
    const b = state.season.booking;
    if (b === null) return { ok: false, reason: STRINGS.ui.goPick };
    // D5: only on the booked day (a Yard week cooks through chooseDay('yard')).
    const bd = bookedDay();
    if (bd === null) return { ok: false, reason: '' };
    if (bd !== state.season.day || eventPlayed()) return { ok: false, reason: fillText(STRINGS.ui.goNotToday, { day: STRINGS.dayName[bd] }) };
    if (!b.safe) return { ok: false, reason: b.needs };
    // X5.4: the lineup's wages against the payroll budget (Yard days too, X18.1 item 41).
    const pr = payroll();
    if (pr.now > pr.budget) return { ok: false, reason: fillText(STRINGS.ui.goPayroll, { p: pr.now, b: pr.budget }) };
    if (state.charcoal + state.cart.charcoal === 0) return { ok: false, reason: 'Buy at least one bag of charcoal.' };
    let units = 0;
    if (b.type === 'yard') units = totalStock() + sumValues(state.cart.meat);
    else {
      const rail = railFor(b, state.season.addon);
      for (const m of MEAT_IDS) if (rail[m] > 0) units += state.stock[m] + state.cart.meat[m];
    }
    if (units === 0) return { ok: false, reason: 'Buy at least one unit of meat.' };
    if (cartTotal() > state.cash + b.deposit) return { ok: false, reason: STRINGS.ui.goCash };
    return { ok: true, reason: '' };
  }

  // W5.1 and W7.1: the deposit in, the cart charged, service set up for the booking or Yard day.
  function loadUp() {
    return loadUpCore(false);
  }

  // D4.3 and D4.5: `yardDay` is chooseDay('yard') (half length Monday to Friday), else the booked day.
  function loadUpCore(yardDay) {
    const s = state.season;
    if (yardDay) {
      const why = yardWhy();
      if (why !== null) return { ok: false, message: why };
    } else {
      const can = canLoadUp();
      if (!can.ok) return { ok: false, message: can.reason };
    }
    const b = yardDay ? freezeOffer(offerFields(BOOKINGS.yard, state.gear, state.settings.length, undefined, 1), null) : s.booking;
    const isBooking = !yardDay;
    const L = lengthRow(state.settings.length);
    const weekday = yardDay && s.day <= 4;
    const endAt = b.type === 'finale' ? C.FINALE_SECONDS : (weekday ? Math.round(L.seconds * C.YARD_DAY_FRAC) : L.seconds);   // Q-2, D4.3
    let overnight = null;
    if (isBooking && s.overnight !== null) {
      state.stock[s.overnight.meat] = Math.min(C.STEPPER_MAX, state.stock[s.overnight.meat] + s.overnight.n);
      overnight = { meat: s.overnight.meat, n: s.overnight.n, left: s.overnight.n };
      s.overnight = null;
    }
    const charcoalStart = state.charcoal, stockStart = Object.assign({}, state.stock);   // Q-9
    state.cash += b.deposit;
    commitCart();
    startService(isBooking ? 'booking' : 'yard');
    const t = state.today;
    t.deposit = b.deposit;
    t.charcoalStart = charcoalStart;
    t.stockStart = stockStart;
    t.gateAt = weekday ? Math.round(C.GATE_OPENS * C.YARD_DAY_FRAC) : C.GATE_OPENS;   // V32-10
    t.lastCallAt = Math.min(t.gateAt + (isBooking ? b.window : (weekday ? Math.round(L.window * C.YARD_DAY_FRAC) : L.window)), endAt - C.LAST_CALL_GUARD);
    t.endAt = endAt;
    t.weekday = weekday;
    t.dayIdx = s.day;
    t.prepBonus = isBooking && s.prepped ? C.PREP_QUALITY : 0;
    t.overnight = overnight;
    if (isBooking) {
      t.booking = Object.freeze(Object.assign({}, b));
      t.addon = s.addon;
      t.rail = railFor(b, s.addon);
      t.booked = b.headcount;
      t.pending = b.headcount;
      tickets = Object.assign({}, t.rail);
      buildSchedule(b, t.gateAt);
      state.spawnAt = Infinity;
      state.rain = false;   // W22.10: rain only touches the Yard day
      let best = null;
      for (const m of MEAT_IDS) {
        if (t.rail[m] > 0 && state.stock[m] > 0 && (best === null || MEATS[m].cook < MEATS[best].cook)) best = m;
      }
      if (best !== null) state.selected = best;
      else if (!(state.stock[state.selected] > 0)) autoSelect();
    } else {
      state.spawnAt = t.gateAt;
      if (!(state.stock[state.selected] > 0)) autoSelect();
    }
    if (isBooking) s.offers = [];   // v3.2: a Yard day keeps the week's offers
    state.loop = 'prep';
    if (b.deposit > 0) emit('deposit', { amount: b.deposit });
    emit('save_wanted', { reason: 'open' });
    emit('yard_open', { kind: t.kind });
    return { ok: true, message: '' };
  }

  // ---- v3.2 days of the week (contract D4 to D6) -----------------------------------------------

  // The booked day of the picked offer; null for the Yard offer or no pick.
  function bookedDay() {
    const b = state.season.booking;
    return b !== null && b.type !== 'yard' && typeof b.day === 'number' ? b.day : null;
  }

  function eventPlayed() {
    return state.season.dayLog.includes('event');
  }

  // A morning's cart (v3.2): Monday (as startWeek() leaves it) and the cook day get the prefill; a
  // weekday in between opens empty, so a Market run or a Load-in buys only what the player put in
  // (a prefilled Friday cart would spoil overnight without a cooler). A Yard week's weekend days
  // are cook days; after the booking has played the cart is empty.
  function morningCart() {
    const s = state.season;
    const bd = bookedDay();
    const cookDay = !eventPlayed() && (bd !== null ? s.day === bd : s.day >= 5);   // V32-8: Monday too
    return cookDay ? prefill() : { meat: zeroByMeat(), charcoal: 0 };
  }

  // What canLoadUp() asks of a Yard day: null when it can cook, else the reason.
  function yardWhy() {
    if (state.broke) return '';
    const pr = payroll();
    if (pr.now > pr.budget) return fillText(STRINGS.ui.goPayroll, { p: pr.now, b: pr.budget });
    if (state.charcoal + state.cart.charcoal === 0) return 'Buy at least one bag of charcoal.';
    if (totalStock() + sumValues(state.cart.meat) === 0) return 'Buy at least one unit of meat.';
    if (cartTotal() > state.cash) return STRINGS.ui.goCash;
    return null;
  }

  function cartCount() {
    return sumValues(state.cart.meat) + state.cart.charcoal;
  }

  // V32-9: units of meat past tonight's cooler room once today's cart is bought.
  function spillTonight() {
    return Math.max(0, totalStock() + sumValues(state.cart.meat) - coolerCap());
  }
  // V32-9: whether a Load-in today would put meat on overnight (D4.5), the cart bought first.
  function overnightCan() {
    const s = state.season;
    if (bookedDay() !== 5) return false;
    const pay = cartCount() > 0 && cartTotal() <= state.cash;
    if (state.charcoal + (pay ? state.cart.charcoal : 0) < C.OVERNIGHT_BAGS) return false;
    const rail = railFor(s.booking, s.addon);
    return C.OVERNIGHT_MEATS.some((m) => rail[m] > 0 && state.stock[m] + (pay ? state.cart.meat[m] : 0) > 0);
  }

  // D4.1
  function dayOptions() {
    if (!inWeek()) return { ok: false, message: '' };
    const s = state.season;
    const d = s.day;
    const bd = bookedDay();
    const booked = bd !== null && bd === d && !eventPlayed();
    const options = [];
    const add = (kind, why, warn) => options.push({ kind, ok: why === null, reason: why === null ? '' : why, warn: why === null && warn ? warn : '' });
    const U = STRINGS.ui;
    const spill = spillTonight();
    const buyWarn = spill > 0 ? fillText(U.marketSpoil, { n: spill }) : '';
    const yardWarn = spill > 0 ? U.yardSpoil : '';
    if (d <= 3) {
      add('yard', yardWhy(), yardWarn);
      add('prep', bd === null ? U.prepNeedsBooking : (s.prepped ? U.prepDone : null));
      add('market', cartCount() === 0 ? U.cartEmpty : (cartTotal() > state.cash ? U.goCash : null), buyWarn);
      add('train', state.crew.length === 0 ? U.crewEmpty : (s.trained !== null ? U.trainDone : null));
      add('off', null);
    } else if (d === 4) {
      const buys = cartCount() > 0 && cartTotal() <= state.cash;
      add('loadin', bd === null ? U.prepNeedsBooking : (s.loadin ? U.loadinDone : null),
        s.prepped && !overnightCan() ? U.loadinSame : (buys ? buyWarn : ''));
      add('yard', yardWhy(), yardWarn);
      add('off', null);
    } else if (booked) {
      const can = canLoadUp();
      add('event', can.ok ? null : can.reason);
      if (!can.ok) add('off', null);   // a booking that cannot load never strands the week
    } else {
      add('yard', yardWhy(), yardWarn);
      add('off', null);
    }
    return { day: d, booked, price: C.DAY_PRICE[d], options };
  }

  function cartLines() {
    const out = [];
    for (const m of MEAT_IDS) if (state.cart.meat[m] > 0) out.push({ id: m, qty: state.cart.meat[m], cost: lineCost(m, state.cart.meat[m]) });
    if (state.cart.charcoal > 0) out.push({ id: 'charcoal', qty: state.cart.charcoal, cost: lineCost('charcoal', state.cart.charcoal) });
    return out;
  }

  // D4.7 step 1 off a cook day: the cooler keeps its cap overnight, costliest first; the rest spoils.
  function spoilTonight() {
    const cap = coolerCap();
    const meat = zeroByMeat();
    let units = 0;
    if (totalStock() > cap) {
      let room = cap;
      for (const m of KEEP_ORDER) {
        const keep = Math.min(state.stock[m], room);
        room -= keep;
        const gone = state.stock[m] - keep;
        if (gone > 0) { meat[m] = gone; state.stock[m] = keep; units += gone; }
      }
    }
    if (units > 0) emit('spoiled', { units, meat });
    return units;
  }

  // D4.7: the day tick, the only place a day ends. `cooked`: spoilage already ran in endDay().
  // Returns the units that spoiled tonight.
  function nextDay(kind, cooked, moodChanges) {
    const s = state.season;
    if (s.overnight !== null && s.day >= 5) {   // the booked Saturday went by without the event
      state.stock[s.overnight.meat] = Math.min(C.STEPPER_MAX, state.stock[s.overnight.meat] + s.overnight.n);
      s.overnight = null;
    }
    const spoiled = cooked ? 0 : spoilTonight();
    if (moodChanges && moodChanges.length > 0) emit('crew_mood', { changes: moodChanges });
    s.dayLog[s.day] = kind;
    if (s.day < C.WEEK_DAYS - 1) {
      s.day += 1;
      beginMorning('week');
      state.cart = morningCart();
      emit('day_start', { day: s.day });
    } else {
      if (s.results.length < s.week) s.results.push({ type: 'yard', stars: 0 });
      if (s.results.length < C.SEASON_WEEKS) {
        s.week = s.results.length + 1;
        beginMorning('week');
        emit('week_start', { year: s.year, week: s.week });
        startWeek();
      } else {
        toSeasonEnd();
      }
    }
    emit('save_wanted', { reason: 'day' });
    return spoiled;
  }

  // D5
  function chooseDay(kind, opt) {
    if (!inWeek()) return { ok: false, message: '' };
    const view = dayOptions();
    const o = view.options.find((x) => x.kind === kind) || null;
    if (o === null) return { ok: false, message: '' };
    if (!o.ok) return { ok: false, message: o.reason };
    if (kind === 'yard') return loadUpCore(true);
    if (kind === 'event') return loadUpCore(false);
    const s = state.season;
    const day = s.day;
    const card = { day, kind, bought: [], spent: 0, prepBonus: 0, overnight: null, mood: [], spoiled: 0, trained: null, moodTop: false, loadinSame: false };
    const changes = [];
    if (kind === 'train') {
      const tid = isPlainObject(opt) ? readKey(opt, 'id') : undefined;
      const r = trainRule(tid);
      if (!r.ok) return r;
      const tc = findCard(tid);
      if (tc !== null) card.trained = { id: tc.id, name: tc.name, xp: C.TRAIN_XP };   // V32-11
    } else if (kind === 'market' || kind === 'loadin') {
      // D4.2: the cart commits at today's price (a Load-in it cannot pay for keeps it for the booked day).
      if (cartCount() > 0 && cartTotal() <= state.cash) {
        card.bought = cartLines();
        card.spent = cartTotal();
        commitCart();
      }
      if (kind === 'loadin') {
        const wasPrepped = s.prepped;
        s.prepped = true;
        s.loadin = true;
        card.prepBonus = wasPrepped ? 0 : C.PREP_QUALITY;   // V32-9: no second Prep line
        // D4.5: the overnight smoke, Saturday bookings only.
        if (bookedDay() === 5) {
          const rail = railFor(s.booking, s.addon);
          let meat = null;
          for (const m of C.OVERNIGHT_MEATS) {
            if (rail[m] > 0 && state.stock[m] > 0 && (meat === null || MEATS[m].cook > MEATS[meat].cook)) meat = m;
          }
          if (meat !== null && state.charcoal >= C.OVERNIGHT_BAGS) {
            state.charcoal -= C.OVERNIGHT_BAGS;
            const n = Math.min(C.OVERNIGHT_PIECES, state.stock[meat]);
            state.stock[meat] -= n;
            s.overnight = { meat, n };
            card.overnight = { meat, n };
            emit('overnight_on', { meat, n });
          }
        }
        card.loadinSame = wasPrepped && card.overnight === null;
      }
    } else if (kind === 'prep') {
      s.prepped = true;
      card.prepBonus = C.PREP_QUALITY;
    } else if (kind === 'off') {
      // D4.6: a step of mood up to the cap; notice clears above Done. No wages, no daily costs.
      for (const c of state.crew.slice().sort(byId)) {
        const from = c.mood;
        if (c.mood < C.DAYOFF_MOOD_CAP) c.mood = Math.min(C.DAYOFF_MOOD_CAP, c.mood + C.DAYOFF_MOOD);
        if (c.mood > -2) c.notice = false;
        if (c.mood !== from) {
          changes.push({ id: c.id, from, to: c.mood });
          card.mood.push({ id: c.id, name: c.name, from, to: c.mood });
        }
      }
      card.moodTop = state.crew.length > 0 && card.mood.length === 0;   // V32-11
    }
    emit('day_done', { day, kind, spent: card.spent, prepBonus: card.prepBonus,
      overnight: card.overnight !== null ? { meat: card.overnight.meat, n: card.overnight.n } : null, moodUp: card.mood.length });
    card.spoiled = nextDay(kind, false, changes);
    state.dayCard = card;
    if (state.loop === 'week') state.phase = 'evening';
    return { ok: true, message: '' };
  }

  // D5: the result card is read; the next morning (the tick already ran) opens.
  function advanceDay() {
    if (state.loop !== 'week' || state.phase !== 'evening') return { ok: false, message: '' };
    state.dayCard = null;
    state.phase = 'morning';
    return { ok: true, message: '' };
  }

  function dayCardView() {
    const c = state.dayCard;
    if (c === null || c === undefined) return null;
    return {
      day: c.day, kind: c.kind,
      bought: c.bought.map((b) => ({ id: b.id, qty: b.qty, cost: b.cost })),
      spent: c.spent, prepBonus: c.prepBonus,
      overnight: c.overnight !== null ? { meat: c.overnight.meat, n: c.overnight.n } : null,
      mood: c.mood.map((m) => ({ id: m.id, name: m.name, from: m.from, to: m.to })),
      spoiled: c.spoiled,
      trained: c.trained ? { id: c.trained.id, name: c.trained.name, xp: c.trained.xp } : null,
      moodTop: c.moodTop === true, loadinSame: c.loadinSame === true
    };
  }

  // W5.1: the till or report is done. Tutorial: the creator (or the week); report: the day tick
  // (D4.7), which opens the next morning, the next week or, after week 9, the season end card.
  function finishReport() {
    if (state.phase !== 'evening') return;
    const s = state.season;
    if (state.loop === 'tutorial') {
      floorAfterTutorial();
      if (state.profile === null) {
        beginMorning('creator');
        state.loop = 'creator';
      } else if (hiringOwed()) {   // X8
        beginMorning('hiring');
        openHiring(false);
        emit('save_wanted', { reason: 'hiring' });
      } else {
        beginMorning('week');
        emit('week_start', { year: s.year, week: s.week });
        startWeek();
        emit('save_wanted', { reason: 'week' });
      }
      return;
    }
    if (state.loop !== 'report') return;
    // D5: a cook day's report ends that day.
    const kind = state.today.kind === 'booking' ? 'event' : 'yard';
    state.loop = 'week';
    state.dayCard = null;
    nextDay(kind, true);
  }

  function toSeasonEnd() {
    const s = state.season;
    clearYard();   // deviation 45: no rain roll
    state.cart = { meat: zeroByMeat(), charcoal: 0 };
    s.offers = [];
    s.booking = null;
    s.addon = null;
    state.loop = 'seasonEnd';
    emit('season_end', { year: s.year, stars: s.results.map((x) => x.stars) });
  }

  function continueFromTill() {
    finishReport();
  }

  function seasonEndPreview() {
    if (state.loop !== 'seasonEnd') return null;
    const s = state.season;
    return {
      year: s.year,
      stars: s.results.map((x) => x.stars),
      cash: state.cash,
      repFrom: state.rep,
      repTo: Math.max(C.SEASON_REP_FLOOR, Math.floor(state.rep * C.SEASON_CARRY_REP)),
      spoiled: Object.assign({}, state.stock),
      charcoal: state.charcoal,
      // X5.9: every card, and the wage it signs on again at when its contract runs out
      crew: state.crew.map((c) => {
        const renews = c.contract <= 1;
        return { id: c.id, name: c.name, wageFrom: c.wage, wageTo: renews ? wageFor(cardStars(c.skills), c.role) : c.wage, renews };
      })
    };
  }

  // W11: cash, gear, decor, hires, the profile, settings and stats keep; word of mouth carries at
  // the larger of the floor and 75 percent; the cooler empties; charcoal and wood keep.
  function startSeason() {
    if (state.loop !== 'seasonEnd') return false;
    const pv = seasonEndPreview();
    const s = state.season;
    state.rep = pv.repTo;
    for (const m of MEAT_IDS) state.stock[m] = 0;
    s.year = Math.min(C.YEAR_MAX, s.year + 1);
    s.week = 1;
    s.results = [];
    // X5.9: the season roll for every card. Until v3.2's Offseason screen every contract renews
    // for one season at the table wage for the card's stars (X18 item 11).
    for (const c of state.crew) {
      c.seasons = Math.min(99, c.seasons + 1);
      c.rookie = false;
      c.mood = c.mood > 0 ? c.mood - 1 : (c.mood < 0 ? c.mood + 1 : 0);
      c.bench = 0;
      c.notice = false;
      c.contract -= 1;
      if (c.contract <= 0) {
        c.contract = 1;
        c.wage = wageFor(cardStars(c.skills), c.role);
        c.raised = false;
      }
    }
    s.drafted = false;
    s.trained = null;
    s.walkins = [];
    beginMorning('hiring');
    emit('season_start', { year: s.year });
    openHiring(false);
    emit('save_wanted', { reason: 'season' });
    return true;
  }

  // W5.1 with W22.1: any loop and phase. From the creator it opens the week.
  function setPlayer(look, name, pitName) {
    const lk = cleanLook(look);
    const nm = cleanName(name, STRINGS.defaultName);
    const pit = cleanName(pitName, STRINGS.defaultPit, C.PIT_NAME_MAX);
    state.profile = { name: nm, look: lk };
    state.pitName = pit;
    emit('player_set', { name: nm, pitName: pit });
    if (state.loop === 'creator') {
      if (hiringOwed()) openHiring(false);   // X8: Hiring Day before week 1
      else {
        emit('week_start', { year: state.season.year, week: state.season.week });
        startWeek();
      }
    }
    emit('save_wanted', { reason: 'player' });
    return { ok: true, look: Object.assign({}, lk), name: nm, pitName: pit };
  }

  function randomLook() {
    const o = {};
    for (const k of LOOK_KEYS) o[k] = Math.floor(lookRng() * LOOK_COUNTS[k]);
    return o;
  }

  function look() {
    return Object.assign({}, state.profile !== null ? state.profile.look : DEFAULT_LOOK);
  }

  function setLength(len) {
    if (typeof len !== 'string' || !C.LENGTH_ORDER.includes(len) || state.phase !== 'morning') return { ok: false, message: '' };
    if (state.loop === 'tutorial') {
      state.settings.length = len;
      emit('save_wanted', { reason: 'settings' });
      return { ok: true, message: '' };
    }
    if (!inWeek()) return { ok: false, message: '' };
    state.settings.length = len;
    regenOffers(true);
    emit('save_wanted', { reason: 'settings' });
    return { ok: true, message: '' };
  }

  function fanThird() {
    return state.rep >= C.THIRD_EDGES[1] ? 2 : (state.rep >= C.THIRD_EDGES[0] ? 1 : 0);
  }

  function offerSlots() {
    const third = fanThird();
    return { slots: C.OFFER_SLOTS[third], invite: third === C.INVITE_THIRD };
  }

  // ---- W10 inventory ------------------------------------------------------------------------

  function coolerCap() {
    return C.COOLER_CAP[state.gear.cooler ? 1 : 0];
  }

  function inventory() {
    const units = totalStock();
    const cap = coolerCap();
    return { charcoal: state.charcoal, wood: state.wood, meat: Object.assign({}, state.stock), units, cap, over: Math.max(0, units - cap) };
  }

  // W10.2: units this event can use beyond the cooler. A booking: half again the booked plates of
  // each rail meat, in units; the Yard day and the tutorial: expectedCrowd().
  function eventUnits() {
    const b = state.loop === 'week' ? state.season.booking : null;
    if (b !== null && b.type !== 'yard') {
      const rail = railFor(b, state.season.addon);
      let n = 0;
      for (const m of MEAT_IDS) if (rail[m] > 0) n += Math.ceil(rail[m] * 1.5 / MEATS[m].plates);
      return n;
    }
    return expectedCrowd();
  }

  function meatRoom() {
    return Math.max(0, coolerCap() + eventUnits() - totalStock() - sumValues(state.cart.meat));
  }

  function ceilG(x) {
    return Math.ceil(x - 1e-9);   // deviation 35
  }

  // W10.3 with W22.14: the cart that makes the two tap week work, computed without changing state.
  function prefill() {
    const b = state.loop === 'week' ? state.season.booking : null;
    const isBooking = b !== null && b.type !== 'yard';
    const budget = state.cash + (b !== null ? b.deposit : 0);
    const rail = isBooking ? railFor(b, state.season.addon) : null;
    const priceOf = (m) => CATALOG_BY_ID[m].price;
    const room = Math.max(0, coolerCap() + eventUnits() - totalStock());
    function costliest(meat) {
      let pick = null;
      for (const m of MEAT_IDS) if (meat[m] > 0 && (pick === null || priceOf(m) > priceOf(pick))) pick = m;
      return pick;
    }
    function meatLines(spareIn) {
      const spare = spareIn && coolerCap() > 0;   // P-5: no spare without a cooler, it would only spoil
      const meat = zeroByMeat();
      if (isBooking) {
        for (const m of MEAT_IDS) {
          if (!(rail[m] > 0)) continue;
          const plates = spare ? ceilG(rail[m] * (1 + C.SPARE_FRAC)) : rail[m];
          const need = plates - state.stock[m] * MEATS[m].plates;
          meat[m] = need > 0 ? Math.ceil(need / MEATS[m].plates) : 0;
        }
      } else {
        let inStock = 0;
        for (const m of MEAT_IDS) inStock += state.stock[m] * MEATS[m].plates;
        const crowd = expectedCrowd();
        const plates = (spare ? ceilG(1.1 * crowd) + 1 : crowd) - inStock;
        const units = plates > 0 ? Math.ceil(plates / 2) : 0;
        meat.chicken = Math.floor(units / 2);
        meat.sausage = units - meat.chicken;
      }
      for (const m of MEAT_IDS) {
        if (MEATS[m].drumOnly && !state.gear.drum) meat[m] = 0;
        meat[m] = clamp(meat[m], 0, Math.max(0, C.STEPPER_MAX - state.stock[m]));
      }
      while (sumValues(meat) > room) {   // deviation 36
        const m = costliest(meat);
        if (m === null) break;
        meat[m] -= 1;
      }
      return meat;
    }
    function total(meat, bags) {
      let tot = lineCost('charcoal', bags);
      for (const m of MEAT_IDS) tot += lineCost(m, meat[m]);
      return tot;
    }
    // R-5: BAGS_PER_COOKER is a Normal cook's worth; a Short or Long cook scales it by its seconds.
    const secs = b !== null && b.type === 'finale' ? C.FINALE_SECONDS : lengthRow(state.settings.length).seconds;   // Q-2
    let perCooker = Math.ceil(C.BAGS_PER_COOKER * secs / C.LENGTHS.normal.seconds - 1e-9);
    // Review 1 (contract X20.2): a FIRE card whose fireSense sits above FIRE_MAX - FIRE_ADD adds a bag
    // every (FIRE_MAX - fireSense) / KETTLE_DECAY seconds, so the cart buys that many a cooker when
    // it is more (a 5 star card: 11 at Normal). Up to 4 stars the v3.0 count stands.
    const fireCard = lineupCards().find((c) => c.role === 'fire') || null;
    if (fireCard !== null && b !== null) {
      const sense = skillValue('fireSense', effectiveSkills(fireCard)[0]);
      const gap = Math.max(1, Math.min(C.FIRE_ADD, C.FIRE_MAX - sense));
      perCooker = Math.max(perCooker, Math.ceil(secs * C.KETTLE_DECAY / gap - 1e-9));
    }
    let bags = Math.max(0, perCooker * ownedCookers() - state.charcoal);
    if (state.charcoal === 0) bags = Math.max(bags, 1);
    bags = Math.min(bags, Math.max(0, C.CHARCOAL_MAX - state.charcoal));
    let meat = meatLines(true);
    if (total(meat, bags) > budget) meat = meatLines(false);
    while (total(meat, bags) > budget && sumValues(meat) > 1) meat[costliest(meat)] -= 1;
    const minBags = Math.max(0, 1 - state.charcoal);
    while (total(meat, bags) > budget && bags > minBags) bags -= 1;
    return { meat, charcoal: bags };
  }

  // W8.4 with W22.27, dev and harness only (game.js never calls it): ends the booking now with
  // `stars` forced, through the normal end of event.
  function settle(stars) {
    if (state.phase !== 'service' || state.paused) return false;
    const t = state.today;
    if (t.kind !== 'booking' || t.booking === null) return false;
    if (!(typeof stars === 'number' && Number.isInteger(stars) && stars >= 1 && stars <= 5)) return false;
    const booked = t.booked;
    const fed = stars >= 3 ? booked : Math.round(booked * (stars === 2 ? 0.6 : 0.3));
    t.fed = fed;
    t.pending = 0;
    t.missed = booked - fed;
    for (const m of MEAT_IDS) {
      if (!(t.rail[m] > 0)) continue;
      const plates = booked > 0 ? Math.round(fed * t.rail[m] / booked) : 0;
      const units = Math.min(state.stock[m], Math.ceil(plates / MEATS[m].plates));
      state.stock[m] -= units;
      t.foodCost += units * MEATS[m].unit;
      t.sold[m] = plates;
    }
    const bags = Math.min(state.charcoal, C.BAGS_PER_COOKER * ownedCookers());
    state.charcoal -= bags;
    t.bags += bags;
    let plates = 0;
    let worth = 0;
    for (const m of MEAT_IDS) { plates += t.rail[m]; worth += t.rail[m] * MEATS[m].price; }
    const avgPrice = plates > 0 ? worth / plates : 0;
    const tip = Math.round(avgPrice * C.TIP_RATE * [0, 0.2, 0.4, 0.6, 0.8][stars - 1]);
    t.tips = fed * tip;
    state.cash += t.tips;
    // Clear the yard with no waste rows.
    state.customers = [];
    state.seats = emptySeats();
    for (const id of COOKER_IDS) state.stations[id].pieces = [];
    state.stations.board = { stacks: [], slicing: null, waiting: [] };
    state.stations.table = { spots: new Array(tableSpotCount()).fill(null) };
    const p = state.player;
    p.busy = null; p.carrying = null; p.queued = null; p.target = null; p.path = []; p.next = null; p.walking = false;
    if (state.buddy) { const bd = state.buddy; bd.carrying = null; bd.task = 'idle'; bd.t = 0; bd.path = []; bd.next = null; bd.walking = false; }
    if (state.tender) { const td = state.tender; td.carrying = null; td.cooker = null; td.task = 'idle'; td.t = 0; td.path = []; td.next = null; td.walking = false; }
    if (state.prep) { const pp = state.prep; pp.carrying = null; pp.task = 'idle'; pp.t = 0; pp.path = []; pp.next = null; pp.walking = false; }
    buddyPick = null;
    state.spawnAt = Infinity;
    const score = [20, 40, 60, 75, 90][stars - 1];
    endDay({ score, stars, parts: { fed: booked > 0 ? Math.round(C.SCORE_FED * fed / booked) : 0, wait: 0,
      quality: booked > 0 ? Math.round(C.SCORE_QUALITY * fed / booked) : 0 }, avgWait: 0 });   // P-2: quality by the share fed
    return true;
  }

  // Returns true once a Broke morning can go on: the test is false now. sell() already updates
  // state.broke after each sale, so this accepts either flag value and only checks the test.
  function continueFromBroke() {
    if (state.phase !== 'morning') return false;
    if (brokeTest()) return false;
    state.broke = false;
    return true;
  }

  function dismissComingNext() {
    state.comingNext = false;
  }

  function goal() {
    for (const id of GOAL_ORDER) {
      if (id === 'driveway' && C.DRIVEWAY_BUYABLE !== true) continue;   // Q-8
      const owned = id === 'driveway' ? false : state.gear[id] === true;
      if (!owned) {
        const rowDef = CATALOG_BY_ID[id];
        return { id, label: rowDef.label, price: rowDef.price };
      }
    }
    return null;
  }

  function setPaused(on) {
    state.paused = on === true;
  }

  // A new game (W5.2): the tutorial morning, a fresh profile and season with a seed drawn from rng.
  function reset() {
    fillState(null);
    state.season.seed = (Math.floor(rng() * 4294967296)) >>> 0;
    state.loop = 'tutorial';
    emit('save_clear');
    beginMorning('tutorial');
    checkTutorial();
  }

  // ---- v2.1 guided tutorial ([T 2], contract K3 to K5) ---------------------------------------

  const TUT_LATCHED = Object.freeze({ customer: true, seated: true, end: true });

  function tutRunning() {
    return state.tutorial.done === false;
  }

  // [T 2.4] A: held in service while the step is not yet latched.
  function tutClockHeld() {
    return tutRunning() && state.phase === 'service' && TUT_LATCHED[state.tutorial.step] !== true;
  }

  // [T 2.3] rows 1 to 11, for a step not yet latched. The first matching row wins.
  function tutorialRow() {
    if (state.phase === 'morning') return 'open';
    if (state.stations.table.spots.some((sp) => sp !== null)) return 'customer';
    // W12.1, W22.16 (a): raw meat over a full kettle 1, checked before the cold kettle rows.
    const fg = tutFullGrate();
    if (fg !== undefined) return fg === null ? 'full' : 'fullGrate';
    const ck = state.stations.kettle1;
    const h = state.player.carrying;
    const kind = h === null ? null : h.kind;
    const board = state.stations.board;
    if (ck.fire < C.COLD_UNDER) {
      if (kind === 'charcoal') return 'light';
      if (kind === 'raw') return 'puton';
      return 'charcoal';
    }
    if (kind === 'plates' || (board.stacks.length > 0 && board.slicing === null && h === null)) return 'plate';
    if (kind === 'cooked' || board.slicing !== null) return 'slice';
    if (ck.pieces.length > 0) return 'cook';
    if (kind === 'raw') return 'puton';
    if (kind === 'charcoal') return 'light';
    return 'meat';
  }

  // [T 2.2] target column, for the current state.
  function tutorialTarget(id) {
    const h = state.player.carrying;
    switch (id) {
      case 'open': return 'open';
      case 'charcoal': return 'pile';
      case 'light': return 'kettle1';
      case 'meat': return 'cooler';
      case 'puton': return 'kettle1';
      case 'cook':
        return h === null && state.stations.kettle1.pieces.some((pc) => pc.state === 'done') ? 'kettle1' : null;
      case 'slice': return 'board';
      case 'plate': return h !== null && h.kind === 'plates' ? 'table' : 'board';
      case 'full': return 'cooler';   // P-6: put it back, nothing wasted (the #act verb there)
      case 'fullGrate': { const fg = tutFullGrate(); return typeof fg === 'string' ? fg : null; }
      default: return null;
    }
  }

  // W12.1: with a raw piece in hand and no free kettle 1 slot for it: the other active cooker with
  // room ('kettle2', then 'drum'; brisket only the drum), or null for the cooler (P-6: put it back).
  // undefined when the row does not apply.
  function tutFullGrate() {
    const h = state.player.carrying;
    if (h === null || h.kind !== 'raw') return undefined;
    const m = MEATS[h.meat];
    if (freeSlotFor(state.stations.kettle1, m.slots) >= 0) return undefined;
    for (const id of ['kettle2', 'drum']) {
      if (!stationActive(STATION_BY_ID[id])) continue;
      if (m.drumOnly && id !== 'drum') continue;
      if (freeSlotFor(state.stations[id], m.slots) >= 0) return id;
    }
    return null;
  }

  // W12.2 with W22.16 (b) and deviation 33: one free unit instead of a strand, before the gate.
  function tutorialRefill() {
    if (state.phase !== 'service' || state.clock + 1e-9 >= C.GATE_OPENS) return;
    const carriesOnly = (c) => c === null || c.kind === 'charcoal' || c.kind === 'burnt';
    let out = totalStock() === 0;
    for (const id of COOKER_IDS) if (out && state.stations[id].pieces.some((pc) => pc.state !== 'burnt')) out = false;
    const board = state.stations.board;
    if (board.stacks.length > 0 || board.slicing !== null) out = false;
    if (state.stations.table.spots.some((sp) => sp !== null)) out = false;
    if (!carriesOnly(state.player.carrying) || (state.buddy && !carriesOnly(state.buddy.carrying))) out = false;
    if (out) {
      state.stock.sausage += 1;
      emit('tutorial_refill', { kind: 'meat', meat: 'sausage' });
    }
    const pc = state.player.carrying;
    if (state.charcoal === 0 && state.stations.kettle1.fire < C.COLD_UNDER && !(pc !== null && pc.kind === 'charcoal')) {
      state.charcoal += 1;
      emit('tutorial_refill', { kind: 'charcoal' });
    }
  }

  function emitTutorialStep() {
    const id = state.tutorial.step;
    const target = tutorialTarget(id);
    if (id === tutLastId && target === tutLastTarget) return;
    tutLastId = id;
    tutLastTarget = target;
    emit('tutorial_step', { id, text: STRINGS.tutorial[id], target });
  }

  // Review 1 (contract X20.9): the practice day never costs the season. When the tutorial day hands
  // over, cash and word of mouth are floored at START_CASH and START_REP.
  function floorAfterTutorial() {
    state.cash = Math.max(state.cash, C.START_CASH);
    state.rep = Math.max(state.rep, C.START_REP);
  }

  function finishTutorial(skipped) {
    state.tutorial = { step: null, done: true };
    tutEndAt = null;
    emit('tutorial_done', { skipped: skipped === true });
  }

  // Move every stored clock value by the same jump, so plate ages and pull order keep.
  function shiftClocks(jump) {
    const bump = (times) => { for (let i = 0; i < times.length; i++) times[i] += jump; };
    for (const id of COOKER_IDS) {
      for (const pc of state.stations[id].pieces) {
        pc.putOn += jump;
        if (pc.burntAt !== null) pc.burntAt += jump;
      }
    }
    for (const who of [state.player, state.buddy, state.tender]) {
      if (who && who.carrying && who.carrying.kind === 'plates') bump(who.carrying.times);
    }
    for (const st of state.stations.board.stacks) bump(st.times);
    for (const sp of state.stations.table.spots) if (sp) bump(sp.times);
  }

  // [T 2.4] F: the scripted first customer, no rng draw, served on arrival.
  function spawnScriptedCustomer() {
    let want = 'sausage';
    for (const sp of state.stations.table.spots) { if (sp !== null) { want = sp.meat; break; } }
    const c = newCustomer(want, C.PATIENCE_BASE);
    c.queueIndex = 0;
    routeToSpot(c);
    state.customers.push(c);
    emit('customer_arrived', { id: c.id, meat: c.want });
  }

  // [T 2.4] B, run right after tutorial_step customer was emitted.
  function gateOnPlate() {
    const jump = C.GATE_OPENS - state.clock;
    state.clock = C.GATE_OPENS;
    tickCount = Math.round(C.GATE_OPENS / C.TICK_SECONDS);
    if (jump !== 0) shiftClocks(jump);
    state.gateSoonFired = true;
    if (!gateOpenFired) {
      gateOpenFired = true;
      emit('gate_open');
    }
    spawnScriptedCustomer();
  }

  // [T 2.3]: checked at the end of tick, interact, openGate, skipTutorial, reset and createSim.
  function checkTutorial() {
    if (!tutRunning()) return;
    tutorialRefill();
    for (let guard = 0; guard < 4; guard++) {
      const cur = state.tutorial.step;
      if (cur === 'end') {
        if (tutEndAt !== null && state.clock + 1e-9 >= tutEndAt) finishTutorial(false);
        return;
      }
      let next;
      if (cur === 'customer') next = state.today.served >= 1 ? 'seated' : cur;
      else if (cur === 'seated') next = state.today.seated + state.today.togo >= 1 ? 'end' : cur;
      else next = tutorialRow();
      if (next === cur) { emitTutorialStep(); return; }
      state.tutorial.step = next;
      emitTutorialStep();
      if (next === 'customer') gateOnPlate();
      else if (next === 'end') {
        tutEndAt = state.clock + C.TUTORIAL_END_S;
        state.spawnAt = state.clock;   // [T 2.4] C: normal arrivals start on the next stage 6
      }
      if (TUT_LATCHED[next] !== true) return;   // rows 1 to 11 settle in one pass
    }
  }

  // [T 2.5] and contract K4.
  function skipTutorial() {
    if (!tutRunning()) return false;
    const latched = TUT_LATCHED[state.tutorial.step] === true;
    finishTutorial(true);
    if (state.phase === 'morning') {
      // W5.2, [S 19.2]: skipping goes straight to the creator (or the week, with a profile).
      floorAfterTutorial();
      if (state.profile === null) state.loop = 'creator';
      else if (hiringOwed()) openHiring(false);   // X8
      else {
        emit('week_start', { year: state.season.year, week: state.season.week });
        startWeek();
      }
      emit('save_wanted', { reason: 'tutorial' });
    } else if (state.phase === 'service') {
      if (!latched) state.spawnAt = state.clock < C.GATE_OPENS ? C.GATE_OPENS : state.clock;
      else state.spawnAt = Math.min(state.spawnAt, state.clock);   // deviation 24
    }
    checkTutorial();
    return true;
  }

  // Contract K4: null when done, else a fresh { id, text, target }.
  function tutorialStep() {
    if (!tutRunning()) return null;
    const id = state.tutorial.step;
    return { id, text: STRINGS.tutorial[id], target: tutorialTarget(id) };
  }

  function drainEvents() {
    const out = events.slice();
    events.length = 0;
    return out;
  }

  // ---- v3.1 crew cards (X4 to X8) ----------------------------------------------------------------

  function copyCard(c) {
    return {
      id: c.id, name: c.name, role: c.role, skills: [c.skills[0], c.skills[1]], potential: c.potential,
      xp: c.xp, banked: c.banked, mood: c.mood, wage: c.wage, contract: c.contract, seasons: c.seasons,
      rookie: c.rookie === true, trait: null, look: cleanLook(c.look), bring: c.bring === true,
      raised: c.raised === true, notice: c.notice === true, worked: c.worked, bench: c.bench
    };
  }

  function findCard(id) {
    if (!(typeof id === 'number' && Number.isInteger(id))) return null;
    return state.crew.find((c) => c.id === id) || null;
  }

  function byId(a, b) { return a.id - b.id; }

  // The lineup: the cards with bring, at most one a role, in id order (X1, X5.4).
  function lineupCards() {
    const seenRoles = new Set();
    const out = [];
    for (const c of state.crew.slice().sort(byId)) {
      if (!c.bring || seenRoles.has(c.role)) continue;
      seenRoles.add(c.role);
      out.push(c);
    }
    return out;
  }

  function inLineupToday(c) {
    return Object.prototype.hasOwnProperty.call(state.today.crew, String(c.id));
  }

  // X5.4: v3.1 is always the backyard rung, index 0.
  function payroll() {
    let now = 0;
    for (const c of lineupCards()) now += c.wage;
    return { now, budget: C.PAYROLL[0], slots: C.ROSTER_SLOTS[0], count: state.crew.length };
  }

  function crewLoop() {
    return (state.loop === 'week' || state.loop === 'hiring') && state.phase === 'morning';
  }

  function inHiring() {
    return state.loop === 'hiring' && state.phase === 'morning' && state.hiring !== null;
  }

  function hiringOwed() {
    return state.season.drafted !== true && state.season.results.length === 0;
  }

  function crewNames() {
    return state.crew.map((c) => c.name);
  }

  // Review 1: names an applicant, a walk-in or a host never take: the crew's and the pitmaster's.
  function avoidNames() {
    const out = crewNames();
    if (state.profile && typeof state.profile.name === 'string') out.push(state.profile.name);
    return out;
  }

  // A name nobody on the crew has yet (defensive: pool and walk-in lists already avoid the crew).
  function freeCrewName(name) {
    const used = new Set(crewNames());
    if (!used.has(name)) return name;
    return firstFreeName(STRINGS.names.indexOf(name) + 1, used);
  }

  // X6.2 and X6.3: a card from an applicant. It joins the lineup when its role is free and the
  // payroll fits, else it starts resting (X5.4, X18 item 7).
  function newCard(a, contract, rookie) {
    const id = state.crewSeq;
    state.crewSeq = Math.min(9999, id + 1);
    const card = {
      id, name: freeCrewName(a.name), role: a.role, skills: [a.skills[0], a.skills[1]], potential: a.potential,
      xp: 0, banked: 0, mood: a.mood, wage: a.wage, contract, seasons: 0, rookie, trait: null,
      look: cleanLook(a.look), bring: false, raised: false, notice: false, worked: 0, bench: 0
    };
    const pr = payroll();
    if (!lineupCards().some((c) => c.role === card.role) && pr.now + card.wage <= pr.budget) card.bring = true;
    state.crew.push(card);
    state.crew.sort(byId);
    return card;
  }

  // X5.5 and X18.1 item 43: XP banks a level at every LEVEL_XP, up to BANK_MAX (a level past the
  // bank is lost); `sink` collects a level_ready payload for every level that banked.
  function addXp(card, n, sink) {
    card.xp += Math.max(0, Math.trunc(n));
    while (card.xp >= C.LEVEL_XP) {
      card.xp -= C.LEVEL_XP;
      if (card.banked < C.BANK_MAX) {
        card.banked += 1;
        sink.push({ id: card.id, name: card.name, banked: card.banked });
      }
    }
  }

  // X18.1 item 37: the one line a crew row says.
  function crewLine(card, rec, stat, settled) {
    const S = STRINGS.crewSay;
    const name = card.name;
    if (rec === null) return fillText(S.rested, { name });
    if (settled) return fillText(S.settled, { name });
    if (card.role === 'run') {
      if (stat.plates === 0) return fillText(S.idle, { name });
      return fillText(stat.plates === 1 ? S.runOne : S.run, { name, n: stat.plates, t: stat.tips });
    }
    if (card.role === 'fire') {
      if (stat.bags === 0) return fillText(S.idle, { name });
      // Review 1: name the hot band when the fire ran in it (food cooks HOT_MULT faster there).
      if (stat.hotS >= 1) return fillText(stat.bags === 1 ? S.fireHotOne : S.fireHot, { name, n: stat.bags, s: stat.hotS });
      return fillText(stat.bags === 1 ? S.fireOne : S.fire, { name, n: stat.bags, p: stat.goodPct });
    }
    if (stat.cuts === 0) return fillText(S.idle, { name });
    return fillText(stat.cuts === 1 ? S.prepOne : S.prep, { name, n: stat.cuts, s: stat.savedS });
  }

  // X5.5 to X5.8 at the end of a booking or a Yard day: XP, mood in its fixed order from the moods
  // as they stood at the end, notice and moving on, the events worked and the till's crew rows.
  function crewAfterEvent(isBooking, stars, settled) {
    const t = state.today;
    const s = state.season;
    const cards = state.crew.slice().sort(byId);
    const lineup = cards.filter(inLineupToday);
    const resting = cards.filter((c) => !inLineupToday(c));
    // The FIRE line's percent and the cookers held (X18.1 item 37).
    let owned = 0, goodSum = 0, held = 0, hotSum = 0;
    for (const id of COOKER_IDS) {
      if (!stationActive(STATION_BY_ID[id])) continue;
      owned += 1;
      goodSum += t.fireGoodS[id];
      hotSum += t.fireHotS[id];
      if (fireSampled && t.fireDipped[id] === false) held += 1;
    }
    const span = Math.max(C.TICK_SECONDS, state.clock - t.gateAt);
    const goodPct = fireSampled && owned > 0 ? clamp(Math.round(100 * goodSum / (owned * span)), 0, 100) : 0;
    const hotS = fireSampled && owned > 0 ? Math.round(hotSum / owned) : 0;   // review 1: hot seconds a cooker
    // XP (X5.5).
    const gains = {};
    const levels = [];
    for (const c of lineup) {
      const rec = t.crew[String(c.id)];
      const gain = settled ? C.SETTLE_XP
        : C.XP_RUN_PLATE * rec.plates + C.XP_PREP_CUT * rec.cuts + C.XP_FIRE_BAG * rec.bags + (c.role === 'fire' ? C.XP_FIRE_HOLD * held : 0);
      gains[c.id] = gain;
      addXp(c, gain, levels);
    }
    // Mood (X5.6): steps 1 to 3 add up from the end of event moods, then step 4 clamps.
    // Review 1 (contract X20.5): Fired up is a burst you earn. Step 0: a lineup card that worked the
    // event at Fired up eases one step. Step 1: a 5 or 4 star booking lifts only up to Happy, except
    // a 5 star STRETCH booking, which lifts every lineup card a full step (up to Fired up). A raise
    // and a rested Yard day still lift a step.
    const from = {};
    const delta = {};
    for (const c of cards) { from[c.id] = c.mood; delta[c.id] = 0; }
    for (const c of lineup) if (from[c.id] === 2) delta[c.id] -= 1;
    const stretchDay = isBooking && t.booking !== null && t.booking.tier === 'stretch';
    if (isBooking && lineup.length > 0) {
      if (stars === 5) {
        for (const c of lineup) if (stretchDay || from[c.id] < 1) delta[c.id] += 1;
      } else if (stars === 4) {
        let best = lineup[0];
        for (const c of lineup) if (gains[c.id] > gains[best.id]) best = c;
        if (from[best.id] < 1) delta[best.id] += 1;
      } else if (stars <= 2) for (const c of lineup) delta[c.id] -= 1;
    }
    for (const c of resting) {
      if (!isBooking) delta[c.id] += 1;
      else {
        c.bench += 1;
        if (c.bench >= C.BENCH_STREAK) { delta[c.id] -= 1; c.bench = 0; }
      }
    }
    for (const c of lineup) c.bench = 0;
    const crewRng = mulberry32(mix32(s.seed ^ 0x43524557, s.year, s.week));
    for (const c of lineup) {
      if (from[c.id] !== -2) continue;
      const others = lineup.filter((o) => o !== c);
      if (others.length === 0) continue;
      delta[others[Math.floor(crewRng() * others.length)].id] -= 1;
    }
    const changes = [];
    for (const c of cards) {
      c.mood = clamp(from[c.id] + delta[c.id], -2, 2);
      if (c.mood !== from[c.id]) changes.push({ id: c.id, from: from[c.id], to: c.mood });
    }
    // Notice and moving on (X5.8).
    const left = [];
    const notices = [];
    for (const c of cards) {
      if (c.mood === -2) {
        if (c.notice === true) left.push(c);
        else { c.notice = true; notices.push({ id: c.id, name: c.name }); }
      } else c.notice = false;
    }
    for (const c of lineup) c.worked = Math.min(9999, c.worked + 1);
    // The till rows (X4.4): lineup first, then the rest, each in id order.
    const rows = [];
    for (const c of lineup.concat(resting)) {
      const rec = inLineupToday(c) ? t.crew[String(c.id)] : null;
      const stat = rec === null ? { plates: 0, cuts: 0, bags: 0, goodPct: 0, savedS: 0, tips: 0, hotS: 0 }
        : { plates: rec.plates, cuts: rec.cuts, bags: rec.bags, goodPct, savedS: Math.round(rec.savedS), tips: rec.tips, hotS };
      rows.push({
        id: c.id, name: c.name, role: c.role, worked: rec !== null, xpGain: rec !== null ? gains[c.id] : 0,
        xp: c.xp, banked: c.banked, moodFrom: from[c.id], moodTo: c.mood, notice: c.notice,
        line: crewLine(c, rec, stat, settled), stat
      });
    }
    if (left.length > 0) state.crew = state.crew.filter((c) => !left.includes(c));
    return { rows, left, changes, levels, notices };
  }

  // X6.2 (internal): Hiring Day opens on this morning, with a fresh pool of 18 or `restore` (a
  // validated save's hiring). `silent` (a load, X8) emits nothing.
  function openHiring(silent, restore) {
    const s = state.season;
    state.loop = 'hiring';
    state.phase = 'morning';
    s.offers = [];
    s.booking = null;
    s.addon = null;
    state.cart = { meat: zeroByMeat(), charcoal: 0 };
    const pool = restore
      ? restore.pool.map((e, idx) => {
        const stars = cardStars(e.skills);
        return { name: e.name, role: e.role, skills: e.skills.slice(), potential: e.potential, mood: e.mood, look: cleanLook(e.look),
          stars, wage: wageFor(stars, e.role), idx, status: e.status, tried: e.tried };
      })
      : genPool({ seed: s.seed, year: s.year, avoid: avoidNames() }).map((a) => Object.assign(a, { status: 'open', tried: false }));
    state.hiring = { year: s.year, round: restore ? restore.round : 1, tryouts: restore ? restore.tryouts : C.TRYOUTS, pool };
    if (!silent) emit('hiring_open', { year: s.year, n: pool.length });
  }

  // X6.2: the end of a round. Other outfits take TAKEN_PER_ROUND of the TAKEN_SHORTLIST best open
  // cards (stars + potential, then idx) by a seeded draw; then the next round.
  function endRound() {
    const h = state.hiring;
    const ro = mulberry32(mix32((state.season.seed ^ 0x52495641) >>> 0, h.year, h.round));
    const list = h.pool.filter((e) => e.status === 'open')
      .sort((a, b) => (b.stars + b.potential) - (a.stars + a.potential) || a.idx - b.idx)
      .slice(0, C.TAKEN_SHORTLIST);
    const taken = [];
    for (let k = 0; k < C.TAKEN_PER_ROUND && list.length > 0; k++) {
      const e = list.splice(Math.floor(ro() * list.length), 1)[0];
      e.status = 'taken';
      taken.push(e);
    }
    const ended = h.round;
    h.round += 1;
    emit('round_done', { round: ended, taken: taken.map((e) => e.idx), names: taken.map((e) => e.name) });
    emit('save_wanted', { reason: 'hiring' });
  }

  function poolEntry(idx) {
    if (!(typeof idx === 'number' && Number.isInteger(idx)) || state.hiring === null) return null;
    return state.hiring.pool.find((e) => e.idx === idx) || null;
  }

  function tryout(idx) {
    const no = (message) => ({ ok: false, message: message || '', potential: null });
    if (!inHiring()) return no();
    const h = state.hiring;
    const e = poolEntry(idx);
    if (e === null || e.status !== 'open' || e.tried) return no();
    if (h.tryouts <= 0) return no(STRINGS.ui.tryoutNone);
    e.tried = true;
    h.tryouts -= 1;
    emit('tryout', { idx: e.idx, name: e.name, potential: e.potential });
    return { ok: true, message: '', potential: e.potential };
  }

  function hireApplicant(idx) {
    const no = (message) => ({ ok: false, message: message || '', id: null });
    if (!inHiring() || state.hiring.round > C.HIRE_ROUNDS) return no();
    const e = poolEntry(idx);
    if (e === null || e.status !== 'open') return no();
    if (state.crew.length >= C.CREW_MAX) return no(STRINGS.ui.crewFull);   // X18.1 item 45
    const card = newCard(e, 2, true);   // Hiring Day: no signing fee, two seasons, NEW
    e.status = 'mine';
    emit('crew_hired', { id: card.id, name: card.name, role: card.role, from: 'draft', fee: 0 });
    endRound();
    return { ok: true, message: '', id: card.id };
  }

  function passRound() {
    if (!inHiring() || state.hiring.round > C.HIRE_ROUNDS) return { ok: false, message: '' };
    endRound();
    return { ok: true, message: '' };
  }

  function finishHiring() {
    if (!inHiring() || state.hiring.round !== C.HIRE_ROUNDS + 1) return { ok: false, message: '' };
    const slots = payroll().slots;
    if (state.crew.length > slots) return { ok: false, message: fillText(STRINGS.ui.tooMany, { s: slots }) };
    const s = state.season;
    state.hiring = null;
    s.drafted = true;
    emit('hiring_done', { year: s.year });
    emit('week_start', { year: s.year, week: s.week });
    startWeek();   // no rain roll: the morning already rolled (X8)
    emit('save_wanted', { reason: 'hiring' });
    return { ok: true, message: '' };
  }

  function hireWalkin(i) {
    const no = (message) => ({ ok: false, message: message || '', id: null });
    if (!inWeek() || !(typeof i === 'number' && Number.isInteger(i))) return no();
    const s = state.season;
    const w = s.walkins[i];
    if (!w || w.hired) return no();
    if (state.crew.length >= payroll().slots || state.crew.length >= C.CREW_MAX) return no(STRINGS.ui.crewFull);
    const fee = w.wage;
    const dep = s.booking !== null ? s.booking.deposit : 0;
    if (fee > state.cash || state.cash + dep - cartTotal() < fee) return no('Not enough cash');   // the R-1 rule
    state.cash -= fee;
    crewSpend.push({ name: w.name, amount: fee });
    const card = newCard(w, 1, false);   // walk-ins come trained: one season, not NEW
    w.hired = true;
    emit('crew_hired', { id: card.id, name: card.name, role: card.role, from: 'walkin', fee });
    emit('save_wanted', { reason: 'crew' });
    return { ok: true, message: '', id: card.id };
  }

  function setBring(id, on) {
    const no = () => ({ ok: false, message: '', swapped: null });
    if (!crewLoop()) return no();
    const c = findCard(id);
    if (c === null) return no();
    let swapped = null;
    let message = '';
    if (on === true) {
      const other = state.crew.find((x) => x !== c && x.bring && x.role === c.role) || null;
      if (other !== null) {
        other.bring = false;
        swapped = other.id;
        message = fillText(STRINGS.ui.oneRole, { role: STRINGS.roleName[c.role].toLowerCase(), name: other.name });
      }
      c.bring = true;
    } else c.bring = false;
    emit('bring_set', { id: c.id, bring: c.bring, swapped });
    emit('save_wanted', { reason: 'crew' });
    return { ok: true, message, swapped };
  }

  // D4.6: the v3.1 call stands Monday to Thursday; chooseDay('train') applies the same rule and ends the day.
  function train(id) {
    if (!inWeek()) return { ok: false, message: '' };
    if (state.season.day > 3) return { ok: false, message: STRINGS.ui.trainDays };
    return trainRule(id);
  }

  function trainRule(id) {
    const c = findCard(id);
    if (c === null) return { ok: false, message: '' };
    if (state.season.trained !== null) return { ok: false, message: STRINGS.ui.trainDone };
    const levels = [];
    addXp(c, C.TRAIN_XP, levels);
    for (const e of levels) emit('level_ready', e);
    state.season.trained = c.id;
    emit('trained', { id: c.id, name: c.name, xp: C.TRAIN_XP });
    emit('save_wanted', { reason: 'crew' });
    return { ok: true, message: '' };
  }

  function levelUp(id, skill) {
    const no = (message) => ({ ok: false, message: message || '', value: null });
    const okLoop = crewLoop() || (state.loop === 'report' && state.phase === 'evening');
    if (!okLoop) return no();
    const c = findCard(id);
    if (c === null || !(c.banked > 0)) return no();
    if (c.skills[0] >= c.potential && c.skills[1] >= c.potential) {
      // Both skills at potential: the level lifts the mood instead (the skill argument is ignored).
      c.banked -= 1;
      c.mood = Math.min(2, c.mood + 1);
      if (c.mood > -2) c.notice = false;
      emit('level_up', { id: c.id, name: c.name, skill: -1, value: c.mood, mood: c.mood });
      emit('save_wanted', { reason: 'crew' });
      return { ok: true, message: '', value: c.mood };
    }
    if (skill !== 0 && skill !== 1) return no();
    if (c.skills[skill] >= c.potential) return no(STRINGS.ui.atPotential);
    c.skills[skill] = Math.min(c.potential, c.skills[skill] + 0.5);
    c.banked -= 1;
    emit('level_up', { id: c.id, name: c.name, skill, value: c.skills[skill], mood: c.mood });
    emit('save_wanted', { reason: 'crew' });
    return { ok: true, message: '', value: c.skills[skill] };
  }

  function giveRaise(id) {
    if (!inWeek()) return { ok: false, message: '', wage: 0 };
    const c = findCard(id);
    if (c === null) return { ok: false, message: '', wage: 0 };
    if (c.raised) return { ok: false, message: STRINGS.ui.raiseDone, wage: c.wage };
    c.wage = Math.min(999, Math.round(c.wage * (1 + C.RAISE_FRAC)));
    c.mood = Math.min(2, c.mood + 1);
    if (c.mood > -2) c.notice = false;
    c.raised = true;
    emit('raise', { id: c.id, name: c.name, wage: c.wage });
    emit('save_wanted', { reason: 'crew' });
    return { ok: true, message: '', wage: c.wage };
  }

  function letGo(id) {
    const no = (message) => ({ ok: false, message: message || '', sendoff: 0 });
    if (!crewLoop()) return no();
    const c = findCard(id);
    if (c === null) return no();
    const sendoff = c.worked > 0 ? c.wage : 0;   // free before their first event ([S 6.6])
    if (sendoff > state.cash) return no(STRINGS.ui.sendOffCash);
    state.crew = state.crew.filter((x) => x !== c);
    state.cash -= sendoff;
    if (sendoff > 0) crewSpend.push({ name: c.name, amount: sendoff });
    if (state.hiring !== null) {
      // X18.1 item 33: a card drafted this Hiring Day signs with another outfit.
      const e = state.hiring.pool.find((x) => x.status === 'mine' && x.name === c.name);
      if (e) e.status = 'taken';
    }
    emit('crew_let_go', { id: c.id, name: c.name, sendoff });
    emit('save_wanted', { reason: 'crew' });
    return { ok: true, message: '', sendoff };
  }

  function cardView(c) {
    const eff = effectiveSkills(c);
    return Object.assign(copyCard(c), { stars: cardStars(c.skills), eff, values: curveValues(c.role, eff), levelNeed: C.LEVEL_XP });
  }

  function crewView(id) {
    if (id === undefined) return state.crew.slice().sort(byId).map(cardView);
    const c = findCard(id);
    return c === null ? null : cardView(c);
  }

  function hiringView() {
    if (state.loop !== 'hiring' || state.hiring === null) return null;
    const h = state.hiring;
    return {
      year: h.year, round: h.round, tryouts: h.tryouts, picksLeft: Math.max(0, C.HIRE_ROUNDS + 1 - h.round),
      pool: h.pool.map((e) => ({
        name: e.name, role: e.role, skills: e.skills.slice(), potential: e.tried ? e.potential : null, mood: e.mood,
        look: cleanLook(e.look), stars: e.stars, wage: e.wage, idx: e.idx, status: e.status, tried: e.tried
      }))
    };
  }

  // D9, K6, W13.2 and X11.1: always version 5. Service state, state.seats, charm, the offers and the
  // tutorial step are never saved. The season written is the one the next load should open.
  function serialize() {
    const out = { v: C.SAVE_VERSION };
    out.day = clamp(Math.trunc(state.day), 1, C.MAX_DAY);
    // W22.5: mid event the deposit is not yet paid; a reload lands on the same week's hub.
    const inEvent = state.loop === 'prep' || state.loop === 'cook';
    const cashNow = inEvent ? Math.max(0, state.cash - state.today.deposit) : state.cash;
    out.cash = clamp(Math.trunc(cashNow), 0, C.MAX_CASH);
    out.rep = clamp(Math.trunc(state.rep), 0, 100);
    out.stock = {};
    for (const m of MEAT_IDS) out.stock[m] = clamp(Math.trunc(state.stock[m]), 0, C.STEPPER_MAX);
    out.charcoal = clamp(Math.trunc(state.charcoal), 0, C.CHARCOAL_MAX);
    out.wood = clamp(Math.trunc(state.wood), 0, C.WOOD_MAX);
    out.gear = {};
    for (const g of GEAR_IDS) out.gear[g] = state.gear[g] === true;
    if (!out.gear.kettle2) out.gear.drum = false;
    out.decor = {};
    for (const d of DECOR_IDS) out.decor[d] = state.decor[d] === true;
    if (!out.decor.chair1) out.decor.chair2 = false;
    if (!out.gear.drum) out.stock.brisket = 0;
    out.stats = {};
    for (const k of STAT_IDS) out.stats[k] = clamp(Math.trunc(state.stats[k]), 0, C.MAX_STAT);
    out.drivewayShown = state.drivewayShown === true;
    out.tutorial = { done: state.tutorial.done === true };
    const s = state.season;
    // D9: in the week and mid event the save is this morning; a report save is the next morning
    // (the tick runs in finishReport()), on Sunday the next week's Monday as v3.1 did.
    const report = state.loop === 'report';
    const live = state.loop === 'week' || inEvent || (report && s.day < C.WEEK_DAYS - 1);
    let resultsIn = s.results.slice(0, C.SEASON_WEEKS);
    if (report && !live && resultsIn.length < s.week) resultsIn = resultsIn.concat([{ type: 'yard', stars: 0 }]);
    const results = resultsIn.slice(0, C.SEASON_WEEKS)
      .map((x) => ({ type: x.type, stars: x.type === 'yard' ? 0 : clamp(Math.trunc(x.stars), 1, 5) }));
    const week = live ? clamp(Math.trunc(s.week), 1, C.SEASON_WEEKS) : (results.length >= C.SEASON_WEEKS ? C.SEASON_WEEKS : results.length + 1);
    let dayOut = 0;
    let logOut = new Array(C.WEEK_DAYS).fill(null);
    if (live) {
      dayOut = clamp(Math.trunc(s.day), 0, C.WEEK_DAYS - 1);
      logOut = s.dayLog.slice(0, C.WEEK_DAYS);
      if (report) {
        logOut[dayOut] = state.today.kind === 'booking' ? 'event' : 'yard';
        dayOut += 1;
      }
      for (let i = 0; i < C.WEEK_DAYS; i++) if (i >= dayOut) logOut[i] = null;
    }
    out.season = {
      year: clamp(Math.trunc(s.year), 1, C.YEAR_MAX),
      week,
      seed: s.seed >>> 0,
      pick: live && s.booking !== null ? s.booking.id : null,
      addon: live ? s.addon : null,
      weekCash: clamp(Math.trunc(report && !live ? state.cash : s.weekCash), 0, C.MAX_CASH),
      results,
      // X11.1 and X18.1 item 31: walk-ins and the training pick only while the week is live.
      drafted: s.drafted === true,
      trained: live ? s.trained : null,
      walkins: live ? s.walkins.map((w) => ({ name: w.name, role: w.role, skills: w.skills.slice(), potential: w.potential, mood: w.mood,
        look: cleanLook(w.look), hired: w.hired === true })) : [],
      // D9: the five v3.2 day keys
      day: dayOut,
      dayLog: logOut,
      prepped: live && s.prepped === true,
      loadin: live && s.loadin === true,
      overnight: live && s.overnight !== null ? { meat: s.overnight.meat, n: s.overnight.n } : null
    };
    out.crew = state.crew.slice().sort(byId).map(copyCard);
    out.crewSeq = clamp(Math.trunc(state.crewSeq), 1, 9999);
    const h = state.loop === 'hiring' ? state.hiring : null;
    out.hiring = h === null ? null : {
      year: h.year, round: h.round, tryouts: h.tryouts,
      pool: h.pool.map((e) => ({ name: e.name, role: e.role, skills: e.skills.slice(), potential: e.potential, mood: e.mood,
        look: cleanLook(e.look), status: e.status, tried: e.tried === true }))
    };
    out.player = state.profile !== null
      ? { name: cleanName(state.profile.name, STRINGS.defaultName), look: cleanLook(state.profile.look) }
      : null;
    out.pitName = cleanName(state.pitName, STRINGS.defaultPit, C.PIT_NAME_MAX);
    out.settings = { length: C.LENGTH_ORDER.includes(state.settings.length) ? state.settings.length : 'normal' };
    return out;
  }

  // ---- assemble -----------------------------------------------------------------------------

  // W13.3 and X8: the loop comes from the validated save (deviation 37). The morning roll runs for
  // the tutorial, the creator, Hiring Day and the week; the season end card opens with no roll.
  const save = saved !== null && typeof saved === 'object' ? validateSave(saved) : null;
  fillState(save);
  if (state.tutorial.done === false) {
    state.loop = 'tutorial';
    beginMorning('tutorial');
    checkTutorial();
  } else if (state.profile === null) {
    state.loop = 'creator';
    beginMorning('creator');
  } else if ((save !== null && save.hiring !== null) || hiringOwed()) {
    // X8: a saved Hiring Day reopens with its pool; an owed one opens fresh. A load emits nothing.
    const mark = events.length;
    beginMorning('hiring');
    openHiring(true, save !== null && save.hiring !== null ? save.hiring : null);
    events.length = mark;
  } else if (state.season.results.length >= C.SEASON_WEEKS && !(save !== null && save.season.pick !== null)) {
    state.loop = 'seasonEnd';
    state.phase = 'morning';
  } else {
    state.loop = 'week';
    beginMorning('week');
    startWeek(state.season.weekCash);
    // W22.3: the saved pick and add-on come back silently when still legal.
    const s = state.season;
    const pick = save.season.pick;
    const offer = pick !== null ? (s.offers.find((o) => o.id === pick) || null) : null;
    if (offer !== null) {
      s.booking = offer;
      s.addon = save.season.addon !== null && addonLegal(offer, save.season.addon) ? save.season.addon : null;
      state.cart = prefill();
    }
    // X6.3 and X18.1 item 31: the saved walk-ins (hired flags kept) and the training pick come back
    // silently, so a reload never offers a hired walk-in again or reopens the pick.
    const savedWalkins = save.season.walkins;
    if (Array.isArray(savedWalkins) && savedWalkins.length > 0) {
      s.walkins = savedWalkins.map((w) => {
        const stars = cardStars(w.skills);
        return { name: w.name, role: w.role, skills: w.skills.slice(), potential: w.potential, mood: w.mood, look: cleanLook(w.look),
          stars, wage: wageFor(stars, w.role), hired: w.hired === true };
      });
    }
    s.trained = save.season.trained;
    // D9: the saved day of the week (a v5 or older save opens Monday).
    s.day = save.season.day;
    s.dayLog = save.season.dayLog.slice();
    s.prepped = save.season.prepped === true;
    s.loadin = save.season.loadin === true;
    s.overnight = save.season.overnight !== null && s.loadin && s.day === 5 && bookedDay() === 5
      ? { meat: save.season.overnight.meat, n: save.season.overnight.n } : null;
    if (eventPlayed()) s.offers = [];
    state.cart = morningCart();
  }

  const sim = {
    state,
    seed: seedUsed,
    step, tick, walkTo, move, interact, verbAt, holding, walkable, reach,
    selectMeat, cycleMeat, buy, canBuy, hire, sell, cartTotal, canOpen, openGate,
    continueFromTill, continueFromBroke, dismissComingNext, goal, setPaused, reset,
    drainEvents, serialize, rng, expectedCrowd,
    charm, seatBonus, seatCount, repMax, custWalkable,
    skipTutorial, tutorialStep,
    // v3.0 (W5.1)
    bookOffer, setAddon, railFor, canLoadUp, loadUp, finishReport, startSeason, seasonEndPreview,
    setPlayer, randomLook, look, setLength, fanThird, offerSlots, coolerCap, inventory, meatRoom,
    prefill, settle,
    gateWaiting,   // Q-6
    // v3.1 (X7)
    crewView, payroll, hiringView, tryout, hireApplicant, passRound, finishHiring, hireWalkin,
    setBring, train, levelUp, giveRaise, letGo,
    // v3.2 (D5)
    dayOptions, chooseDay, advanceDay, dayCardView
  };
  return sim;
}

// ---------------------------------------------------------------------------------------------
// Attach the shared surface (a double load overwrites)
// ---------------------------------------------------------------------------------------------

PitSim.C = C;
PitSim.MEATS = MEATS;
PitSim.MEAT_IDS = MEAT_IDS;
PitSim.MAP = MAP;
PitSim.CATALOG = CATALOG;
PitSim.STRINGS = STRINGS;
PitSim.createSim = createSim;
PitSim.validateSave = validateSave;
PitSim.fireBand = fireBand;
PitSim.fireMult = fireMult;
PitSim.tileOwned = tileOwned;
PitSim.SAVE_KEY = SAVE_KEY;
// v3.0 (W1): the nine new top level names
PitSim.BOOKINGS = BOOKINGS;
PitSim.BOOKING_IDS = BOOKING_IDS;
PitSim.LOOK_KEYS = LOOK_KEYS;
PitSim.LOOK_COUNTS = LOOK_COUNTS;
PitSim.DEFAULT_LOOK = DEFAULT_LOOK;
PitSim.genOffers = genOffers;
PitSim.scoreEvent = scoreEvent;
PitSim.cleanName = cleanName;
PitSim.filterName = filterName;
// v3.1 (X1): the six new top level names
PitSim.ROLE_IDS = ROLE_IDS;
PitSim.genPool = genPool;
PitSim.genWalkins = genWalkins;
PitSim.cardStars = cardStars;
PitSim.wageFor = wageFor;
PitSim.skillValue = skillValue;
// v3.2 (D1): the one new top level name
PitSim.DAY_IDS = DAY_IDS;

})();
