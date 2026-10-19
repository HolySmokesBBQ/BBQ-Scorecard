# Your Pit v3: the season design

**Date:** 2026-10-18
**Slug:** `pit-sim`, v3 round
**Builds on:** v2 at commit b48e1be in `games/pit-sim/`, plus the v2.1 build (guided tutorial, gentler burn with a warning stage, charcoal sprite) that another workflow is finishing right now. This design assumes v2.1 has landed and its tutorial exists. Nothing here edits v2.1's work; the builder starts from whatever v2.1 ships.
**Related specs:** `2026-10-18-pit-sim-design.md` (v2 design), `2026-10-18-pit-sim-v2-direction.md` (v2 calls), `2026-10-18-pit-sim-contract.md` (module contract). Those stay as written. Where this file and those disagree about v3 behavior, this file wins. Where they cover something this file does not mention (fire model, cook times, slicing, seats, tips, the 44 px and focus rules), they still hold.
**Reading this file:** every decision Joel did not make himself is marked **Overseer's call**. Every number is a starting value for the economy bot to tune unless it is marked fixed. All in-game money is game numbers, never real prices.

---

## 1. Intent

### 1.1 What Joel said, in his words

In order:

- "A BBQ sim would be cool where you upgrade your equipment with every catering event. Start with an old kettle of some kind and work your way up to a full trailer. Book catering jobs, have to buy meat and fuel."
- On the look and feel: a little walking person, and "a combination of both."
- "start in the backyard and grow to a restaurant style. Hiring helpers and workers along the way."
- "You make decisions on what to spend and what to upgrade. Need another smoker? It'll cost you. Most of those Sims are in the 8-Bit style anyway."
- On v1: "Stuff is too spaced out."
- On v2: "Game is pretty cute."
- Then: "I love the game play of Retro Bowl. But love the more modern '8-bit' style of the restaurant shown." He sent the Retro Bowl draft screen and its on-field play, and re-sent the Cafeland screenshot as the art he loves.
- The Overseer played back the v3 idea (a season of catering bookings on a calendar ending in a competition, a crew of cards with stars, a wage and a mood face under a payroll budget, gear that works like Retro Bowl's facilities, and each event as one short cook you play by hand). Joel: "I like it! Let's see how it goes."
- On how the game is reached: "I already know how i want it accessed from the website and it's the old cheat code up, up, down, down, left, right, etc."

### 1.2 The why

Joel already has the cook. v2's yard, the walking pitmaster, the fire and the seated eaters are the part he called cute. What it lacks is a reason to play the next day. Retro Bowl supplies that reason with a front office wrapped around a short hand-played match: you play the offense, and the roster, the cap, the facilities and the season happen between games and make the next game matter. Your Pit v3 does the same with a catering business. You play the cook. The bookings, the crew and the money happen between cooks, and they decide what the next cook looks like.

His original pitch already had the spine: book catering jobs, buy meat and fuel, upgrade the smoker, start with a kettle and grow to a trailer and then a restaurant, hire helpers along the way. v3 is that pitch with Retro Bowl's structure under it.

### 1.3 The references, one paragraph each

**Retro Bowl.** A season of short weekly games ending in a championship. Between games you sit on one hub with the roster, staff, facilities, free agents and the cap. Players are cards with a position tag, a rookie badge, a mood face, half-step stars and a salary. A salary cap bar forces you to choose who to keep. A three-round draft opens each season. Fan support, in thirds, pays a little after every game. Facilities are three 1 to 10 bars. On the field you only play offense, and the plan (the routes) is drawn before the snap so you execute it by hand. Games last a few minutes. That loop is what we copy. We copy structure only: no names, no styling, no pixel art from it.

**Cafeland and the Kairosoft farm sim.** The art bar. Dense, warm, angled scenes with chibi people, food bubbles, boxed floating numbers and no empty floor. Section 12 turns that into rules.

---

## 2. Goals, non-goals, anti-goals

### 2.1 Goals

1. A season you want to finish: 8 bookings and a competition weekend, about 35 to 40 minutes on a phone, with a visible goal every week.
2. A crew you care about: cards with stars, a wage and a mood face, a payroll budget that forces a choice, and helpers who get better the more they work.
3. A gear ladder you can feel: every new smoker or rung changes which bookings call and how the cook plays.
4. The cook stays the game. Every booking is played by hand, short, with the plan shown before the gate opens.
5. Something Joel can play on his Android phone at the end of every build step.
6. The game collects nothing: one localStorage key, no network, no analytics, reached by the cheat code on the website and not in the nav.

### 2.2 Non-goals

- No store, purchases, ads, accounts, cloud save, leaderboards or multiplayer.
- No landscape mode, no true isometric projection, no desktop-first layout. **Overseer's call** (see 12.1).
- No real dates, real places, real churches, real shops, team marks or brands.
- No native app packaging. The game never lives in `public/`.
- No owner who fires you, no trading people for picks, no playoff bracket, no aging decline, no injuries. These are the parts of Retro Bowl that read wrong when the players are neighbors and helpers. **Overseer's call**.
- No facility decay in this version. Retro Bowl uses decay to soak up credits; ours would be chores. Revisit only if the economy bot shows cash piling up. **Overseer's call**.
- No separate coach tier. Retro Bowl's coordinators become traits on a few crew cards. **Overseer's call**.

### 2.3 Anti-goals: how v3 fails even if it works

Each has a tripwire the builder checks. If one trips, fix it before the next step.

| Failure | What it looks like | Tripwire |
|---|---|---|
| The season is spreadsheet homework | The week screen is a wall of steppers and numbers; Joel spends longer between cooks than in them | **Two-tap week:** from the week screen, tapping the first booking offer and then Load up and go must start a cook with a cart that covers the menu, a lineup inside payroll and enough fuel. The harness checks it every step. The week screen adds no more than one new kind of number per build step and fits in two phone screens of scrolling. |
| Crew cards with no felt difference | A 1 star and a 5 star helper play the same | Every skill maps to a behavior constant (6.3). The harness runs the same seeded event with a 1 star and a 5 star card in each role and requires at least a 25 percent difference in that role's stat (plate wait, time in the fire band, slice time). Every card gets one plain line on the report saying what they did, with a number. |
| A cook that gets skipped | A "sim this event" button, or events so long or samey that the player wants one | No skip or auto-play for any event, ever. **Overseer's call**. Normal events run 125 s, the same as a v2 day. Every booking type changes at least one thing in the cook: headcount, menu, window, venue or patience. |
| Art that costs months | Systems wait on sprites; every venue needs a new map | A one-page proof comes first (12.4). Systems steps never wait on art. Venues reuse the cook kit and swap only the ground and 3 or 4 backdrop props, about 8 to 20 sprites each. The yard redraw has a budget of two build rounds; if it runs over, ship systems on v2 art and keep going. |

---

## 3. The season

### 3.1 Shape

A season is 9 weeks: 8 booking weeks and a competition weekend in week 9. **Overseer's call**: Retro Bowl runs about 17 weeks, too long for phone sessions. Weeks are named by the time of year, never by real dates.

| Week | Label on the calendar strip |
|---|---|
| 1 | Early spring |
| 2 | Spring |
| 3 | Late spring |
| 4 | Early summer |
| 5 | Summer |
| 6 | Late summer |
| 7 | Early fall |
| 8 | Fall |
| 9 | Competition weekend |

One week is one event. A week takes about 4 minutes: roughly 45 s on the week screen, 125 s of cook, 30 s on the report. A season is about 36 minutes.

**Before week 1 of season 1.** The v2.1 tutorial day comes first. It is a pre-season Yard day that is not on the 9-week strip, and it runs v2.1's flow unchanged, keeping its `#open` target and its copy. From v3.1 on, Hiring Day (6.6) comes next, then week 1. In v3.0 the tutorial day leads straight into week 1. **Overseer's call**.

### 3.2 How bookings are offered and chosen

Each week the phone rings with booking offers from a seeded generator, deterministic for a save's seed so the harness can check it.

- The number of offers depends on the fan rating third (section 9): 2 at the bottom third, 3 in the middle, 3 plus one invite at the top. The invite is the best-paying type you qualify for.
- A **Yard day** is always offered too. It is v2's open backyard: walk-ins, sales per plate, no fee. It is the bye week and the safety valve, and crew can rest on it (6.4).
- At least one offer each week is safe: your current gear covers its menu and needs. Others may be stretch bookings with a red Needs line ("Needs the drum smoker"). You can pick a stretch booking if you buy what it needs that same week.
- When cash is under 60, a Birthday is always among the offers.
- No booking type appears twice in one week. When fewer types are unlocked than there are offer slots, as in early season 1, the phone shows fewer cards. The Yard day card is always there, and the Birthday rule above still applies. The invite is the highest-fee unlocked type whose gear needs you already meet. The first card is a safe offer and comes preselected. Offers are generated per week from the save seed. **Overseer's call**.
- A booking pays a **deposit** of 30 percent of the fee, so a player short on cash can still buy the meat. The rest pays after the event. **Overseer's call**.
- You can switch between offers freely until Load up and go. The deposit is credited at that moment, the same point where v2 charges the cart, and the cart's affordability check counts the selected offer's deposit. After Load up and go the other offers are gone. If you choose a stretch booking without buying its Needs, Load up and go is disabled with the Needs line as the reason. **Overseer's call**.

### 3.3 Booking types

Fees come from one formula so the builder can add types without hand-tuning: fee = guests x the average v2 sell price of the asked meats x 1.25, rounded to 5. v2 plate prices: sausage 5, chicken 8, ribs 11, pulled pork 14, brisket 18. That holds food cost near 25 to 30 percent of the fee at full pay.

Window is how long the gate is open in a Normal event (v2: gate at 30 s, last call at 110 s, an 80 s window). Patience is the guest wait before walking out (v2 base 45 s, spread 10).

| Booking | Guests | Menu asks | Fee | Venue | Window | Patience | Difficulty | Unlocked by |
|---|---|---|---|---|---|---|---|---|
| Birthday | 12 | sausage, chicken | 100 | Backyard | 60 s | 45 s | 1 flame | start |
| Church picnic | 20 | chicken, pulled pork | 275 | Church lot | 80 s | 50 s | 2 flames | start |
| Block party | 16 | sausage, ribs | 160 | Backyard | 80 s | 40 s | 2 flames | Driveway rung |
| Park reunion | 18 | chicken, ribs | 215 | Park | 80 s | 45 s | 2 flames | fan rating 34 |
| Tailgate | 24 | ribs, sausage | 240 | Tailgate lot | 60 s | 35 s | 3 flames | Driveway rung and fan rating 34 |
| Wedding | 30 | brisket, pulled pork | 600 | Wedding barn | 80 s | 55 s | 3 flames | Driveway rung, drum, canopy, fan rating 50 |
| Homecoming | 40 | chicken, pulled pork, brisket | 665 | Church lot | 90 s | 50 s | 3 flames | Trailer rung and fan rating 67 |
| Yard day | walk-ins | your pick | per plate | Backyard | v2 rules | v2 rules | 1 flame | always |
| Competition | judges | four turn-ins | prize by placing | Competition grounds | see 3.5 | none | 3 flames | week 9 |

The Birthday's window was 80 s until playtest round 3, where the twelve guests left half the cook idle; at 60 s it is a short, dense easy week that still fits one kettle. **Overseer's call** (contract W26 Q-5).

Rules for every booking:

- Guests arrive in parties of 1 to 4 on a fixed arrival curve across the window, front-loaded a little so the opening rush is real. The total equals the headcount. This replaces v2's rep-driven arrival rate for bookings. **Overseer's call**.
- Guests only order meats on the booking's menu, and the add-on meat counts as on the menu. At bookings, v2's hands rule (a guest orders what you are carrying) picks only from menu meats. **Overseer's call**.
- Each booking lets you add one meat of your choice that your gear can cook. 25 percent of guests, rounded, order the add-on; the rest split evenly over the asked meats, and the ticket rail and the cart prefill both follow that split. If no burnt plate of the add-on is served, the host pays a Menu bonus of 10 percent of the fee, shown as its own line among the tips. (A tenth of the tips would be 1 or 2 coins, and the choice would mean nothing.) The econ bot tunes both numbers. That is the "set the menu" decision. **Overseer's call**.
- Until a booking's venue is built (section 15), it plays in the backyard. That is how Church picnic ships in the first step.
- Rain falls only on Yard days, where it cuts walk-ins as in v2. Bookings have a fixed headcount and no rain. The canopy keeps its Yard day effect and stays a Wedding requirement. **Overseer's call**.
- Difficulty flames summarize headcount per second of window and patience. They are not a separate setting.
- From season 2, headcount and fees rise 10 percent per season, capped at plus 30 percent. After 3 events in a row at 5 stars, the next week's offers include one picky host (patience minus 10 s, fee plus 20 percent). After 3 in a row at 2 stars or less, the next week offers one easy host (patience plus 10 s). That is Retro Bowl's difficulty swing, made visible on the card. **Overseer's call**. Yard days are skipped when counting either streak: they neither break one nor add to it. **Overseer's call**.

### 3.4 Event length setting

Like Retro Bowl's quarter length, a settings toggle sets event length. Headcount scales with the window so the pressure stays the same.

| Setting | Event length | Window | Headcount factor |
|---|---|---|---|
| Short | 90 s | 55 s | 0.7 |
| Normal (default) | 125 s | 80 s | 1.0 |
| Long | 160 s | 105 s | 1.3 |

How the setting meets booking windows and the pre-gate time. **Overseer's call**:

- The gate always opens at 30 s, plus DRIVE Road seconds once that role exists.
- A booking's window is its Normal window x (the setting's window / 80). A Tailgate on Short gets 60 x 55 / 80, about 41 s.
- Headcount is the booking's guests x the setting's factor, rounded.
- The event ends at the setting's hard end, or sooner by v2's early end rule.
- The competition always runs 180 s and ignores the setting.
- Until v3.2 builds the competition, v3.0's Season finale ignores the setting too: it runs 160 s with a 105 s window at Normal's headcount, so a 5 meat, 40 guest rail can finish. **Overseer's call** (contract W26 Q-2).
- The toggle sits in a Settings row at the bottom of the week screen (4.2).

### 3.5 The championship: a competition BBQ weekend

Week 9 is always a competition. You never miss the finale; your fan rating picks which one invites you. **Overseer's call**. Copy says "competition BBQ", never a sanctioning body's name.

| Contest | Fan rating | Turn-in categories | Entry | 1st | 2nd | 3rd | Field |
|---|---|---|---|---|---|---|---|
| Backyard Open | 0 to 33 | chicken, sausage, ribs, pulled pork | 20 | 200 | 120 | 80 | 10 teams |
| Regional Cook-off | 34 to 66 | chicken, ribs, pulled pork, brisket | 50 | 500 | 300 | 150 | 10 teams |
| Invitational | 67 to 100 | chicken, ribs, pulled pork, brisket | 100 | 1200 | 600 | 300 | 10 teams |

How it plays:

- A 180 s cook at the Competition grounds. No customers, no seats. A judges' turn-in window replaces the serving table.
- Four turn-in times at 45, 85, 125 and 165 s, shown on the ticket rail from the first second.
- You cook each category, slice it at the board and carry the box to the window before its time. Crew still work: FIRE holds the fires, PREP slices, RUN carries a finished box you leave on the board.
- Each box scores 0 to 100. Doneness 50: full in the done band, 0 if raw or burnt, sliding between. Hold 30: full if pulled within 15 s of turn-in, minus 2 a second after. Look 20: sliced at the board 20, unsliced 10. A missed window scores 0.
- Brisket needs the drum or better. Without it the brisket box scores 0, which is a reason to buy the drum.
- The other 9 teams get seeded scores: mean 60 per box at the Backyard Open, 70 at the Regional, 80 at the Invitational, spread 10.
- Results: overall placing by total, plus a ribbon for each category you won. Top 3 adds 10 to fan rating. A first place puts a trophy on a shelf on the shed wall in the yard, one per win, up to 6.

The rest of the competition rules. **Overseer's call**:

- Turn-ins follow the table's category order: the first category at 45 s, the second at 85, the third at 125, the fourth at 165.
- A box is one cooked piece, sliced or unsliced.
- The Hold clock counts from when the piece comes off the grate.
- The competition is not starred. A top 3 finish moves mood like a 4 star event; any other finish moves no mood. XP is earned as usual.
- The entry fee is paid at Load up and go. The cart comes prefilled with one unit of each category's meat plus a spare of each. Daily costs and wages apply.

### 3.6 Season end and what carries over

After the competition comes the Offseason screen, then the new season opens with Hiring Day (6.6), the way Retro Bowl rolls into the draft.

The Offseason screen, top to bottom: the season record (9 boxes with stars and the placing), the trophy shelf, contracts ending (re-sign or let go, 6.7), who is moving on (6.8), the Coming next card (the next rung and its price), and Start season N.

| Carries over | How |
|---|---|
| Cash | all of it |
| Gear, rungs, decor, Prep Station and Crew Tent levels | all of it |
| Crew | cards under contract stay with their stars, XP and mood; mood moves 1 step toward 0 |
| Fan rating | starts the new season at the larger of 20 and 75 percent of where it ended. **Overseer's call**: something to climb each spring, never back to zero |
| Meat in the cooler | spoils over the offseason; charcoal and wood keep |
| Trophies, ribbons, lifetime stats | all of it |
| Season number | plus 1; drives the scaling in 3.3 |

**Season end in v3.0.** Until v3.2 builds the Offseason screen, a season end card follows week 9. It shows the 9-box record, applies the carry-overs above that already exist in v3.0 (cash, gear, fan rating at the larger of 20 and 75 percent, meat spoils, charcoal keeps), then starts season 2 with the same booking pool. Season scaling arrives in v3.2. **Overseer's call**.

---

## 4. The week screen

### 4.1 What it is

The v2 morning clipboard, re-sorted. Same panel system and helpers (`mk`, `cartRow`, `ownRow`, `hireRow`), same 44 px buttons and focus rules, portrait, 480 px max width. A DOM panel over the yard, not a new canvas scene.

### 4.2 Layout, top to bottom

1. **Top line:** Week 3 of 9, cash, the fan rating bar in thirds.
2. **Calendar strip:** 9 boxes. Done weeks show their client stars, upcoming weeks a small icon, week 9 a trophy.
3. **The phone rings:** the offer cards plus the Yard day card. Each shows name, venue icon, guests, menu meat icons, fee, deposit, difficulty flames and a Needs line. Tap to choose; the chosen card gets an orange frame. From v3.3 the week's one choice card also sits here (4.4).
4. **Crew:** the lineup as a row of small cards (portrait, role, stars, face, wage), each with a Bring or Rest toggle, and the payroll bar ("PAYROLL 38 / 60"). Buttons for the Crew sheet (the full roster, let go, walk-ins) and Train.
5. **Menu and cart:** the asked meats with plate counts prefilled from guests (split as in 3.3, plus 10 percent spare), the add-on meat picker, and v2's meat and fuel steppers prefilled to cover it. A wood splits stepper (3 each) joins the charcoal one once you own the stick burner or the trailer rig. One line under them: "Covers 22 plates. Costs 74."
6. **Gear:** a button to the Gear sheet (7.5), with a dot when something new is affordable.
7. **Load up and go.**
8. **Settings:** the event length toggle (3.4).

Defaults are always sane: the first safe offer is preselected, last week's lineup carries, the cart is prefilled. That is what makes the two-tap week work.

### 4.3 The decisions

| Decision | Where | What it costs | What it changes |
|---|---|---|---|
| Book | The phone rings | nothing; the deposit comes in | which cook you play and what it pays |
| Set the menu | Menu and cart | the add-on meat | tip bonus, what guests order |
| Buy meat and fuel | Menu and cart steppers | cash at v2 prices | whether you run out mid-cook |
| Bring or rest crew | Crew row | wages only for crew who work | who helps; mood (6.4) |
| Hire | Crew sheet, walk-ins | a signing fee of one event's wage, then the wage | a new card |
| Let go | Crew sheet | one event's wage as a send-off | frees a slot and payroll |
| Train | Train button | free, one a week | the chosen card gets 40 XP before the event, more with Prep Station |
| Upgrade gear | Gear sheet | cash at catalog price | slots, bookings, rungs |

Training is one pick a week: you show one helper the ropes. **Overseer's call**: Retro Bowl's training is a light, medium or hard regime; one pick is a smaller decision with the same reward.

### 4.4 Choice cards (from build step v3.3)

At most one card before an event and one after it. **Overseer's call**: Retro Bowl reviewers' most common complaint is repeating event cards, so the pool is large and no card repeats within a season.

- **Before (the phone rings again):** two choices, each with a plain cost and effect. Examples: the host wants more brisket (add 4 brisket plates to the menu for plus 40 fee); a neighbor complains about smoke (pay 15, or lose 3 fan rating); a helper asks for the day off (they rest at no mood cost, or come and drop a mood step).
- **After (the host's feedback):** one card with two choices drawn from options like these. Praise the crew (plus 1 mood to the card with the most XP), thank the regulars (plus 2 fan rating), or blame the fire (the FIRE card drops a mood step and the next event's patience rises 5 s). Hosts are fictional, first name only.
- Pool: at least 12 before and 12 after when the system ships, at least 24 of each by v3.6. Each card carries conditions (rung, venue, season) so the pool feels bigger than it is.

---

## 5. The cook: the offense

### 5.1 What stays from v2

Everything the player does by hand: tap-to-walk, tap a station, light and feed the fire with charcoal, put meat on, pull it, slice at the board, carry plates, seats, tips, the v2.1 burn warning, sold out, the dog. No new hero verb in v3. **Overseer's call**: the Retro Bowl research suggested a drag-to-serve verb, but v2.1's tutorial teaches tap controls and Joel called the game cute as it plays. Add a drag verb only if Joel says the cook feels passive.

### 5.2 The plan before the snap

Retro Bowl draws the routes before the snap. Your Pit shows the tickets before the gate. In v2's 30 s before the gate opens, a ticket rail sits across the top of the canvas, for example "20 guests: 10 chicken, 10 pulled pork", with a counter per meat that ticks down as plates go out. During those 30 s you light fires and put meat on, as in v2. The rail stays up all event. On Yard days the rail shows plates sold per meat and no targets. **Overseer's call**.

### 5.3 What the crew does on their own

The crew are v2's buddy and tender AI turned into roles, with stars tuning the constants. RUN and FIRE need no new behavior code in the first crew step.

| Role | Badge | Does on their own | v2 source |
|---|---|---|---|
| Pit hand | FIRE | keeps every cooker above their threshold while fuel is in the pile; adds wood on the stick burner and trailer | `tickTender` |
| Server | RUN | carries plates from the board to the table | `tickBuddy` |
| Prep cook | PREP | slices meat you drop on the board, so you go straight back to the fire | new and small: v2's slicing action run by an NPC |
| Driver | DRIVE | sets up off-site: more pre-gate time, and more decor charm carried to the venue | new, setup only, no in-cook AI |
| Till | TILL | (Restaurant rung) takes orders at the counter so guests wait less | later |

The pitmaster can always do every job. Crew take jobs off your hands; they never lock you out of one.

A FIRE card works from the first kettle, before the drum is bought. Rungs gate only DRIVE and TILL (7.1), and the Church picnic example in 10.2 brings RUN and FIRE to a backyard job. `tickTender` already loops over every active cooker, so cards drop v2's drum check. `validateSave` keeps that check only for a legacy v2 tender hire that has not been migrated yet (6.10).

### 5.4 Scoring: client stars

After last call and the last plate, the host rates the event from a 100 point score.

| Part | Points | Full marks when |
|---|---|---|
| Fed | 60 | every booked guest got a plate (scales with guests fed of booked) |
| Wait | 20 | average wait 20 s or less, 0 at 60 s; a walk-out counts as 60 s |
| Quality | 20 | no burnt pieces; minus 4 per burnt piece served or thrown out, minus 2 per plate of a meat not on the menu |

| Score | Client stars |
|---|---|
| 90 and up | 5 |
| 75 to 89 | 4 |
| 60 to 74 | 3 |
| 40 to 59 | 2 |
| under 40 | 1 |

Pay after the event = fee x (0.5 + 0.1 x stars), less the deposit already paid, plus tips and seat tips as v2 computes them. One star pays 60 percent of the fee, three pays 80, five pays 100. Booked guests pay nothing per plate; the fee is the pay, and per-plate revenue applies only on Yard days. The minus 2 for off-menu plates stays in the scoring code as a guard, though with the hands rule limited to menu meats (3.3) it will rarely fire.

Yard days are not starred. They pay per plate as in v2 and move fan rating by v2's per-serve rules.

**Amended after playtest round 1 (2026-10-19, v3.0 contract W24).** Quality scales with the share of booked guests fed, and a booked plate served 30 s or more after it was sliced costs 2 quality points. Pay after the event is fee x (0.3 + 0.14 x stars): one star pays 44 percent, three 72, five 100. A booking whose rail needs more grate time than the owned cookers give before last call is a stretch with a Needs line (the one kettle Church picnic: "Needs a second kettle."). **Overseer's call.**

---

## 6. The crew

### 6.1 The card

Copied in structure from the Retro Bowl draft screen, in our palette, in portrait. A DOM element with a small canvas for the portrait; the visual spec is in 12.3.

- Role badge top left: FIRE, PREP, RUN, DRIVE, TILL.
- A NEW badge under it during a card's first season (Retro Bowl's rookie R).
- Mood face top right, 5 states (6.4).
- A composited pixel bust portrait.
- First name only, from one fixed list of plain invented first names. Never a real person, never a character from another Holy Smokes property.
- Overall stars, 1 to 5 in half steps. Hollow stars show potential once a tryout reveals it.
- Wage as a coin icon and a number, "/ event".
- A contract chip: "2 SEASONS" or "1 SEASON".
- From v3.6, a trait line on some 4 star and better cards.

### 6.2 Skills and stars

Each role has two skills, each 1 to 5 in half steps. Overall stars are the average, rounded down to the half. **Overseer's call**: two skills give a level-up a real choice without a stat sheet.

### 6.3 What stars do: the felt difference

Each skill moves one v2 constant piecewise linearly: from its 1 star value to its 3 star value, then from its 3 star value to its 5 star value. The 3 star value is the v2 number, so a 3 star card plays exactly like today's buddy or tender.

| Role | Skill | Moves | 1 star | 3 stars (v2) | 5 stars |
|---|---|---|---|---|---|
| FIRE | Fire sense | the fire level they keep cookers above | 45 | 55 | 65 |
| FIRE | Pace | seconds between checks | 5.0 | 4.0 | 2.5 |
| RUN | Speed | walk speed, tiles a second | 3.5 | 4.0 | 5.5 |
| RUN | Friendliness | handle pause on every carry, and seat tip bonus | 0.6 s, +0% | 0.4 s, +10% | 0.2 s, +40% |
| PREP | Knife | slice time as a share of yours | 1.4x | 1.0x | 0.6x |
| PREP | Pace | walk speed, tiles a second | 3.5 | 4.0 | 5.5 |
| DRIVE | Road | extra pre-gate seconds at off-site venues | 0 | 8 | 20 |
| DRIVE | Load | extra decor items whose charm travels | 0 | 1 | 2 |
| TILL | Speed | seconds to take one order at the counter | 3.0 | 2.0 | 1.0 |
| TILL | Friendliness | counter tip bonus | +0% | +10% | +40% |

v2's NPC walk speed is `C.NPC_TILES_PER_S = 4` in sim.js, so the 3 star RUN Speed and PREP Pace are 4.0. v2 has no counter order step, so TILL's numbers are starting values for v3.7, mirroring RUN's tip bonus. **Overseer's call**.

**RUN Friendliness.** It sets the RUN card's handling pause on every carry (0.6, 0.4 and 0.2 s; v2's `BUDDY_HANDLE` is 0.4). The FIRE card keeps v2's 0.4. Its seat tip bonus applies to seat tips on plates the RUN carried, a small new perk. v3.1 adds no seat delivery, so RUN still needs no new behavior code (5.3). **Overseer's call**.

**How the 25 percent check measures (2.3).** Same seed, same scripted player, one card changed between a 1 star and a 5 star run. FIRE: seconds each active cooker spends with fire between `FIRE_GOOD` and `FIRE_HOT`, summed over cookers. RUN: average plate wait. PREP: total slice time. If a role cannot reach 25 percent, widen its 1 and 5 star values and keep 3 stars at the v2 number. **Overseer's call**.

Mood adds to both skills during the cook (6.4). The report gives each card one line with a number, built from what they did: "Maya kept the drum above 61 all day." "Theo ran 22 plates." "Rosa sliced 9 cuts and saved you 40 seconds."

### 6.4 Mood

| Mood | Face | Effect on both skills during a cook |
|---|---|---|
| +2 Fired up | grin | +0.5 star |
| +1 Happy | smile | none |
| 0 OK | flat | none |
| -1 Grumpy | frown | -0.5 star |
| -2 Done | red frown | -1 star, and gives notice |

The effective skill is clamped to 1 through 5 after mood is added. **Overseer's call**.

What moves mood, applied after each event, clamped to -2 and +2:

| Cause | Change |
|---|---|
| Event scored 5 stars | +1 to everyone who worked it |
| Event scored 4 stars | +1 to the card with the most XP this event |
| Event scored 2 or 1 stars | -1 to everyone who worked it |
| Rested on a Yard day | +1, more with the Crew Tent (7.4) |
| Left home on booked events two weeks running | -1 (they want their reps) |
| A mid-contract raise (+20 percent wage) | +1 |
| A card at -2 worked this event | -1 to one other card at random, unless a Peacemaker is on the crew |
| Host feedback choices | as printed on the card |

A card at -2 after an event hands in notice: a line on the next week screen says they leave after the next event unless their mood rises. The player gets one week to fix it. **Overseer's call**: no surprise walk-outs.

### 6.5 Wages, the payroll budget, roster slots

Wages are paid per event worked; resting crew cost nothing that week. **Overseer's call**: Retro Bowl pays salaries regardless, but here leaving your 5 star pit hand home for a small birthday is a real choice with a mood cost.

Wage by overall stars, before the role factor:

| Stars | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 |
|---|---|---|---|---|---|---|---|---|---|
| Wage | 10 | 13 | 16 | 20 | 24 | 29 | 34 | 40 | 46 |

Role factor: FIRE x1.25, DRIVE x1.1, everyone else x1.0, rounded. A 3 star FIRE asks 30 (v2's tender) and a 2.5 star RUN asks 20 (v2's buddy). Pit hands cost more, the way quarterbacks do.

The payroll budget caps the summed wages of everyone you bring to one event. It rises only with your business rung, never by paying for it. Roster slots cap how many cards you hold.

| Rung | Payroll budget | Roster slots |
|---|---|---|
| Backyard | 60 | 2 |
| Driveway pop-up | 90 | 3 |
| Trailer rig | 140 | 4 |
| Restaurant | 220 | 6 |

The bar reads "PAYROLL 38 / 60": yellow fill, orange past 80 percent, red past 95. Load up and go is disabled with a plain reason when the lineup is over budget. At the backyard a 5 star FIRE (58) eats nearly the whole budget, so you cannot also bring a good server. That is the cap doing its job.

### 6.6 Hiring: Hiring Day and walk-ins

**Hiring Day** opens every season, including season 1, before week 1. In season 1 it follows the v2.1 tutorial, so the first card you pick is your first real decision. **Overseer's call**.

- The pool is 18 applicants on 2 pages of 9 in a 3 by 3 grid, "PAGE 1/2".
- 3 rounds, one pick each, plus one extra pick per referral (6.8). You may pass a round.
- After each round, 3 pool cards are marked "hired elsewhere" and greyed out: other outfits pick too. That is the tension Retro Bowl's rival teams create. **Overseer's call**.
- 2 tryouts per Hiring Day (plus 1 at Prep Station level 3, plus 1 with a Talent Eye on the crew). A tryout reveals a card's potential as hollow stars.
- Pool cards are 1 to 3 stars with potential 2 to 5, weighted toward roles your rung can use. Hiring Day hires are NEW, pay no signing fee and sign for 2 seasons at the table wage. Signing fees apply only to walk-ins and Crew sheet hires (4.3), which matters because season 1 starts with 80 cash.
- A full roster can still draft; you then let someone go before week 1. Letting go a card that has not yet worked an event costs no send-off, so a season 1 draft never eats the starting 80 cash. **Overseer's call**.

**Walk-ins:** each week 2 walk-in cards appear on the Crew sheet (3 in the top fan third). They come trained (2 to 4 stars), cost a signing fee of one event's wage and sign for 1 season. They leave the list at the end of the week.

### 6.7 XP, levels, contracts

- XP comes from work done: RUN 3 per plate, PREP 3 per cut sliced, FIRE 1 per fuel add plus 10 per cooker held above threshold for the whole service, DRIVE 15 per off-site event. Training gives 40.
- A level costs 200 XP and adds half a star to one skill of the player's choice, up to potential. Potential caps each skill; the card shows it as hollow overall stars. A busy young card gains about one star a season. **Overseer's call**.
- A level the player doesn't take on the report stays banked on the card and can be spent later from the Crew sheet, several at once. **Overseer's call**.
- The card's detail sheet has a Give a raise button, once per contract: +20 percent wage and +1 mood (6.4). **Overseer's call**.
- When both skills are at potential, a level gives +1 mood instead.
- Contracts run 1 or 2 seasons. At the Offseason screen each expiring card asks for the table wage at their current stars. Re-sign or let go. A card at +2 mood asks 10 percent less.

### 6.8 Moving on, never aging

Helpers do not age or get hurt. After their third season with you, each card has a 25 percent chance per offseason to move on, and the Offseason screen gives one plain reason per card, drawn from a short fixed list (for example, starting school). A card that leaves at mood 0 or better refers a friend: one extra Hiring Day pick of at least their stars minus 1. A card that walks at -2 refers nobody. This keeps Retro Bowl's dynasty arc (rookie, star, gone) without an aging penalty. **Overseer's call**.

### 6.9 Traits (v3.6)

Some 4 star and better cards carry one trait, shown as a plain line. **Overseer's call**: traits replace Retro Bowl's coordinators.

| Trait | Effect |
|---|---|
| Regulars' Favorite | +1 fan rating after any 4 or 5 star event they work |
| Steady Hand | cookers they tend burn 20 percent slower past done |
| Peacemaker | a card at -2 cannot drag anyone else down |
| Talent Eye | +1 tryout on Hiring Day |
| Quick Hands | carries 2 plates without the tray |

### 6.10 Migrating v2 hires

A v2 save with the buddy becomes a 2.5 star RUN card (Speed 2.5, Friendliness 2.5, wage 20, potential 4, 1 season). A tender becomes a 3 star FIRE card (Fire sense 3, Pace 3, wage 30, potential 4, 1 season). Names are drawn from the list once and saved. Neither carries NEW. Buddy plus tender is 50, inside the backyard budget of 60.

In v3.0, before crew cards exist, v2's buddy and tender hire rows and wages (20 and 30) stay as they are, paid per event worked on the report. v3.1 migrates them as above. **Overseer's call**.

---

## 7. Facilities and gear: the ladder

### 7.1 The rungs Joel described

Joel's ladder runs from kettle to trailer and from backyard to restaurant. Business rungs carry it; cookers are the steps within it. Each rung changes which events you can take and how the cook plays.

| Rung | How you get it | Cookers it can run | Payroll / slots | Bookings it opens | How the cook changes |
|---|---|---|---|---|---|
| Backyard | start | kettle, second kettle, drum | 60 / 2 | Birthday, Church picnic, Yard day | v2 as it is |
| Driveway pop-up | buy for 400; needs the drum and fan rating 34 | adds the cabinet, then the stick burner | 90 / 3 | Block party, Tailgate, Wedding; Yard days become Driveway days | Driveway days get 30 percent more walk-ins; a fold-out counter adds 2 table spots; the stick burner brings wood splits |
| Trailer rig | buy the trailer rig cooker (7.2) | adds the trailer rig | 140 / 4 | Homecoming; the DRIVE role | off-site setup from the trailer; a warmer box holds 4 finished cuts for 30 s without drying |
| Restaurant | buy for 6000; needs the trailer rig, fan rating 67 and one trophy | a pit room with 2 cooker bays and a walk-in cooler | 220 / 6 | Restaurant nights plus all catering | the TILL role; a restaurant night is a 160 s service of walk-in diners at the counter and tables |

The Restaurant rung is the top of the ladder. Joel set that himself: "start in the backyard and grow to a restaurant style." It is planned here and built last (section 15). Its details (nightly service, TILL, the pit room) wait until Joel has played v3.6; nothing before v3.7 depends on them. Starting values so the econ bot can price the rung until then: a restaurant night pays per plate at v2 prices with the fan rating tip multiplier (9), walk-in diners arrive at 1.5 times the Driveway day rate, and Daily costs are 30 a night. **Overseer's call**.

v2's goal card ("Driveway pop-up", 1000, "The next rung") becomes the first real rung at 400. **Overseer's call**: 1000 was a placeholder; 400 lands late in a steady season 1 or early in season 2 (10.3). The Coming next card points to the Driveway rung at 400. From v3.0 the goal row shows 400 and stays a goal line only; v3.3 makes it buyable. The econ bands in 10.3 for a rung or cooker are enforced from the build step that ships it. **Overseer's call**. v2's `GOAL_ORDER` keeps its buddy step until v3.1 replaces that step with Hiring Day. **Overseer's call**.

### 7.2 Cookers: the quarterback

A better smoker is what a better quarterback is in Retro Bowl: more slots, a steadier fire, more you can attempt. This is the one place v3 goes past Retro Bowl, and it is the reason the game exists.

| Cooker | Price | Grate slots | Fuel | Fire behavior | Takes brisket | Needs |
|---|---|---|---|---|---|---|
| Kettle | owned | 2 | charcoal | v2 | no | nothing |
| Second kettle | 90 | 2 more | charcoal | v2 | no | nothing |
| Drum | 280 | 4 | charcoal | holds heat longer (v2) | yes | second kettle |
| Cabinet | 450, with half the drum's price back as a trade-in | 6 | charcoal | holds heat longest; slow to recover once low | yes | drum and the Driveway rung |
| Stick burner | 800, with half the cabinet's price back as a trade-in | 8 | wood splits, 3 each, +40 fire a split | burns hot and fast, wants feeding about every 12 s; a 3 star or better FIRE makes it steady | yes | cabinet |
| Trailer rig | 1600, with half the stick burner's price back as a trade-in | 10, plus the warmer box | wood splits | stick burner behavior plus the warmer box | yes | stick burner; buying it moves you to the Trailer rung |

**The big-cooker bay. Overseer's call.** The kit has three cooker footprints: kettle1 at (5,2), kettle2 at (7,2) and the two-tile drum at (7,3) to (7,4). The drum's footprint becomes the big-cooker bay and upgrades in place: drum, then cabinet, then stick burner, then trailer rig. Both kettles stay. Each bay upgrade gives back half the replaced cooker's price, the trailer's trade-in applied to every step, and the econ bot re-tunes the prices. Grate slots come to 2 + 2 + the bay, so you never manage more than three fires. Where 7.1 says a rung adds a cooker, it means the bay may now hold it. Each bay cooker is one sprite set and one STATIONS row. Charcoal stays at v2's 2 a bag.

### 7.3 The service kit and curb appeal

v2's gear and decor carry on unchanged in price and effect: cooler 60, bigger table 70, serving tray 50, canopy 80, and the six decor items with their charm. Charm still lifts seat tips and the fan rating cap per event. Charm from the two highest-charm decor items you own counts at every venue (it rides in the truck), since saves don't record purchase order; a DRIVE card's Load skill adds more. Until venues ship in v3.5 every event plays in the backyard, so all charm counts. The decor sprites only show in your own yard. **Overseer's call**. Curb appeal stands in for Retro Bowl's Stadium.

### 7.4 Prep Station and Crew Tent

Two 1 to 5 bars on the Gear sheet, standing in for Retro Bowl's Training and Rehab. Level 1 is free. The next level costs its number x 50 (level 2 is 100, level 5 is 250). One upgrade a week across both bars. No decay.

| Level | Prep Station | Crew Tent (shade and a cooler of drinks) |
|---|---|---|
| 1 | nothing extra | Yard day rest +1 mood |
| 2 | +10% XP | same as level 1 |
| 3 | +20% XP, +1 tryout | Yard day rest +2 mood |
| 4 | +30% XP, training gives 60 | 4 star events give +1 mood to everyone who worked |
| 5 | +40% XP, training gives 80 | 2 star events cost no mood |

### 7.5 The Gear sheet

Three short ladders in the same card frame as the crew: Smokers, Service kit and decor, Crew facilities. Each item shows its price, its effect in one line, its Needs line and a Buy button. Selling back at half price stays on the Broke card only, as in v2.

---

## 8. The post-event report

The v2 till with a header and a crew block. Every money row is already computed in v2's `state.today`.

1. **Header:** event name, venue, the host's first name, client stars large.
2. **Result line:** "Guests fed 18 of 20. 1 walked out. Average wait 24 s."
3. **Money:** Fee at 4 stars, less the deposit, Tips, Menu bonus, Seat tips, Food cost, Charcoal and wood, Wages, Daily costs, Spoiled, Thrown out, Left on the grate, Burnt, Take today, Cash. Yard days keep v2's rows.
4. **Crew:** one row per card that worked: portrait, mood face with an arrow if it moved, XP bar, the one line of what they did, and a Level up button when earned (a two-choice skill pick).
5. **Fan rating:** from and to on the thirds bar, with the reason ("4 star event +4").
6. **Host feedback card** (from v3.3).
7. **Next week.**

---

## 9. Fan rating

The v2 word of mouth number (`state.rep`, 0 to 100), with the UI label kept as "Word of mouth" so the v2.1 tutorial text still matches. **Overseer's call**. It shows as a bar in thirds.

| Third | Range | Offers a week | Tip multiplier | Unlocks |
|---|---|---|---|---|
| Neighbors | 0 to 33 | 2, plus Yard day | 1.0 | Birthday, Church picnic; Backyard Open |
| Word's out | 34 to 66 | 3, plus Yard day | 1.15 | Driveway rung, Park reunion, Tailgate; Wedding at 50; Regional Cook-off |
| In demand | 67 to 100 | 3 and an invite, plus Yard day | 1.3 | Homecoming, the Restaurant rung, Invitational; 3 walk-ins a week |

How it moves after a booking:

| Client stars | 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|---|
| Fan rating | +6 | +4 | +2 | -2 | -5 |

Plus Regulars' Favorite, host feedback choices and the competition top 3 bonus. v2's per-event clamp with charm still caps the gain from one event. Yard days move it by v2's per-serve rules. A steady 3 star player starting at 20 crosses 34 around week 7 of season 1. **Overseer's call**: 3 stars has to move the needle a little, or a steady player never sees a new booking.

---

## 10. The economy

### 10.1 Money in and out

One spend currency, cash, and one ceiling, the payroll budget. No second token. **Overseer's call**: Retro Bowl runs cap dollars and coaching credits side by side; with cash, payroll and fan rating already on screen, another number would be homework. Add one only if Joel says spending feels flat.

| In | Out |
|---|---|
| Deposits and fees, by client stars | Meat and fuel at v2 prices |
| Tips and seat tips | Wages for crew who work |
| Yard day plate sales | Daily costs, 10 per event (v2) |
| Competition prizes | Gear, rungs, Prep Station, Crew Tent |
| | Signing fees, send-offs, competition entry |

### 10.2 Worked examples at 3 stars (starting values)

| Booking | Pay at 3 stars | Tips | Meat | Fuel | Daily | Wages | Net |
|---|---|---|---|---|---|---|---|
| Birthday, one 2.5 star RUN | 80 | 10 | 30 | 10 | 10 | 20 | +20 |
| Church picnic, RUN and FIRE | 220 | 15 | 70 | 20 | 10 | 50 | +85 |
| Tailgate, 3 crew | 192 | 15 | 72 | 20 | 10 | 70 | +35 |
| Wedding, 3 crew | 480 | 25 | 174 | 30 | 10 | 75 | +216 |

At 5 stars each pays the full fee and roughly doubles the net. At 1 star the Birthday loses about 10: a bad week, never a ruined save.

### 10.3 The pacing target, checked headless

`dev/econ.mjs` grows a season bot that plays whole seasons in Node with no browser. It picks offers, buys a covering cart, hires to the budget, and buys the next item on a fixed upgrade order (second kettle, drum, tray, cooler, Driveway, canopy, cabinet, Prep Station 2, stick burner, trailer rig; the canopy sits after the Driveway because Wedding needs it). Three policies force a client star result per event instead of playing the cook:

| Policy | Stars every event | Owns the drum by | Reaches the Driveway rung by | Can afford the trailer rig by | Restaurant by |
|---|---|---|---|---|---|
| Sharp | 5 | season 1 week 4 | season 1 week 9 | end of season 2 | end of season 3 |
| Steady | 3 | season 1 week 8 | season 2 week 4 | end of season 3 | season 4 or 5 |
| Rough | 2 | end of season 2 | end of season 3 | not required | not required |

Two global rules for every policy, over 5 seasons and 50 seeds:

1. **Never stuck:** cash is never below the cheapest booking's meat cost two weeks in a row, and the Rough bot can always take a Birthday or Yard day without going under 0.
2. **Never idle:** at no season end does any bot hold more than 2 times the price of the next thing it has not bought whose non-cash needs are met. Cash always has somewhere to go.

**Yard days in the bot. Overseer's call.** Under these bands the Rough bot loses 2 fan rating on every 2 star booking and could never reach the 34 the Driveway needs. So the season bot plays Yard days with v2's econ day model, which earns per-serve fan rating, and Rough takes a Yard day whenever its rating is below the next gate. If Rough still misses its band, tune the 2 star fan move (a starting value) and leave the band alone.

`node dev/econ.mjs --season --seeds 50` prints the median week each milestone is reached per policy and exits non-zero outside the bands. The bands are the contract. Every price and fee in this file is a starting value the bot may move.

### 10.4 The v3.0 built result (2026-10-18, integration)

Run: `node games/pit-sim/dev/econ.mjs --season` (50 seeds, 5 seasons, Normal length), against the v3.0 `sim.js` with every `C` value at its contract starting value (nothing tuned). Exit 0.

| Policy | Stars | Owns the drum (median) | Band | Driveway affordable (median, information until v3.3) | Band | Stuck | Idle |
|---|---|---|---|---|---|---|---|
| Sharp | 5 | S1W4 | S1W4 | S1W8 | S1W9 | 0 of 50 | 0 of 50 |
| Steady | 3 | S1W6 | S1W8 | S2W4 | S2W4 | 0 of 50 | 0 of 50 |
| Rough | 2 | S1W9 | S2W9 | S2W9 | S3W9 | 0 of 50 | 0 of 50 |

Rough never ended an event under 0. Median cash at each season end: sharp 1002, 2590, 4178, 5766, 7354; steady 364, 1200, 2036, 2872, 3708; rough 278, 573, 1025, 1522, 1974. Season 1 cash and word of mouth after each week (median): sharp ends week 9 at 1002 and 74, steady at 364 and 38, rough at 278 and 30.

How the bot spends (contract W23 I-2): it walks the gear rows of the order (kettle2, drum, tray, cooler, canopy, bigtable) with W22.19's continue rule, and opens the decor stage only once all six are owned, the way the v2 bot bought decor only once gear was covered. With the decor stage open from week 1 (W20 read literally), sharp spends about 610 on cheaper gear and every decor piece while the drum is out of reach, and its drum median lands at S1W6, two weeks past the band (steady S1W8, rough S2W2, both inside). No allowed `C` value moves sharp two weeks; `FEE_MULT` would, but it would also pull steady and rough far ahead of their targets.

What the numbers say for later rounds:

- After the drum, v3.0 has nothing left to buy: sharp holds 7354 by the end of season 5. "Never idle" passes only because it is checked while something unbought exists. The Driveway (400, buyable in v3.3) and the v3.1 payroll are the sinks this needs.
- Rough reaches the drum in season 1 because it plays Yard days while word of mouth is under 34, and a well run Yard day moves word of mouth up to 12. Its band (end of season 2) is loose by a full season.
- Played tick by tick (not settled), big bookings lose guests at the gate: the line holds 3, and late guests give up at last call. The Sim builder's competent bot fed 9 of 20 at a Church picnic on one kettle and 24 to 26 of 40 at the Season finale with two kettles (3 or 4 stars). That is the W7.2 and W7.3 rule as built; it is the first thing to check in Joel's v3.0 playtest.

The day runs (`node games/pit-sim/dev/econ.mjs`, Yard days through the week hub, seeds 1 to 8, 25 events) buy the second kettle on event 3 or 4, the drum on event 10 to 12, and reach the driveway price on event 18. No seed went broke.

### 10.5 Playtest round 1 result (2026-10-19)

Run: `node games/pit-sim/dev/econ.mjs --season` (50 seeds, 5 seasons, Normal), after the W24 fixes of the v3.0 contract: the grate time test (the one kettle Church picnic is a stretch), quality by the share fed and cold plates, pay at 0.3 + 0.14 per star, the take after what the cook used, no spare without a cooler, gear bought leaning on the deposit, and the bot buying gear strictly in order and picking again after it spends. Exit 0.

| Policy | Stars | Owns the drum (median) | Band | Driveway affordable (median, information until v3.3) | Band | Stuck | Idle |
|---|---|---|---|---|---|---|---|
| Sharp | 5 | S1W4 | S1W4 | S1W9 | S1W9 | 0 of 50 | 0 of 50 |
| Steady | 3 | S1W5 | S1W8 | S2W7 | S2W4 | 0 of 50 | 0 of 50 |
| Rough | 2 | S1W7 | S2W9 | S4W7 | S3W9 | 0 of 50 | 0 of 50 |

Median cash at each season end: sharp 885, 2473, 4061, 5649, 7237; steady 301, 746, 1361, 1976, 2591; rough 151, 198, 356, 545, 745. Steady and rough reach the Driveway price later than their v3.3 bands; that is for the v3.1 payroll and v3.3 tuning. Long length passes; Short misses sharp's drum band by a week, as it did before the round.

### 10.6 Playtest round 2 result (2026-10-19)

Run: `node games/pit-sim/dev/econ.mjs --season` (50 seeds, 5 seasons, Normal), after the W25 fixes of the v3.0 contract: `sim.canBuy` (the second kettle's Buy no longer greys out on the deposit), a board of one 14 plate stack per meat, the Season finale sized to the owned grate (9 guests on one kettle, 25 on two, 40 with the drum, at Normal), the drum second in the goal order, and 6 prefill bags a cooker at Normal (scaled by the length). Exit 0.

| Policy | Stars | Owns the drum (median) | Band | Driveway affordable (median, information until v3.3) | Band | Stuck | Idle |
|---|---|---|---|---|---|---|---|
| Sharp | 5 | S1W4 | S1W4 | S1W9 | S1W9 | 0 of 50 | 0 of 50 |
| Steady | 3 | S1W5 | S1W8 | S2W8 | S2W4 | 0 of 50 | 0 of 50 |
| Rough | 2 | S1W7 | S2W9 | S4W9 | S3W9 | 0 of 50 | 0 of 50 |

Median cash at each season end: sharp 839, 2373, 3907, 5441, 6975; steady 282, 668, 1229, 1790, 2351; rough 233, 200, 326, 471, 622. Long passes. Short misses sharp's drum band by a week as before and now puts rough under 0 in 3 of 50 seeds (1 before), because its two kettle finale is smaller. **Overseer's call** (W25): the finale's 40 guests in section 15 hold only with the drum; without it the finale books what the grate can cook, and the card and Pit news say what the drum would make of it.

**Overseer's call** (W26, playtest round 3): the finale was still the worst cook of a good season, because booked guests gave up at last call while the grate had plates coming, and the 125 s day was too short for a 5 meat, 40 guest rail. Booked guests now wait at the gate until the hard end, and the finale runs 160 s with a 105 s window at any length (3.4). Results in 10.7.

### 10.7 Playtest round 3 result (2026-10-19)

Run: `node games/pit-sim/dev/econ.mjs --season` (50 seeds, 5 seasons, Normal), after the W26 fixes of the v3.0 contract: booked guests waiting until the hard end, the 160 s finale at any length (16 guests on one kettle, 33 on two, 40 with the drum), the Birthday's 60 s window, the pick carried from last week and the Driveway card held until v3.3. Exit 0.

| Policy | Stars | Owns the drum (median) | Band | Driveway affordable (median, information until v3.3) | Band | Stuck | Idle |
|---|---|---|---|---|---|---|---|
| Sharp | 5 | S1W4 | S1W4 | S1W9 | S1W9 | 0 of 50 | 0 of 50 |
| Steady | 3 | S1W5 | S1W8 | S2W8 | S2W4 | 0 of 50 | 0 of 50 |
| Rough | 2 | S1W7 | S2W9 | S4W9 | S3W9 | 0 of 50 | 0 of 50 |

Median cash at each season end: sharp 827, 2361, 3895, 5429, 6963; steady 295, 656, 1217, 1778, 2339; rough 221, 200, 314, 459, 610. Long passes. Short misses sharp's drum band by a week and puts rough under 0 in 3 seeds as before, and now leaves rough stuck in 2 seeds (its season start spending after the larger Short finale); Normal is the canonical run.

The finale played tick by tick by the econ competent bot over seeds 1 to 10: 36.3 of 40 fed at 4.5 stars with the drum, 39.0 at 5.0 with the drum and the bigger table, 30.0 of 33 at 4.9 on two kettles. A slowest meat first bot gets 2.2, 3.9 and 3.4 stars on the same three. The Birthday feeds 12 of 12 at 5 stars and ends at 98.6 s on one kettle (106.6 before); the Church picnic on two kettles feeds 18 of 20 at 5 stars.

### 10.8 The v3.1 built result (2026-10-19, integration)

Run: `node games/pit-sim/dev/econ.mjs --season` (50 seeds, 5 seasons, Normal), against the v3.1 `sim.js` and the X16 bot of contract `2026-10-19-pit-sim-v3-1-contract.md`: it drafts the best FIRE card in round 1 and the best RUN card in round 2 of Hiring Day, brings FIRE from the week the cooler is owned and RUN from the week the drum is owned with 200 at week start, rests everyone on Yard days, gives a raise or lets go a card with notice, trains the lowest id card each week and spends every banked level. Every `C` value is at its contract starting value except `SKILL_CURVE.fireSense` at 1 star, 45 to 40 (X18.1 item 48), which no settled event reads. Exit 0.

| Policy | Stars | Owns the drum (median) | Band | Driveway affordable (median, information until v3.3) | Band | Stuck | Idle | Wages, share of pay and tips (seasons 2 to 5) |
|---|---|---|---|---|---|---|---|---|
| Sharp | 5 | S1W3 | S1W4 | S1W6 | S1W9 | 0 of 50 | 0 of 50 | 10.1 percent (455 of 4488 a season) |
| Steady | 3 | S1W5 | S1W8 | S2W4 | S2W4 | 0 of 50 | 0 of 50 | 16.6 percent (464 of 2784) |
| Rough | 2 | S1W6 | S2W9 | S3W2 | S3W9 | 0 of 50 | 0 of 50 | 15.4 percent (301 of 1950) |

Payroll stayed inside the 60 budget at every event (the largest lineup cost exactly 60), and rough never ended an event under 0. Median cash at each season end: sharp 1530, 4271, 7007, 9670, 12492 (v3.0: 827, 2361, 3895, 5429, 6963); steady 319, 1247, 2335, 3339, 4352; rough 201, 519, 1017, 1560, 2096. Season 1 over 50 seeds: no card moved on under any policy; steady paid 7 send-offs and hired 3 walk-ins, sharp hired 1 walk-in. Steady reaches the Driveway price a week late (S2W5) in 9 seeds, information until v3.3.

Short and Long pass every enforced check. Short: drum medians S1W4, S1W7, S1W8; sharp's band now holds at Short, which v3.0 missed by a week, and rough is never under 0 or stuck there (v3.0 had 3 and 2 seeds). Long: S1W3, S1W4, S1W5. The day runs (`node games/pit-sim/dev/econ.mjs`, seeds 1 to 8) buy the second kettle on event 3 or 4 and the drum on event 10 (13 on seed 2), hire the best RUN walk-in on event 8, reach the Driveway price on event 17 or 18, and never go broke.

The Birthday played tick by tick by the competent bot (no crew), seeds 1 to 8: every guest fed at 5 stars, and the longest empty line while food was cooking and guests were still to come is 2.95 s (v3.0: 7.1 to 12.5 s). The felt-difference check of the harness (X15.3), 1 star against 5: FIRE kept kettle 1 in the good band 59.95 s against 95.05 s (1.59 times); RUN set down 4 plates in 10 s against 8, fed 2 guests in 4 s against 3, and the waiting guests' mean wait was 3.8 s against 2.0 s; PREP sliced two pieces in 10.85 s against 4.9 s.

What the numbers say:

- Wages are paid every week, but they do not end the hoard: sharp holds more than in v3.0 (12492 against 6963 by season 5). The stretch card (up to 1.4 times the guests at 1.15 times the pay) and the thirds' pay (1.1 and 1.2 on the fee) earn more than two cards' wages, because `settle()` feeds every guest whatever the size. The Driveway (v3.3) is still the sink this needs.
- The eager policy (information, X18.1 item 47: steady stars, the Hiring Day lineup brought to every booking from week 1) is never stuck and never under 0, but its cash stays flat (season ends 129, 130, 127, 139, 158), it never owns the drum in five seasons at Normal, and wages take 40.7 percent of its pay and tips. The bot settles at a fixed 3 stars, so it pays the wages and counts nothing the crew adds to the cook. Joel playtest watch item: whether bringing both cards to every early Birthday feels like a trap.

The four v3.0 playtest items, as built (contract X17): (1) each booking type rotates its menu pair every week, one card is a STRETCH (the gear stretch, or a drawn card sized up to the grate at full load, 5 s less patience, one more flame, 15 percent more pay) and the other a SAFE BET sized 0.8 to 1.0 of the base, so weeks 2 to 8 always show two different cards; (2) the hub's third line says what the current third brings, the middle third pays a tenth more on the fee, the top third a fifth more plus a repeat invite card and a third walk-in, and the report adds the host's third line and a line when a third is crossed; (3) booked guests pull forward after 3 s of an empty line while food cooks (the 2.95 s above); (4) the report's money table shows six to nine rows with every v3.0 row one tap away under Show every row, and the two crew row booking report fits two phone screens (1535 of 1624 px in the harness).

### 10.9 v3.1 review round 1 (2026-10-19)

The round 1 findings on v3.1 were applied (contract `2026-10-19-pit-sim-v3-1-contract.md`, X20). The numbers that moved: `fireSense` at 5 stars 65 to 88 and the FIRE card's walk following Pace (3.5 to 5.5 tiles a second); a new RUN curve `runTip` (-0.25, 0, 1.0 on the plate tip of every plate the RUN card carries) and one more seat tip coin from 4 stars; `LEVEL_XP` 200 to 120; FIRE XP 3 a bag and 15 a cooker held (was 1 and 10); `STRETCH_SIZE` 1.4 to 1.2, `STRETCH_MIN` 1.15 to 1.1, `STRETCH_PAY` 1.15 to 1.1, and the stretch is now always the best paying card. The payroll budget stays 60: at the review's 50 the sharp policy's wages fell to 7.8 percent of its pay and tips, under the 8 percent floor (X20.13).

`node games/pit-sim/dev/econ.mjs --season`, Normal, 50 seeds, 5 seasons, exit 0 (every enforced check, the new "stretch pays the most" check included; Short and Long pass too):

| Policy | Stars | Owns the drum (median) | Band | Driveway affordable (information) | Stuck | Idle | Wages, share of pay and tips (seasons 2 to 5) |
|---|---|---|---|---|---|---|---|
| Sharp | 5 | S1W4 | S1W4 | S1W7 | 0 of 50 | 0 of 50 | 10.2 percent (461 of 4525) |
| Steady | 3 | S1W5 | S1W8 | S2W4 | 0 of 50 | 0 of 50 | 16.2 percent (467 of 2880) |
| Rough | 2 | S1W6 | S2W9 | S2W9 | 0 of 50 | 0 of 50 | 16.1 percent (320 of 1992) |

Median cash at each season end: sharp 1523, 4180, 6843, 9568, 12265; steady 317, 1259, 2288, 3412, 4454; rough 195, 563, 1075, 1668, 2261. The eager policy (information) is unchanged in kind: never stuck, cash flat near 130 to 151, never owns the drum, wages 41.0 percent of its pay and tips; the hub now names the lineup and its wages next to the pay, and the report gives wages their own row, so the cost of bringing both cards to an early Birthday is on screen.

The felt-difference check now also plays whole bookings (X20.10), 1 star against 5 with the player leaving that role's job to the card: RUN tips on its plates 62 against 126; FIRE mean wait 8.76 s against 6.23 s; PREP mean wait 4.2 s against 2.71 s. The staged legs stand (FIRE 59.5 against 95.05 good seconds; RUN plates in 10 s 4 against 8; PREP 10.85 s against 4.9 s).

Watch items for Joel's playtest: whether the payroll bar ever forces a choice in season 1 (it binds once a walk-in or a level lifts a card past 3 stars); the player's idle time with a crew working (55 to 65 percent of an early Birthday in the review), a tuning item for the Days build ([S 19.6]).

---

## 11. Save

- One key, `hs.pitsim.save`, and one validator that accepts every older version and always returns the newest, clamped field by field. The game still collects nothing and makes no request.
- The v3 version number is whatever v2.1 ships plus 1. sim.js on disk already has `C.SAVE_VERSION` 3 (v2.1; v2 was 2), so v3 writes `v: 4`, and `validateSave` accepts 1 to 4 and always returns 4. Recheck the disk at build time in case v2.1 changes.
- New fields: `season` (`{ year, week, offers, booking, results[] }`), `crew[]` (`{ id, name, role, skills[2], potential, xp, mood, wage, contract, seasons, rookie, trait }`), `poolSeed`, `rung`, `prepLevel`, `tentLevel`, `trophies[]`, `settings.length`.
- From v2 or v2.1: cash, rep, stock, charcoal, gear, decor and stats carry over. The save starts at season 1, week 1. A player who already has hires skips Hiring Day in season 1; everyone else gets it. Hires become cards per 6.10. game.js keeps its `parsed.v` check to show the update notice and write once.
- Service state is never saved. Saves happen on the week screen and the report, as v2 does on morning and evening.

---

## 12. Art direction

### 12.1 The pick: hybrid oblique on the existing grid

**Overseer's call**, pending Joel's yes on the proof screen.

Joel's references pull two ways: Retro Bowl's chunky screens and Cafeland's smooth angled room. Both sims he praised use an angled view. True isometric would match them best, but on a portrait phone an 11 by 11 diamond yard gives tap targets about 18 CSS px tall and means rewriting most of the render and input code. So: keep the orthogonal 3/4 grid, sim.js, the BFS, tap mapping and the y-sort exactly as they are, and draw the angle into the art. Boxy props get a top face, a front face and a narrow right side face receding up and to the right at a 2:1 slope. The patio becomes a diamond paver pattern like Cafeland's floor. The house and back fence become a back wall with thickness, and the left fence a receding side wall, so the yard reads as the corner of a room. People keep down, up and side facings.

Portrait stays. **Overseer's call**: Joel plays portrait on his Android phone and v2 is portrait. Retro Bowl's card screen is landscape; ours becomes the 3 by 3 grid in 12.3.

The management screens borrow Retro Bowl's grammar only: bold flat panels, card grids, one fill bar, a chunky pixel font for numbers. The world borrows Cafeland's density and warmth, with white food bubbles over guests and boxed floating numbers like the farm sim's.

### 12.2 "Modern 8-bit" as nine rules

1. Pixel art, nearest-neighbor, at 32 px tiles. One art pixel lands near 1.1 CSS px on a 1080-wide phone: visible if you look, read as detail.
2. A 4-tone ramp per material (highlight, base, shade, outline), hue shifted: warm purple-brown shadows, yellow-leaning highlights.
3. Selective outlines: each object's outline is the darkest tone of its own ramp. Near black is kept for eyes and burnt meat.
4. Light from the top left: a 1 px rim on top-left edges and a shade band on bottom-right edges, applied by an automatic pass so every sprite agrees.
5. Chibi people at 32 by 48 with a head about 20 px tall, 2 by 3 eyes with a white catch-light, a 4-frame walk, a 2-frame idle bob and a blink.
6. One `obliqueBox(w, h, depth, ramp)` helper draws every boxy prop, so the angle never drifts.
7. Alpha where it earns it: soft ellipse shadows near 30 percent, smoke at 50 to 70 percent, 1 px specular streaks on lids and counters.
8. The palette grows from 31 colors to about 60 plus alpha entries, keeping the 4 site tones (near black, umber, cream, orange) as fixed anchors. Recheck against `website/DESIGN.md` when Marketing finalizes the rebrand palette.
9. A chunky pixel font for numbers, with white food bubbles and framed item cards.

### 12.3 Engine fit and the crew card visual

**Integer scale.** Lock the map at 11 tiles wide, 352 virtual px. The existing D13 integer rule then gives k = 3 on 1080-wide phones (1056 device px), k = 2 on 720 and k = 4 on 1440, with tiles about 36 CSS px, larger than v2's 30. The phone gutter drops from 8 CSS to 4. Do not move to 24 px tiles or a wider map; both break the fit.

**Engine change.** Render TILE becomes 32, with one S = 2 multiplier on game.js's hard-coded pixel positions (hand overlays, gauges, cues, floating numbers, rings). sim.js keeps its 16 px space untouched. Cache the static ground in its own canvas. Budget `build()` at 150 ms or less on Joel's phone.

**Authoring.** Layered parametric pixel art: Grid primitives draw flat material shapes, then automatic passes add outline, shade and rim. Small hand string grids (a 64-char alphabet) only for faces, hands, icons and the font. People and portraits come from a parts compositor: 3 body templates by 5 poses, then hair, shirt, apron and skin recolors. No RLE; gzip handles size. The `PitSim.art` surface (build, draw, drawScaled, canvasFor, text, textTinted) keeps its shape.

**Crew card.** Umber #2a2015 screen background. Header "HIRING DAY" in the pixel font with small flame ornaments, and "PAGE 1/2". Cards about 112 by 156 CSS in 3 columns on a 412-wide phone, 2 columns under 360. A 3 px cream (#E6D8B8) frame with a 1 px outline-brown edge and a woodD #7a4a26 body with a lighter inner bevel, so it reads as a wooden menu board. The top 40 percent is a band colored by role, with the portrait standing on a 1 px floor line.

| Role | Band | Badge text |
|---|---|---|
| FIRE | orange #D06129 | umber |
| PREP | lawnB #4fa83d | umber |
| RUN | clothD #3a86c8 | cream |
| DRIVE | woodM from the palette | cream |
| TILL | yellow #ffd84a | umber |

Every badge and label is checked at 4.5:1 contrast; cream on orange or yellow fails, so those take umber. The NEW badge is cream on umber. The mood face is 9 by 9, yellow with an outline-brown edge, the Done state red-tinted. The portrait is a 32 by 32 bust shown at 2x, built from about 25 small parts (face shapes, skin ramps, hair styles and colors, hats, shirt by role, beard, mustache, glasses) using the in-yard body palette, so a hire looks like themselves in the yard. Stars are yellow with outline-brown edges, empty stars smokeD. The bottom bar has the PAYROLL bar (cream frame, yellow fill on near black), a CREW button, HIRES LEFT and an orange next arrow. Tapping a card opens a detail sheet: 4x portrait, the two skill bars, the trait line, wage, contract, HIRE and PASS. Built in DOM like the clipboard and till, CSP-clean, no inline script, no new storage key.

### 12.4 The proof screen: show Joel this first

One phone-portrait dev page, `games/pit-sim/dev/look-proof.html`, built only after v2.1 has landed, never wired into the game and never deployed to the site.

- **Top:** the v2 yard's first 7 rows in the new look at 352 by 224 virtual px, k = 3: the shed wall with depth, the lit kettle with smoke and a glossy lid, the drum, the red cooler, the cutting board, the counter run, one picnic table, the hedge row, diamond pavers and string lights.
- **Life:** the pitmaster walks on tap (a local copy of the BFS on that slice, no sim). Two guests sit eating. One white order bubble shows a rib plate icon. One boxed "+5" floats up.
- **Bottom:** three crew cards in DOM (a FIRE, a RUN and a NEW PREP) with mood faces and the payroll bar.
- **A "v2 / new" toggle** swaps the yard back to today's art on the same rows, so Joel judges against what he already called cute.
- **Scope:** about 25 sprite names and 60 frames.
- **Pass bar:** Joel says yes to the angle, the detail, the head-to-body size and the card style; 55 to 60 fps on his phone; an integer k with tiles at least 34 CSS; every card label legible at arm's length; the side face's 8 px spill into the next tile draws correctly against a walker beside the counter and the table.
- **Delivery:** 1080-wide screenshots via SendUserFile and a private Artifact link so he can tap it live on Android. One yes or no question: "Is this the look?" If no, the systems steps carry on in v2 art while the look is reworked.

### 12.5 Venues

Every venue keeps your cook kit (pile, kettles, drum and up, cooler, board, counter and their use tiles) at the same tiles in rows 1 to 6. **Overseer's call**: that keeps the route table, the cook-loop distances and every harness tap the same. A venue changes only the ground tileset, the customer half (rows 6 to 12: seats, queue, entrance, decor spots) and 3 or 4 backdrop props.

| Venue | Ground | Backdrop props | First booking |
|---|---|---|---|
| Backyard | v2 lawn and pavers | v2 | Birthday, Yard day |
| Church lot | asphalt | fellowship hall wall, steeple, folding tables | Church picnic |
| Park | grass | pavilion, trees, a grill stand | Park reunion |
| Tailgate lot | striped asphalt | pickup tailgates, cones, no team marks | Tailgate |
| Wedding barn | gravel and grass | barn wall, arch, round tables, string lights | Wedding |
| Competition grounds | grass and gravel | tent row, judges' turn-in window, flags | Competition |

Calendar and offer card icons: picnic basket, birthday cake, pennant, wedding arch, trophy, and a house for the Yard day. No real churches, parks, teams, shops or brands.

---

## 13. The website entrance: the cheat code

Joel's call: "the old cheat code up, up, down, down, left, right, etc." typed on the website opens the game. It is not in the nav. Copy never names where the code comes from.

### 13.1 Who owns what

- The **Website session** owns the door script, the site page tags, the `scripts/assemble-dist.mjs` lines, `netlify.toml` and every deploy.
- The **game session** owns `games/pit-sim/` and adds two things to its own `index.html`: the robots meta tag and a `?v=` on its three script tags.
- Neither edits the other's files. All messages go through the Security auditor.

### 13.2 The door script

- Path `website/public-landing/door.js`. Never `public/`, which is copied into every native app bundle and would put the game path inside the APKs.
- `assemble-dist.mjs` copies it to `dist/door.js` with one named line, gated behind `SHIP_PIT=1`.
- Loaded with `<script src="/door.js?v=1" defer></script>` on `index.html`, `pit.html`, `episodes.html` and `about.html`. All four pages are in `website/public-landing/` (checked 2026-10-18). Not on 404, not in the apps, not on the board-cities or calculator-guests SEO pages.
- A `[[headers]]` block for `/door.js` with `Cache-Control: no-cache`, after the `*.js` immutable block, the way `site-fx.js` is handled.
- An IIFE in strict mode, under 2 KB, no inline code, no eval, no globals. It never touches `dataLayer` or `gtag`, sends nothing and stores nothing.

### 13.3 Keyboard path (desktop)

- One passive `keydown` listener on `document` that never calls `preventDefault`, so arrow-key scrolling keeps working.
- Ignore the key if `e.repeat` or `e.isComposing`, if ctrl, meta or alt is held, or if the target is inside `input`, `textarea`, `select` or `[contenteditable]`.
- Arrows by `e.key`; letters by `e.key.toLowerCase()`.
- Sequence: ArrowUp, ArrowUp, ArrowDown, ArrowDown, ArrowLeft, ArrowRight, ArrowLeft, ArrowRight, b, a. That is Joel's "etc." read in full. No Start key.
- A rolling buffer of the last 10 accepted inputs. If more than 1500 ms passed since the previous input, clear it before adding. Compare after each push. A third ArrowUp at the start needs no special case.

### 13.4 Touch path (phones; Joel's path)

Joel plays on Android with no arrow keys, so a keyboard-only door would lock him out of his own game.

- Passive `touchstart`, `touchend` and `touchcancel` on `document`.
- Single finger only. Ignore a gesture if a second finger lands, or if it starts inside `a`, `button`, `input`, `select`, `textarea`, `label`, `summary`, `video`, `[role=button]` or an open dialog (the pit.html lightbox).
- At `touchend`: a **swipe** moved 40 CSS px or more on its long axis, at least 1.5 times the short axis, in 700 ms or less, with direction from the sign. A **tap** moved under 10 px both ways in 300 ms or less. Anything else clears the buffer.
- Swipes map to the four arrows. A tap counts as b, the next as a, so the sequence ends with two taps. On a phone the whole code is: swipe up, up, down, down, left, right, left, right, then tap twice.
- Same 1500 ms gap rule and the same buffer.
- Known behavior: the vertical swipes scroll the page. On Chrome Android a down swipe at the very top of a page triggers pull-to-refresh; passive listeners cannot stop it, and `overscroll-behavior` on `html` would change the whole site. The two up swipes first usually move the page off the top. Tell Joel to start partway down a page.

### 13.5 On success

Set a fired flag, remove the listeners, and `location.assign('/yourpit/')`: a hard-coded same-origin path with no query string, no data, no popup and no animation.

### 13.6 The unlisted game path

- Served at `/yourpit/`. `assemble-dist.mjs` copies exactly four named files from `games/pit-sim/` into `dist/yourpit/` behind `SHIP_PIT=1`: `index.html`, `sprites.js`, `sim.js`, `game.js`. Never copy the folder, so `dev/` can never ship. Nothing of the game goes in `public/`. Do not reuse `/game`; Hold 225 was unwound in f9a53be.
- `netlify.toml`: a 301 from `/yourpit` to `/yourpit/` (required, because the scripts load by relative `./` paths), and a `[[headers]]` block for `/yourpit/*` with `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-cache`, after the `*.js` block.
- The game's `index.html` gets `<meta name="robots" content="noindex, nofollow">`, and its script tags carry `?v=<game version>`, bumped every release.
- No sitemap entry, no nav or footer link, and no `robots.txt` Disallow, which would advertise the path and stop crawlers from reading the noindex.
- The game page loads no `gtm-init.js` and no `site-fx.js`.
- Exclude `/yourpit/*` from the geo-region edge function so the page sets no `hs_geo` cookie.
- CSP fit: same-origin external scripts with no inline script, no handler attributes and no eval fit `script-src 'self'`. The game's `<style>` block and `element.style` writes fit `style-src 'unsafe-inline'`. Canvas only, no fetch, no XHR. A top-level page, so `frame-ancestors 'none'` is fine. localStorage works.

### 13.7 The Security auditor's checklist

(a) door.js is same-origin, inline-free and eval-free, stores and sends nothing, and fires no analytics event. (b) Navigation goes only to the literal `/yourpit/`. (c) Listeners are passive, never call `preventDefault`, trap no focus, and fire nothing inside form fields. (d) `dist/yourpit/` holds exactly four files after `build:all`. (e) The CDP request log on the game page shows only those four files. (f) One localStorage key; `validateSave` clamps hostile JSON and survives cyclic input. (g) noindex header and meta; absent from sitemap, nav and robots.txt. (h) No edge cookie on `/yourpit/*`. (i) The trailing-slash redirect works and `/yourpit/index.html` loads. (j) Cache headers and the `?v=` bump. (k) Copy scan per section 14; the page title is YOUR PIT and the footer says game numbers. (l) Unlisted is not access control: anyone who reads door.js finds the path, so the page must be safe for anyone. (m) `npm run check:deploy` after the deploy.

### 13.8 When the door ships

After Joel has played v3.0 on his phone and the auditor's checklist (13.7) passes. **Overseer's call**. Until then, Joel plays each build through a private Artifact link. A save made there lives in that page's own storage and does not carry to `/yourpit/`; the site game starts a fresh save, and the game adds no export or import to bridge them. After the door ships, each game step deploys by bumping `?v=`, batched with other site deploys to save Netlify credits.

---

## 14. Copy and privacy rules for every step

- No em or en dashes. No "not just X but Y". No rule-of-three lists in player-facing copy. No hype.
- Smokers are kettle, drum, cabinet, stick burner, trailer rig, and nothing else.
- "Competition BBQ", never a sanctioning body's name.
- No real brands, shops, churches, teams or prices. Money is game numbers with a coin icon and no currency sign.
- Nothing implying Holy Smokes sells sauce or food.
- Crew and host names are plain invented first names from one fixed list in sim.js. No real people, and no characters from other Holy Smokes properties, including the Striker character.
- No invented first-person lines from Joel anywhere in the game.
- No "injured", "toxic" or aging language. Crew get tired, grumpy, or move on.
- The game collects nothing: one localStorage key, no network, no analytics of its own.

---

## 15. Build order

Each step is one or two build rounds, ends with something Joel plays on his Android phone, and passes the harness and the anti-goal tripwires before the next step starts. Sizes: S under about 200 lines, M 200 to 600 plus harness, L a refactor across modules. **Overseer's call** on the order and the version numbers.

| Step | Name | What ships | Size | What Joel plays |
|---|---|---|---|---|
| M0 | Look proof (parallel track) | `dev/look-proof.html` per 12.4 | M, art | one page; answers "Is this the look?" |
| v3.0 | Season | `state.season`; the 9-week strip; 2 or 3 offers a week from Birthday and Church picnic (both in the backyard) plus Yard day; the deposit; booked headcount and menu replacing rep arrivals; the ticket rail; client stars and the fee on the report; fan rating thirds setting the offer count; the event length setting; the tutorial day before week 1 (3.1); week 9 as a Season finale booking (40 guests split evenly over every meat your gear can cook, brisket only with the drum, fee from the 3.3 formula) until v3.2 builds the competition; the season end card (3.6); save migration; the econ season bot | M | a season in his own yard with a goal every cook |
| v3.1 | Crew cards | buddy and tender become cards; RUN, FIRE and PREP; two skills with stars tuning the constants in 6.3; mood; wages per event worked; the payroll bar and roster slots; Hiring Day with 18 applicants, 3 rounds, other outfits and tryouts; walk-ins; the train pick; XP and the level-up choice; crew rows on the report; the 1 star vs 5 star harness check | L sim, M UI | drafts a crew and feels the difference |
| v3.2 | Competition and offseason | turn-in mode (in the backyard until the grounds are drawn); the three contests; rival seeds; the trophy shelf; the Offseason screen with contracts, moving on and referrals; season 2 scaling and the difficulty swing | L | a full season with a real finale, then season 2 |
| v3.3 | Ladder and choice cards | the Gear sheet as three ladders; the cabinet; the Driveway rung at 400; Block party, Park reunion, Tailgate and Wedding (in the backyard for now); Prep Station and Crew Tent; before and after choice cards, 12 of each | M | spending decisions that open new bookings |
| v3.4 | New look in the yard | if M0 got a yes: sprites v3, the yard and every v3.0 to v3.3 sprite redrawn to parity, the S = 2 render change, the 4 CSS gutter; rules unchanged | L, art; budget two rounds | the same game in the new look |
| v3.5 | Venues | MAP becomes VENUES with the kit fixed; Church lot first, then Park, Tailgate lot, Wedding barn and Competition grounds, one venue per round, each drawn once in the final look | L once, then M per venue | the first trip out of the yard, then one new place per round |
| v3.6 | Trailer and dynasty | stick burner and wood; the trailer rig and Trailer rung; the DRIVE role; the warmer box; Homecoming; traits; choice card pool to 24 each | M to L | the full trailer Joel asked for |
| v3.7 | Restaurant | detailed after Joel plays v3.6: TILL role, restaurant nights, pit room | L | the top of the ladder |

The website door (section 13) is its own track, run by the Website session after v3.0 passes.

M0 runs in parallel. v3.0 to v3.3 ship on v2 art and never wait for it (2.3, 12.4).

The harness grows with each step: venue reachability (venues x decor sets x the bigger table), v2 and v2.1 to v3 migration samples, the booking generator's determinism and gating, the week loop (pick, prep, go, report, next) by real taps, crew card DOM (stars, face, payroll bar, slot limit), the two-tap week, the 1 star vs 5 star felt-difference check, one served guest per venue, and the econ bands in 10.3.

---

## 16. Left to the builder

- Arrival curves per booking, guest party sizes, and whether seating covers 30 and 40 guest events, tuned with the econ bot and the smoke harness.
- The final wage, fee and price numbers inside the 10.3 bands.
- The invented first-name list (at least 60 names), the choice card text and the "what they did" report lines.
- How the generator picks the safe offer and weights stretch offers.
- The fire curves for the cabinet and stick burner, within the behavior in 7.2.
- PREP's AI: claiming meat on the board, and what happens when you and PREP reach for the same cut.
- How the warmer box draws and where it sits in the kit rows.
- Where the judges' window sits at the Competition grounds, and the ribbon art.
- The update notice text. The save version is settled in section 11; recheck it against the disk at build time.
- The exact layout and copy of the Offseason screen and the Gear sheet, within this file's rules.
- The Restaurant rung's details, after Joel plays the Trailer rung.
- Sprite counts and frame budgets within 12.2 and 12.4.

---

## 17. Overseer's calls in this file, collected

Portrait only. Hybrid oblique art over true isometric, pending the proof. A 9-week season with the competition always in week 9. Fees from one formula. Guests in parties on a fixed curve. A 30 percent deposit. An add-on meat as the menu decision. Bookings play in the backyard until their venue exists. The event length setting. Season scaling and the difficulty swing. No skip for any event. No new hero verb. Two skills per role and the star-to-constant table. Five mood states with notice before leaving. Wages per event worked. Payroll budget and slots by rung. Hiring Day every season with other outfits taking cards. Walk-ins with a signing fee. One training pick a week. 200 XP levels with a skill choice. Moving on with referrals instead of aging. Traits instead of coordinators. The "Word of mouth" label kept; star-based fan rating moves with +2 at 3 stars; 75 percent carry-over. Cash as the only currency. No decay. The Driveway rung at 400 and the full rung and cooker price tables. Decor charm that travels. Prep Station and Crew Tent. The competition tiers, prizes and scoring. The cook kit fixed in rows 1 to 6 at every venue. The build order. The door shipping after v3.0. The tutorial day as a pre-season Yard day. How offers are generated. Switching offers until Load up and go, with the deposit credited then. The add-on meat split and the Menu bonus. The hands rule limited to menu meats. Rain on Yard days only. Streaks that skip Yard days. How event length meets booking windows. The competition's turn-in order, boxes, Hold clock and mood. The v3.0 season end card and Season finale menu. v2 hires kept as rows in v3.0. RUN Friendliness on every carry. How the felt-difference check measures. Effective skill clamped to 1 through 5. Potential capping each skill. Banked levels and the raise button. The big-cooker bay with a trade-in at every step. The two highest-charm decor items travel. Yard days in the season bot and the canopy in its upgrade order. The Yard day ticket rail and the Coming next card at 400. The stick burner runnable from the Driveway rung. The Driveway goal at 400 from v3.0, buyable in v3.3. TILL starting values and restaurant night starting values. A free let-go for a card that never worked. Two options on every host feedback card. One moving-on reason per card. The Artifact save not carrying to the site. Playtest round 3 (contract W26): booked guests waiting at the gate until the hard end; v3.0's finale at 160 s whatever the length; the Birthday's 60 s window; last week's booking preselected when it is offered and safe; the Driveway goal and Coming next card held until v3.3 can sell the rung; the cream shirt under the Blue apron. v3.1 (contract `2026-10-19-pit-sim-v3-1-contract.md`, X18): the FIRE felt metric counts seconds at `FIRE_GOOD` or above (overrides 6.3's band, since the hot band cooks faster and burns no faster); the word of mouth third pays on the fee, 1.0, 1.1 and 1.2 (overrides 9's tip multiplier); the top third's extra card may repeat a type as an invite (overrides 3.2's no repeat rule for that card only); offers vary by menu pair, size and a safe or stretch tier inside the v3.0 types; booked guests pull forward after 3 s of an empty line while food cooks; every contract renews until v3.2's Offseason screen; Hiring Day shows 2 columns of 9 a page and a 26 by 22 bust, as the mock does. v3.1 review round 1 (X20): Fired up comes only from a 5 star stretch, a raise or a rested Yard day, and a 5 or 4 star booking lifts a card only up to Happy (overrides 6.4's first two rows); RUN Friendliness adds a plate tip share on every plate the RUN card carries (extends 6.3); the FIRE card's walk follows Pace (6.3 kept v2's walk); a level costs 120 XP (overrides 6.7's 200) and FIRE earns 3 a bag and 15 a cooker held; no walk-ins in the week of Hiring Day, and walk-ins come at their ceiling (overrides 6.6 for week 1); one 2.5 to 3 star headliner a role in every Hiring Day pool; the STRETCH card always pays the most; a gear buy keeps the cards shown; the tutorial day floors cash and word of mouth at the starting values.

---

## 18. Open for Joel

1. **Is this the look?** Superseded by section 19.1: Joel was shown three reviewed style mocks instead of the M0 proof screen and asked one question about them. It still blocks nothing in v3.0 to v3.3.

---

## 19. Joel's additions after the first draft (2026-10-18, evening)

These came in while this file was being written. Where they conflict with an earlier section, this section wins.

### 19.1 Start to finish, and the look

Joel, verbatim: "I don't need to review them if the art reviewer signs off. Rather do this start to finish." So nothing in this file waits on Joel's sign-off except the look itself. The art director agent's ship verdict is the approval for every mock, sprite set and screen. Questions a builder check sorts into Joel's pile become Overseer's calls, collected in the hand-off so he can veto after playing.

The M0 proof screen (12.4) is dropped. In its place, three style mocks of the same church-picnic cook, each passed by the art director, are in `docs/superpowers/mocks/pit-sim-v3/`: `a-hd-pixel.png` (polished pixel, 3/4 top-down), `b-iso-pixel.png` (pixel art on Cafeland's angle) and `c-iso-cartoon.png` (smooth cartoon, closest to Cafeland). The Overseer recommended B and asked Joel the one question. **Joel answered the same evening: "I like the middle ones in both." The look is B.** An art track builds the v3 sprite library in new files (`games/pit-sim/art3/`) in parallel with v3.0 to v3.3, which keep building in v2 art until v3.4 swaps the renderer. Whatever he picks becomes the target picture for v3.4; the implementation still follows 12.1 to 12.3 (the angle drawn into the art on the orthogonal grid, 32 px tiles, k-integer scaling) unless the v3.4 art lead shows true isometric keeps every tap target at 34 CSS px or more on a 360-wide phone.

The six UI mocks in the same folder are the reference for every management screen, also passed by the art director: `screen-1-season.png`, `screen-2-crew.png`, `screen-3-week.png`, `screen-4-report.png`, `screen-5-gear.png`, `screen-6-creator.png`. They share one pixel UI language (the font in `screen-1-season.html`, blue striped background, dark umber cards, orange primary buttons). Build the DOM screens to match them; where a mock and a rule in this file disagree on content, the rule wins, and on look, the mock wins.

### 19.2 Character creator, player name and pit name

Joel, verbatim: "Be fun to do a tutorial then be able to build the character and name the BBQ pit and the player."

- **Order on a new game:** the v2.1 tutorial day with a default pitmaster, then the creator, then Hiring Day or week 1. Skipping the tutorial goes straight to the creator. A migrated v2 or v2.1 save sees the creator once, prefilled with the default look and "Your Pit".
- **The screen** follows `screen-6-creator.png`: a live preview of the pitmaster beside a kettle, the pit sign above it showing the pit name as typed, option rows (Skin: 6 swatches; Hair: short, curly, long, buzz, bun, bald; Hair color: 6 swatches; Face: none, mustache, beard, glasses; Hat: none, cap, cowboy hat, bandana; Apron: 6 swatches), a Random button, two text fields (Your name, Pit name) with a counter, the "Fire it up" button and the line "Names stay in this browser."
- **Names:** up to 14 characters each, trimmed; letters, digits, space, apostrophe, period and hyphen only (the pixel font's set); empty falls back to "Pitmaster" and "Your Pit". Set with `textContent` only. **Overseer's call**: no profanity filter, because the names never leave the device or show to anyone else.
- **Where they show:** the pit name on the yard sign (drawn in the pixel font, shrunk to fit), the week screen header, the report title and the season end card. The player name in the host lines ("Thanks, Marty") and the crew screen. Upper case where the pixel font is caps-only.
- **The look** is built by the same parts compositor as crew portraits (12.3), so the player and the crew share one body system. The in-yard pitmaster sprite uses the chosen skin, hair, hair color, face, hat and apron in every pose.
- **Change later:** a "Pitmaster" button on the pause panel reopens the creator. **Overseer's call.**
- **Save:** `player { name, look { skin, hair, hairColor, face, hat, apron } }` and `pitName`, validated (strings filtered to the allowed set and length, indexes clamped). Still one key.
- **Audit note:** Hold 225's rule was "no name entry". These names are typed by the player, kept only in that browser's save, never sent, never shown to anyone else; the auditor should see this called out at the audit.

### 19.3 Inventory you can see, and everything rolls over

Joel, verbatim: "It should also show an inventory. If I buy 20 bags of charcoal then that should rollover."

v2 already keeps leftover charcoal (`state.charcoal` saves), but nothing shows it, and stock plus cart is capped at 99. v3:

- **Rollover:** charcoal, wood and meat carry from event to event. Charcoal and wood never spoil. Meat keeps in the cooler up to its capacity; meat over capacity spoils overnight, and the report says how much and why.
- **Cooler capacity** by cooler level (the 7.3 service kit): no cooler 0 units overnight, level 1 holds 12 units, level 2 holds 24, level 3 holds 40. **Overseer's call** on the numbers, tunable in `PitSim.C`.
- **Caps:** charcoal up to 200 bags, wood up to 100. Meat bought is limited by what the cooler holds plus what the event will cook; the shop says so on the line instead of silently capping.
- **An Inventory panel** on the week screen (a card in the 2 by 2 grid or a strip under it, matching `screen-3-week.png`): charcoal bags, wood, each meat in the cooler with a cooler fill bar, and a "spoils tonight" warning on anything over capacity.
- **During the cook:** the HUD keeps a compact inventory chip row (charcoal left, and units left of each menu meat), replacing v2's meat chips.
- **Shop lines** read "You have 14" next to every stepper, and the cart total shows "After this: 34 bags".
- **The report** gets an "In the cooler now" line and the leftover charcoal.

### 19.4 The door, the Security auditor's added rules

The auditor reviewed the plan in 13 and added: the door script runs on every site page, so it is audited as site code. Zero network, zero storage writes, no key logging: the 10-entry rolling comparison buffer in 13.3 lives in memory only, holds only the accepted sequence tokens (never other keys or characters typed in fields), and is never persisted or sent. The touch path must never block or hijack scrolling (passive listeners, no `preventDefault`), as 13.4 already says. Add both lines to the 13.7 checklist as (n) and (o).

### 19.5 Build order changes

- **v3.0** adds the creator (19.2) after the tutorial day and the inventory (19.3), on top of the season.
- Because Joel wants it start to finish, v3.0 through v3.3 build back to back. Each step still ends playable and goes to the private preview link (never over his stable v2 link), and the next step starts as soon as the current one passes the harness and the art director, without waiting for Joel.
- v3.4 (the look) starts as soon as Joel answers 19.1, even if v3.3 is still in progress, as long as the two do not edit the same files at the same time.

### 19.6 Joel played v3.0 (2026-10-19 morning)

Verbatim: "I played it and it is fun but it feels like the 'week' mode skips over m-f and sunday." Also, on seeing v3.0 in v2 art: "What happened to the angle view".

**Days of the week (Overseer's calls on the shape; Joel's call on the need).** The week becomes seven days on the hub, Monday to Sunday, as a day strip with the current day lit. Time moves one day at a time, and every day is a choice that takes one tap unless the player chooses to cook:

| Day | What you can do |
|---|---|
| Monday to Thursday | one of: **Yard day** (walk-in sales, a short cook at half length, your pick of meat), **Prep** (trim and rub the weekend's meat: the booked event's Quality starts higher), **Market run** (buy meat and charcoal; Monday and Tuesday prices are lower, Thursday's are higher), **Train** (the weekly crew training pick moves here; one per week), **Day off** (crew mood up, nothing earned) |
| Friday | **Load-in**: the booked event's prep and an overnight smoke for a pork butt or brisket booked on Saturday (it starts the cook partly done), or a Friday Yard day |
| Saturday and Sunday | **Booked events.** Each offer card already shows SAT or SUN. Church picnics fall on Sunday, Birthdays and Tailgates on Saturday. One booked event per weekend in v3.x; taking both a Saturday and a Sunday booking opens with the trailer rung (7.1). The day without a booking is a Yard day or a day off |

- Quick days resolve on a small result card (what you bought, how prep went, crew mood) and move to the next day. A season of 9 weeks stays under about 45 minutes if the player only cooks the weekends and taps through the weekdays; a player who cooks Yard days plays longer and earns more.
- Cash, inventory, spoilage and mood tick per day, not per week: meat bought Monday without a cooler is gone by Saturday, which makes the cooler and the Thursday market run a real decision.
- The report after a Yard day is the short till; after a booked event it is the full report.
- Save happens on every day change.

**The counter, used end to end.** Joel, verbatim: "plates only got put in one spot on the blue table in the 8bit which is fine that's how those games worked. But in the angled version I see the table getting fully used." In the art swap, setting plates down spreads them along the whole counter: each set-down fills the next free plate spot from the end nearest the line outward (the bigger table adds spots), every plate on the counter draws in its own spot, and a guest at the counter takes the plate in front of them, or the nearest one with their meat. The spot and stack rules in the sim stay; only where a plate lands and how it draws change. The harness checks that four plates set down occupy four different spots.

**Reordered build:** the art swap (v3.4, design 12 plus the art3 library) runs right after v3.1 finishes, then the days of the week as **v3.2 Days**, then the competition (was v3.2, now v3.3) and the ladder (was v3.3, now v3.4 Ladder). Venues, the trailer and the restaurant keep their order after that.
