# Pit sim, backyard rung: design spec

**Date:** 2026-10-18
**Slug:** `pit-sim`
**Working title on the page:** YOUR PIT (the player's business is fictional and unnamed; the page never calls it a Holy Smokes business)
**Ships as (prototype):** `games/pit-sim/index.html` and `games/pit-sim/pit-sim.js`, nothing else. Standalone HTML document, `pit-sim.js` loaded with `defer`, zero inline script, zero inline event handlers, no external resources, no build step, vanilla ES2020 in strict mode.
**Status:** spec for the builder. Prototype of the backyard rung only. Joel plays it on his Android phone; if it is fun in the first three minutes it goes on to iteration, then a11y and security lenses, then wiring and deploy. None of that is in this document.
**Economy:** every number in section 19 was tuned with a headless Node simulation of the day loop (section 20). A builder who changes a number in the `C` block should rerun it.
**Revision 2026-10-18 (same day):** twenty-five builder questions answered in place; section 22 indexes where each ruling lives. The sim was rerun with the rule changes the rulings imply (cold band, cash floor, Broke test, one distance) and the tables in section 20 are from that rerun.

---

## 1. Intent

Joel's description, 2026-10-17 and 18, is the brief: a BBQ business sim where you start in a backyard with an old kettle and grow to a restaurant, hiring helpers and workers along the way. You make the decisions on what to spend and what to upgrade. Need another smoker? It will cost you. Book catering jobs, buy meat and fuel. It is a management sim crossed with a walking simulator: you control a little pitmaster who walks around doing the work, and the business layer is menus. 8-bit style, because that is what those sims look like anyway.

The first game shipped to him (holding a needle on a gauge) bored him. The lesson is that watching a number is not the same as running a pit. This rung is built so that from the first tap the player is doing the work of a backyard cook: light the fire, get meat on, pull it before it burns, slice, carry, serve, decide what to buy with tonight's take. Every upgrade changes what the yard looks like and what tomorrow's till says.

Only the backyard is built here. The next rung, a driveway pop-up, appears as a priced goal and a "Coming next" card when the player can afford it.

## 2. Goals, non-goals, anti-goals

Goals

- Fun inside three minutes on a 375 px Android phone, one thumb. Day 1 is under two minutes from tap to first till.
- The player has something to do every few seconds of service and a real decision every morning.
- Upgrades are felt: each one changes the yard visibly and moves a till number the next day.
- A competent player buys the second kettle on day 4, the drum smoker around day 10 to 13, and reaches the driveway price around day 17 to 21. A careless player can go broke, mostly between day 6 and 10, and gets a way back.
- One `localStorage` key, validated on load, nothing else stored, nothing sent anywhere.
- Keyboard playable, 44 px DOM controls, visible focus, an aria-live region, reduced motion honored.

Non-goals (for this prototype)

- No audio, no images, no fonts beyond system monospace, no dependencies.
- No catering, no driveway rung, no restaurant, no staff beyond two hires.
- No leaderboard, name entry, share, analytics or network.
- No real cooking guidance. The page says the numbers are game numbers.
- No full a11y pass and no security lens yet; both come after Joel says it is fun.

Anti-goals (the prototype has failed even if it runs)

- A day that is mostly waiting. The sim's competent agent is busy for most of the day and the first plate is on the table before the gate opens. If the player is standing still for more than about five seconds at a time in the first three days, the numbers are wrong.
- Upgrades you cannot feel. If a player cannot say what the second kettle or the cooler changed after one day, the upgrade is wrong or its price is wrong.
- A player who never has to choose. The morning budget must not cover everything the player wants before about day 12, and during service the long cook versus quick meat decision must keep coming back.
- Random punishment. Every lost sale has a readable cause: fire low, nothing on the table, line full, burnt, bought the wrong thing.

## 3. The day, second by second

Morning. A clipboard shows day, cash, word of mouth and the next goal. Below it the shop: meat by the unit, charcoal by the bag, gear, hires. The player buys, then presses Open the yard.

Prep, 30 seconds. The yard is live and the gate is shut. A counter under the canvas says Gate opens in 30. The pitmaster lights the kettle (one bag of charcoal on a cold kettle lights it to 60), takes sausage or chicken from the cooler, puts it on the grate. Sausage cooks in 14 seconds at good fire. By the time the gate opens there is a stack of sausage plates on the serving table and chicken is close behind.

Service, 80 seconds of arrivals. Customers walk in at the gate and stand in line. Each one has a speech bubble with the meat they want and a patience bar. Plates on the serving table are the menu: a customer who sees sausage and chicken on the table picks one and is served on the spot. A customer who arrives to an empty table orders from whatever is on the grates and waits for it, patience draining. Fire decays one point a second and needs a bag about every 30 seconds. Each piece has a done window; past it the piece burns and goes to the trash. The player pulls, slices at the board, carries plates to the table one at a time (two with the tray; the buddy does this job once hired), goes back for charcoal, decides whether to start the pork butt now (40 seconds, five plates at 14 each) or keep chicken cycling.

Last call at 110 seconds. No more arrivals. The day ends at 125 seconds, or as soon as the line is empty after last call. Anyone still in line at 125 leaves through the gate with no word of mouth change and is counted on the till as Left at close (section 6.3).

Evening. The till: revenue, tips, food cost, fuel, wages, daily costs, spoilage, what was left on the grate, walk-outs, walked past, and the word of mouth change with its reasons. Press Next day.

Day 2 looks like day 1 with a bit more cash and a few more customers. By day 4 the line is longer than one kettle can feed and the second kettle is affordable. That is the first felt upgrade.

## 4. The yard: tile map

Virtual resolution 208 by 240 pixels: 13 columns by 15 rows of 16 px tiles. Portrait. Rendered to an offscreen canvas at 1x and blitted to the visible canvas with `imageSmoothingEnabled = false` at an integer scale chosen in device pixels (section 14).

```
     x: 0 1 2 3 4 5 6 7 8 9 10 11 12
 y0     # # # # # # G # # # #  #  #
 y1     # . . . . . : . . . .  .  #
 y2     # . . . . . : . . . .  .  #
 y3     # . . . . . : . . . .  .  #
 y4     # . . . . . : . . . .  .  #
 y5     # h h h q Q Q Q q h h  h  #
 y6     # . . . t T T T t . .  .  #
 y7     # . . . . . . . . . .  .  #
 y8     # . . . . . . . . . .  .  #
 y9     # . . . B . . . K . .  .  #
 y10    # . . . . . . . . . D  .  #
 y11    # . . C . . . . k . D  .  #
 y12    # . . . . . . . . . .  .  #
 y13    # . X . . . . . P . .  .  #
 y14    # # # # # # # # # # #  #  #
```

Legend and the exact position of everything:

| Glyph | Thing | Tiles | Player use tile(s) | Notes |
|---|---|---|---|---|
| `#` | Fence | x=0, x=12, y=0 (except gate), y=14 | none | Impassable to everyone. Drawn as weathered boards, umber on near-black. |
| `G` | Gate | (6,0) | none | Customers spawn at (6,-1) and walk through. Drawn shut during prep and after last call, open during service. |
| `:` | Path | (6,1) to (6,4) | none | Front lawn, customers only. The player never enters rows 1 to 5. |
| `.` | Grass | everywhere else | walkable | Two tile variants, alternated by `(x+y) % 2`. |
| `h` | Hedge | (1..3,5) and (9..11,5) | none | Impassable. Keeps the pitmaster on the pit side. |
| `Q` | Queue spot, base | (5,5) (6,5) (7,5) | none | Customers stand here, front of line is (6,5), then (5,5), then (7,5). When a spot empties, everyone behind shifts forward one spot in arrival order (section 6.1). |
| `q` | Queue spot, big table | (4,5) (8,5) | none | Active only with the Bigger table. Until then drawn as grass. Line order with 5 spots: (6,5) (5,5) (7,5) (4,5) (8,5). |
| `T` | Serving table | (5,6) (6,6) (7,6) | any of (5,7) (6,7) (7,7) | Three plate spots, one per tile. |
| `t` | Table extension | (4,6) (8,6) | (4,7) (8,7) once bought | Walkable grass with a dashed outline drawn on top until the Bigger table is bought; then impassable table tiles, five plate spots total. |
| `B` | Cutting board | (4,9) | (5,9) (4,8) (4,10) (3,9) | Slicing and plate pickup. |
| `K` | Kettle 1 | (8,9) | (7,9) (8,8) (9,9) (8,10) | Two grate slots. Always owned. |
| `k` | Kettle 2 | (8,11) | (7,11) (8,12) (9,11) | Walkable grass with a dashed outline until bought, then an impassable station. Two grate slots. |
| `D` | Drum smoker | (10,10) (10,11) | (9,10) (9,11) (10,12) (11,10) (11,11) | Walkable grass with a dashed outline until bought, then impassable. Four grate slots. Only cooker that takes brisket. |
| `C` | Cooler | (3,11) | (4,11) (3,10) (3,12) (2,11) | Raw meat stock. Drawn as a crate until the Cooler is bought, then as a cooler. Same tile either way. |
| `P` | Charcoal pile | (8,13) | (8,12) (7,13) (9,13) | Bags remaining shown as pile height (full above 6, half 3 to 6, low 1 to 2, bare at 0). |
| `X` | Trash can | (2,13) | (3,13) (2,12) (1,13) | Burnt pieces and anything the player throws away. |
| spawn | Pitmaster start | (6,9) | | Facing up. |
| canopy | Canopy overlay | rows 5 to 7, x 4 to 8 | | Visual only once bought: four poles and a cream canvas drawn above the table and queue. |

Distances that matter, in tiles between use tiles, at 5 tiles per second: cooler (4,11) to kettle 1 (7,9) is 5 tiles, 1.0 s. Kettle 1 (7,9) to board (5,9) is 2 tiles, 0.4 s. Board (5,9) to table (6,7) is 3 tiles, 0.6 s. Charcoal (8,12) to kettle 1 is 4 tiles, 0.8 s; to kettle 2 (7,11) 2 tiles; to drum (9,11) 2 tiles. Kettle 1 to trash (3,13) is 8 tiles, 1.6 s. The sim uses these exact distances. Two things the sim rounds against the player: before kettle 2 is bought its footprint (8,11) is grass, so charcoal (8,12) reaches kettle 1's use tile (8,10) in 2 tiles instead of 4; and the sim measured charcoal to drum as 3 tiles in its first run and 2 in the rerun. Neither moved a milestone.

Unowned footprints: kettle 2 (8,11), the drum (10,10) (10,11) and the table ends (4,6) (8,6) are walkable grass with the dashed outline drawn on top. Tapping an outline is a plain walk to that tile. The moment the item is bought the tiles become impassable stations and the yard is redrawn, and a player standing on one is moved to the nearest walkable tile.

Pathfinding: BFS on the walkable grid, 4-directional, from the player's tile to the nearest use tile of the tapped station (or to the tapped grass tile). Diagonal moves are not allowed. The player moves at 5 tiles per second, tile to tile, with the sprite interpolated between tiles. A new tap replaces the current path, and any movement key press cancels it. If the target is unreachable the tap is ignored and the status line says Can't get there.

Facing and reach: facing is the last move direction. In reach means the station occupying the tile directly in front of the player, and only that one. Any walkable tile 4-adjacent to a station tile works, not only the use tiles listed above, which are the BFS targets for tap-to-walk. Arriving by tap sets facing toward the tapped station, so a tile that touches two stations (for example (9,11) touches kettle 2 and the drum, (8,12) touches kettle 2 and the charcoal pile, (8,10) touches kettle 1 and kettle 2) resolves to the one that was tapped. Keyboard players turn with a direction key to pick between neighbors. Walking into a station by keyboard (bumping its impassable tile) sets facing toward it and does nothing else; the auto action on arrival is for tap-to-walk only.

## 5. Player verbs and station state machines

### 5.1 Hands

The pitmaster's hands hold exactly one of: nothing, a charcoal bag, a raw piece (one meat), a cooked piece (one meat), a burnt piece, or plates (1, or 2 of the same meat with the Serving tray). What is held is drawn on the sprite and named in the HUD status line.

### 5.2 Context action

One DOM button under the canvas, `#act`, 48 px tall, full width. Its label is the action available at the station in reach, given what is held. Space or E presses it. Tap-to-walk into a station performs the same action on arrival if the action is marked auto below. Actions marked button-only require the button or key, because they destroy something. Keyboard arrival (bumping) never auto-acts; the player presses Space or E.

| Station | Holding | Label | Effect | Auto on arrival |
|---|---|---|---|---|
| Cooler | nothing | Take {meat} ({n} left) | Take one raw piece of the selected meat | yes |
| Cooler | nothing, stock empty | Cooler is empty | none | |
| Cooler | raw piece | Put {meat} back | Return it to stock | button |
| Cooler | anything else | Hands full | none | |
| Charcoal pile | nothing, bags > 0 | Grab charcoal ({n} bags) | Hold a bag | yes |
| Charcoal pile | nothing, bags = 0 | Out of charcoal | none | |
| Charcoal pile | anything | Hands full | none | |
| Kettle / Drum | charcoal bag | Light the fire (fire under 10) or Add charcoal | Fire to 60 if under 10, else +30 capped at 100 | yes |
| Kettle / Drum | raw piece, slot free, meat allowed | Put {meat} on | Occupies its slots, starts cooking | yes |
| Kettle / Drum | raw piece, no slot | Grate is full | none | |
| Kettle / Drum | raw brisket at a kettle | Brisket needs the drum | none | |
| Kettle / Drum | nothing, a piece is done or burnt | Pull {meat} | Hold the piece ranked first by the pull order below | yes |
| Kettle / Drum | nothing, pieces only cooking | Not done yet ({s}s) | none | |
| Kettle / Drum | nothing, grate empty | Grate is empty | none | |
| Kettle / Drum | cooked, burnt piece or plates | Hands full | none | |
| Cutting board | cooked piece | Slice {meat} | Busy for the slice time, then {plates} plates join that meat's stack on the board | yes |
| Cutting board | nothing, stacks present | Take {meat} plate(s) | Pick 1 plate (2 with tray) from the chosen stack: the stack a waiting customer ordered and is not already on the table, else the oldest stack | yes |
| Cutting board | nothing, board empty | Board is empty | none | |
| Cutting board | 1 plate of X with the tray, board has an X stack | Take 1 more {meat} plate | Second plate of the same meat joins the hand | yes |
| Cutting board | burnt piece | That's burnt. Trash it | none | |
| Cutting board | raw piece or any other plates | Hands full | none | |
| Serving table | plates, a spot fits | Set down {meat} | As many plates as fit go on the table, the rest stay in hand; any customer in line who ordered that meat is served at once, front of line first | yes |
| Serving table | plates, no spot fits | No room on the table | none | |
| Serving table | nothing | Nothing to do here | none (plates never come back off the table) | |
| Serving table | raw, cooked or burnt piece, or charcoal | Hands full | none | |
| Trash | burnt piece | Trash the burnt {meat} | Piece gone | yes |
| Trash | raw or cooked piece or plates | Throw away {meat} | Gone, counted as waste in the till | button only |
| Trash | nothing or charcoal | Nothing to do here | none | |
| nothing in reach | anything | Walk | none | |

Any station and hand combination not in this table: label Hands full when holding something, Nothing to do here when the hands are empty, no action, and the walk still completes. Plates never come back off the table.

"Spot fits" on the table: the table has 3 spots (5 with the Bigger table). A spot holds one meat's stack, up to 6 plates. Plates of a meat already on the table join its stack if under 6. A new meat needs a free spot. Partial set-down: holding 2 plates of X when X's stack has 5, one goes down and one stays in hand, and the status line updates. No room on the table only when zero fit.

Pull order, per cooker (only the cooker in reach is ever considered; the tapped cooker wins by definition): burnt pieces first, the one that burnt earliest first; then done pieces by overshoot fraction `(prog - cook) / window`, highest first; ties by earliest put-on time. In one sort key: `key = burnt ? 1 + secondsSinceBurnt : (prog - cook) / window`, highest key first, then earliest put-on time.

### 5.3 Meat selection

A row of five meat chips under the action button (DOM buttons, 44 px, `aria-pressed`). Each shows the icon, name and raw count in stock. Chips for meats with zero stock are disabled. The selected chip decides what Take at the cooler takes, and nothing else: board pickup follows the stack rule in section 5.2 for the player and the buddy alike, so both agree on what goes to the table next. Default selection each morning, and whenever the current selection runs out: the meat a waiting customer ordered that is not cooking or plated anywhere, else the quickest meat in stock. Keys 1 to 5 select, Q and Shift+Q cycle.

### 5.4 Fire

Each cooker has `fire` in 0 to 100, float. Decay per second: kettle 1.0, drum 0.6. Adding a bag: if fire is under 10 (the whole Out band counts as cold) it becomes 60 ("lit"), otherwise +30 capped at 100. The label reads Light the fire whenever fire is under 10. A bag is consumed when picked up from the pile. The earlier rule (cold meant exactly 0) left a kettle that drifted to 3 in a dead zone where one bag reached only 34; the sim was rerun with the under-10 rule and no milestone moved.

Cook multiplier `m(fire)`:

| Fire | Band | m | Gauge color |
|---|---|---|---|
| 0 to under 10 | Out | 0 | muted grey |
| 10 to under 50 | Low | fire / 50 | dim orange |
| 50 to under 85 | Good | 1.0 | grass green |
| 85 to 100 | Hot | 1.2 | bright orange |

Each cooker shows a vertical 4 px gauge on its right edge in the band color, and a one-pixel tick at 50 and 85. Crossing below 30 fires the aria-live event Fire low on {cooker} once per crossing. Reaching 0 fires Fire out on {cooker}. A cooker at 0 holds its pieces where they are (no progress, no burning).

### 5.5 Meat pieces

A piece on a grate has `prog` in cook-seconds. Per tick `prog += m(fire) * dt`. States:

- cooking: `prog < cook`
- done: `cook <= prog < cook + window`
- burnt: `prog >= cook + window`

The done window is in prog units, exactly as written, not real seconds. A Hot fire (m 1.2) cooks faster and burns faster: sausage's 6 s window lasts 5 real seconds at Hot, 6 at Good, longer at Low. That is the trade-off that keeps Hot from being a pure upgrade. The shop effect lines quote good-fire times. A burnt piece's `prog` stops advancing; the game records the second it burnt for the pull order.

Visual: a 10 px disc per slot that goes pink (raw), browning (two tints across the cooking range), brown with a one-pixel cream ring and a check mark (done), black with a smoke puff (burnt). A thin arc around the slot fills across the cooking range, turns green during the window and shrinks as the window runs out, then turns black. Entering done fires {meat} is done on {cooker}; entering burnt fires {meat} burnt on {cooker} and, without reduced motion, a 120 ms screen shake of 1 px.

The player cannot pull a cooking piece. Pulling a done piece puts a cooked piece in hand. Pulling a burnt piece puts a burnt piece in hand; the only place it goes is the trash. Which piece comes off first is the pull order in section 5.2.

Slot use: sausage 1, chicken 1, ribs 1, pork butt 2, brisket 2. Kettles have 2 slots, the drum 4. Brisket is drum only. Any meat may go on the drum.

### 5.6 Slicing

Walking into the board with a cooked piece starts a slice. The player is busy for the slice time (sausage 3 s, chicken 4 s, ribs 5 s, pork butt 6 s, brisket 7 s), shown as a progress bar above the board and a two-frame chopping animation. Taps during slicing are ignored. On finish, the piece's plate count joins that meat's stack on the board. The board holds up to 4 stacks of up to 8 plates. If the piece would not fit, the slice does not start and the label reads Board is full.

### 5.7 Carrying and serving

Plates in hand: 1, or 2 of one meat with the Serving tray. Setting down at the table serves immediately any customer in line who ordered that meat (front of line first), one plate per customer; the rest join the stack, as many as fit, and anything that does not fit stays in hand (section 5.2). A customer who is served walks out through the gate with a coin pop over the table. Plates older than 30 seconds (counted from slicing) lose the hot-plate tip bonus but still sell. Plates on the table stay there until sold or thrown out at close.

### 5.8 The buddy (hire)

A second sprite. Loop: idle at (5,9); when a stack is on the board and a spot fits on the table, take one plate (the stack a waiting customer ordered first, else oldest), walk (5,9) to (6,7) at 4 tiles per second, set down, walk back. About 2.3 s per plate including 0.4 s of handling at each end. He never slices, never touches fire. While he exists the player can still carry; both use the same stack rules.

Edge cases, decided: he runs from the moment the yard opens, prep included. He reserves his plate when his 0.4 s pickup starts; if the stack empties first (the player took the last plate) he aborts to idle. When the player and the buddy reach for the last plate in the same step, the player wins, because player actions run before NPC actions in the step order (section 5.10). If no spot fits when he arrives at (6,7) he waits there holding the plate until one does, then sets it down. He does not block any tile: the player can stand on (5,9) with him (section 6.1, no collision).

### 5.9 The fire tender (hire)

A third sprite. Stands at (7,13). Whenever any owned cooker is under 55 and bags remain, he grabs a bag, walks to that cooker, adds it, walks back; one cycle every 4 s at most. This is literal: he lights cold cookers at prep start and feeds empty cookers all day, which is why the bag budget is 7 per cooker with him on. He uses the same pile, so the player should buy about 7 bags per cooker per day instead of 5 when he is hired. Requires the drum (he is worth his wage only with three cookers). The sim's competent policy did not hire him and still hit the milestones; he is an option, not a step.

### 5.10 Game loop

`requestAnimationFrame`; `dt = min(0.05, (now - last) / 1000)` so a background tab or a hitch never advances the world by more than 50 ms per frame. On `visibilitychange` to hidden during prep or service the game pauses and shows the pause panel on return; while a morning or evening panel is open, going hidden does nothing and the panel is still there on return. Fixed-step simulation at 20 Hz inside the frame (accumulate dt, step 0.05 s), rendering every frame. All timers in the world are in simulated seconds.

Step order inside one 0.05 s step, fixed, so two builds give the same till from the same play:

1. Player: movement, arrival actions, the busy timer for slicing, the pending action from a tap.
2. NPCs: buddy pickup and set-down, tender add, customer walking (gate to spot, shifts, leaving).
3. Fire decay on every cooker.
4. Piece progress with done and burnt transitions and their events.
5. Customers: arrival-at-spot serve check for anyone who reached a spot this step; then serve-from-table for everyone in line, front first; then patience drain and walk-outs; then close-time leaving at 125.
6. Spawns: a new customer at the gate if the spawn clock is due.

A serve in step 5 always beats a walk-out in the same step. A customer who has started walking out, or walking past, is never served. A plate set down in step 1 or 2 is on the table for step 5 of the same step. The last plate of a meat taken in step 1 is gone before a customer could be served from it in step 5.

## 6. Customers

### 6.1 Arrival

Service arrivals run from t = 30 to t = 110 of the 125 s day. Interval between arrivals in seconds:

```
interval(rep) = 13 - 8 * rep / 100          (13 s at rep 0, 5 s at rep 100)
next = t + interval(rep) * (0.85 + 0.30 * random())
```

On a rain day without the Canopy, divide arrivals: `next = t + interval(rep) / 0.6 * jitter`. The first arrival is at t = 30 exactly.

A customer walks in at the gate (6,0) and down the path at 4 tiles per second to their queue spot. Spots are reserved at spawn: the count that matters is customers in line plus customers in transit. If no spot is free at spawn the customer is marked walk past then and there, walks to (6,4), stops for 0.8 s, turns, and leaves. Walk pasts cost nothing but the sale and are counted on the till so the player can see the line was too short.

Line movement: when a spot empties (served, walked out), everyone behind shifts forward one spot in arrival order, walking at 4 tiles per second; a customer still in transit from the gate heads for the spot now reserved for them. There is no collision anywhere: customers, the buddy, the tender and the player overlap freely and are drawn in y order (lower on the screen drawn later), so the buddy idling on (5,9) never blocks the board tile. Leaving customers (served, walked out, walked past, left at close) walk up their own column to row 1, across to x=6, and out the gate. Speech bubbles and patience bars sit over the sprite wherever it is and move with it.

### 6.2 Order

Decided when the customer appears at the gate. The table is the menu.

1. If any plates are on the table: with 80 percent chance order from the table, weighted by plate count per meat. With 20 percent chance order from what is on the grates and the board (weighted by number of pieces and stacks per meat), "they can smell the brisket". If that 20 percent branch finds nothing cooking or sliced, fall back to the table.
2. Else if anything is on the grates or the board: order from that, weighted by pieces and stacks.
3. Else if raw meat is in the cooler: order from that, weighted by plates in stock.
4. Else: any unlocked meat (brisket only with the drum), equal weights.

Burnt pieces carry no weight in rules 1 and 2. Rule 4 is kept literal even though it can hand a customer a meat the player never bought and cannot cook: the sim was tuned with it, and the lost sale reads as bought too little, which is one of the causes the anti-goals name. It only fires once everything is sold or eaten, late in the day.

The order shows in a speech bubble (meat icon) with a patience bar beneath. A customer never changes their order.

### 6.3 Patience and walk-out

`patience = 45 + uniform(-10, 10)` seconds, fixed per customer. Wait counts from the first arrival at any queue spot and keeps running through shifts forward. The bar drains linearly from full to empty; the last 20 percent is drawn orange and the face frame switches to unhappy. At zero the customer turns and walks out through the gate: reputation minus 3 and the aria-live event A customer walked out.

Close time. At 125 s anyone still in line (a late arrival can have 35 to 55 s of patience left) leaves through the gate with the neutral face, no word of mouth change, no aria-live message of their own (Day over covers it), and is counted on the till's People line as Left at close. This is not a walk-out: the cause is the clock, not the player, and the sim never charged it. Charging the minus 3 was tried in the rerun and pushed the drum to day 14 on some seeds, so it stays off.

### 6.4 Payment and tip

On being served meat with price `P` after waiting `w` of patience `pat`:

```
tip = round(P * 0.25 * (1 - min(1, w / pat))) + (plateAge < 30 ? 1 : 0)
cash += P + tip
rep += (w < 0.4 * pat) ? 2 : 1
```

Coin pop shows `+P` and, when tip > 0, `+tip` in gold beneath it.

### 6.5 Sprites and behavior

Three body variants cycle by arrival index. Walking down (gate to spot) uses the walk-down frames; leaving uses walk-up. Served customers hop once (skipped under reduced motion). Walk-outs leave with the unhappy face. Walk pasts never enter the line.

## 7. Morning: clipboard

A DOM panel over the canvas (the yard is drawn behind it, frozen). Sections top to bottom:

1. Header: Day {n}. Cash {cash}. Word of mouth: {stars} ({rep}).
2. Weather line, from day 4 on: Clear today. or Rain today. Fewer people come out unless the canopy is up. (Canopy owned: Rain today. The canopy is up.) Rain is rolled when the clipboard opens and is not saved; a reload re-rolls it, accepted for the prototype.
3. Goal line: next unowned item in this order: Second kettle, Buddy, Bigger table, Drum smoker, Driveway pop-up; shown as Next goal: {item}, {price}. With everything owned and cash at or above 1000: the Coming next card (section 11) takes the goal line's place, inside the clipboard.
4. Yesterday line (day 2 on, and only when the morning follows a till in this session): Yesterday: {served} served, {walkouts} walked out, {past} walked past. After a reload the line is omitted, because the v1 save does not carry yesterday's numbers and the format stays at v1.
5. Shop (section 8).
6. Buttons: Open the yard (primary, orange). New game (secondary, umber, opens the confirm in section 12).

Open the yard is disabled, with a muted reason line under it, until the day can be worked: Buy at least one bag of charcoal. while charcoal on hand plus bags in the cart is 0; Buy at least one unit of meat. while stock plus meat in the cart is 0 (charcoal line first if both apply). Pressing it commits the cart (section 8), writes the save, and starts prep. A first-time player therefore cannot open a yard with a cold kettle and nothing to cook; the case where they cannot afford either is the Broke card (section 11).

The clipboard is also the first screen of a new game (day 1 with the starting kit and 80 cash). On day 1 the goal line reads Next goal: Second kettle, 90. and a one-line hint sits under the header: Light the kettle, get sausage on, and have plates on the table when the gate opens.

Starting kit: kettle 1, cutting board, crate (cooler tile without the cooler), serving table (3 spots), charcoal pile with 0 bags, trash. Cash 80. Word of mouth 20.

## 8. Shop and hires

Each row is a DOM list item with name, effect line, price, and a stepper (meat and charcoal) or a Buy button (gear) or Hire / Let go toggle (hires). Everything shows the running total and remaining cash at the bottom. A row the player cannot afford has its button disabled with the price in muted color. A row with an unmet prerequisite shows the prerequisite text instead of a price.

Two kinds of purchase, decided:

- Meat and charcoal are a cart. Steppers adjust a pending total; the bottom line reads Total {cart}. Cash after {cash minus cart}. Nothing is charged, saved or announced until Open the yard commits the cart. The player can step anything back to 0 before that. Steppers cap at what remaining cash allows, at 99 units per meat and 99 bags (the save's clamp).
- Gear and hires are immediate. Cash drops on the tap, the save is written, Bought {item} (or Hired / Let go) is announced, and there is no undo. Gear buys redraw the yard behind the panel at once. Cash after on the cart line already reflects them.

### 8.1 Meat, by the unit

| Meat | Price per unit | Plates per unit | Cook at good fire | Done window | Sell price per plate | Slots | Slice | Needs |
|---|---|---|---|---|---|---|---|---|
| Sausage | 4 | 2 | 14 s | 6 s | 5 | 1 | 3 s | |
| Chicken thighs | 6 | 2 | 22 s | 8 s | 8 | 1 | 4 s | |
| Pork ribs | 12 | 3 | 32 s | 10 s | 11 | 1 | 5 s | |
| Pork butt | 20 | 5 | 40 s | 14 s | 14 | 2 | 6 s | |
| Brisket | 38 | 7 | 50 s | 18 s | 18 | 2 | 7 s | Drum smoker |

Effect line per row: Sausage: 2 plates a unit, quickest cook, sells for 5. Chicken thighs: 2 plates, 22 seconds on good fire, sells for 8. Pork ribs: 3 plates, 32 seconds, sells for 11. Pork butt: 5 plates of pulled pork, 40 seconds, both grate slots, sells for 14. Brisket: 7 plates, 50 seconds on the drum, sells for 18.

Under the table a muted line: Game numbers. Not real prices and not a cooking guide.

### 8.2 Charcoal

Bag: 2 each. Effect line: One bag lights a cold cooker to 60 or adds 30 to a lit one. A kettle burns through about five bags a day. Bags left over keep.

### 8.3 Gear

| Item | Price | Effect (as shown) | Prerequisite | Yard change |
|---|---|---|---|---|
| Second kettle | 90 | Two more grate slots. Twice the meat on the fire. | none | Kettle appears at (8,11) |
| Cooler | 60 | Raw meat keeps overnight instead of spoiling. | none | Crate at (3,11) becomes a cooler |
| Bigger table | 70 | Five people can wait instead of three, and five plate spots instead of three. | none | Table extends to (4,6) and (8,6); queue spots (4,5) (8,5) activate |
| Serving tray | 50 | Carry two plates at a time. | none | Tray drawn in the pitmaster's hands when carrying |
| Canopy | 80 | Rain days run at full crowd. | none | Poles and canvas over the table |
| Drum smoker | 280 | Four grate slots, holds heat longer, and the only cooker that takes brisket. | Second kettle | Drum appears at (10,10) and (10,11); Brisket row unlocks in the shop; Fire tender unlocks |
| Driveway pop-up | 1000 | The next rung. Not built in this prototype. | Drum smoker | Coming next card, section 11 |

Gear is bought once and cannot be bought twice. There is no sell button except in the Broke card (section 11).

### 8.4 Hires

| Hire | Wage per day | Effect (as shown) | Prerequisite |
|---|---|---|---|
| Buddy | 20 | Runs plates from the board to the table so you can stay on the fire. Paid each evening. | Day 2 or later |
| Fire tender | 30 | Keeps every cooker above 55 as long as there are bags in the pile. Buy about seven bags a cooker when he's on. | Drum smoker |

Hires are toggles on the clipboard: Hire (orange) becomes Let go (umber). A morning toggle applies to the day being opened: Hire means he works and is paid at tonight's till; Let go means he is gone today, his sprite is not drawn, and nothing is owed. Toggling back and forth before Open the yard costs nothing. Staff cannot be changed mid-day; that is all "takes effect the next morning" means. Hires carry over between days until let go.

### 8.5 Daily costs

Shown as a fixed row at the bottom of the shop: Daily costs: ice and trash bags, 10. Charged at every till. This is what turns treading water into a slow bleed for a careless player; without it the sim's careless runs survived indefinitely at 5 plates a day.

## 9. Evening: the till

A DOM panel. Lines, in order, every one always present (zero shown as 0):

```
Day {n} till
Served                    {served} plates          +{revenue}
Tips                                               +{tips}
Food cost (what you cooked)                        -{foodCost}
Charcoal used             {bags} bags              -{bags*2}
Wages                     {names or "none"}        -{wages}
Daily costs               ice and trash bags       -10
Spoiled overnight         {list or "nothing"}      -{spoilCost}
Thrown out                {n} plates, {m} burnt    -{wasteCost}
Left on the grate         {list or "nothing"}      -{grateCost}
Net                                                 {net, signed}
Cash                                                {cash}

People
Came to the gate {customers}. Served {served}. Walked out {walkouts}. Walked past (line full) {past}. Left at close {close}.

Word of mouth {old} to {new}
+{happy*2} from {happy} quick serves, +{ok} from {ok} serves, -{walkouts*3} from {walkouts} walk-outs{, capped at +12 / -15 for the day}
```

Food cost is the unit price of every piece that was put on a grate that day. Spoiled overnight is raw stock left without a cooler, priced at unit cost. Thrown out is plates left on the board or table at close plus burnt pieces, priced at unit cost per piece and unit cost / plates per plate. Left on the grate is any piece still on a cooker at close, at unit cost. Cash is updated in this order: add revenue and tips, subtract wages and daily costs, then floor at 0. Food, charcoal and spoilage were already paid for at the shop; those lines are information, not a second charge, and the panel says so in a muted line under Net: Food, charcoal and spoilage were paid at the shop. They are listed so you can see where the money went.

Negative nights: wages plus daily costs can exceed the take. Net shows the true signed number (for example -5). Cash shows the floored value, 0, the debt is forgiven, the save stores 0, and the next morning meets the Broke test in section 11. The header and the save never show or hold a negative cash.

Buttons: Next day (primary). New game (secondary).

The save is written when the till panel opens, and what it stores is the next morning: `day` is the day just played plus 1, `cash` is after wages and daily costs and the floor, `stock` is after spoilage, `charcoal` is what is left in the pile, `stats` includes the day just played. Pressing Next day changes nothing in the save; a reload between the till and the clipboard lands on that same morning.

## 10. Reputation

`rep` is an integer 0 to 100, start 20, shown as word of mouth: five star glyphs (filled count = round(rep / 20)) with the number beside them.

- Served with wait under 40 percent of patience: +2.
- Served otherwise: +1.
- Walk-out: minus 3.
- Walk past: 0.
- Daily net change clamped to +12 and minus 15, applied at the till.
- Rep drives the arrival interval (section 6.1) and nothing else.

## 11. Spoilage, weather, losing and recovering

Spoilage. At close, raw stock is lost unless the Cooler is owned, in which case it carries to the next morning and appears in the shop as In the cooler: {list}. Charcoal always carries. Plates left on the board or the table are thrown out. Pieces left on a grate are lost.

Weather. From day 4, each morning has a 15 percent chance of rain, rolled when the clipboard opens and shown before the shop so the Canopy can be bought that morning. The roll is not saved; a reload before Open the yard rolls again. Rain without the canopy divides arrivals by 0.6. Rain visual: a grey band at the top of the yard and falling one-pixel streaks (a flat tint only under reduced motion).

Broke. The test runs when a morning clipboard would open, on the saved state before any shopping. The player is broke when they cannot both light a fire and cook something:

```
broke = (charcoal == 0 && cash < 2)
     || (stockUnits == 0 && cash < 4 + (charcoal == 0 ? 2 : 0))
```

stockUnits is every raw unit across all meats. So 1 sausage in the cooler, 0 bags and 1 cash is a Broke morning (nothing to light the fire with), and 0 stock, 2 bags and 3 cash is too (nothing to cook). The older wording (cash under 6, stock empty, no plates on hand) is replaced: plates never survive to a morning, and it let a player into an unwinnable day. When the test is true the clipboard is replaced by the Broke card:

```
Broke
You can't buy meat and charcoal for today.
Sell gear back at half price, or start over.
[list of owned gear with "Sell for {price/2}" buttons; hires are let go for nothing]
[Start over]
```

Each sale updates cash on the card, writes the save, and reruns the test; as soon as it is false a Keep going button appears and returns to the normal clipboard. With no gear to sell, only Start over is offered. Selling the second kettle or drum removes it from the yard and any brisket in the cooler is sold back at half its unit price with the drum.

Coming next. When the Drum smoker is owned and cash is at or above 1000 at a morning, the goal line is replaced by a card inside the clipboard:

```
Coming next: the driveway pop-up
Price 1000. The backyard stays open as long as you like.
[Keep running the backyard]
```

It is part of the clipboard, not a dialog of its own: Keep running the backyard collapses it back to the goal line for that morning, Escape does nothing to it, and the rest of the clipboard stays usable with it open. The card shows every morning the condition holds; `drivewayShown` in the save records that it was shown once so the aria-live announcement fires only once.

## 12. New game, pause, save

New game is offered on the clipboard, the till, the pause panel and the Broke card. It opens a confirm panel: Start over? This wipes the save. [Start over] [Keep playing]. Start over removes the key and loads day 1. Escape on the confirm panel acts as Keep playing.

Pause: Escape or P during prep or service, or the tab going hidden during prep or service. The pause panel: Paused. [Keep playing] [New game] and a Controls list (section 15). The world does not advance while paused. Escape on the pause panel resumes. Escape does nothing on the clipboard, the till or the Broke card; a hidden tab while one of those is open does not stack a pause panel on top, the open panel simply stays.

Save key: `hs.pitsim.save`. Written in try/catch when the till opens (storing the next morning, section 9), after every gear purchase or hire toggle on the clipboard, when Open the yard commits the meat and charcoal cart, and after a Broke card sale. Removed on Start over. Read once at load. If `localStorage` throws, the game runs from memory and the status line shows Saving is off in this browser once.

Format, version 1:

```json
{
  "v": 1,
  "day": 5,
  "cash": 187,
  "rep": 80,
  "stock": { "sausage": 0, "chicken": 2, "ribs": 0, "butt": 1, "brisket": 0 },
  "charcoal": 3,
  "gear": { "kettle2": true, "cooler": false, "bigtable": false, "tray": false, "canopy": false, "drum": false },
  "hires": { "buddy": false, "tender": false },
  "stats": { "days": 4, "served": 45, "walkouts": 1, "past": 3, "burnt": 0 },
  "drivewayShown": false
}
```

Validator, applied field by field on load; the result is always a complete state:

| Field | Rule |
|---|---|
| `v` | must be exactly 1, otherwise the whole save is ignored and a new game starts |
| `day` | integer, clamp 1 to 999, default 1 |
| `cash` | integer, clamp 0 to 999999, default 80 |
| `rep` | integer, clamp 0 to 100, default 20 |
| `stock.*` | one key per meat, integer, clamp 0 to 99, default 0; unknown keys dropped |
| `charcoal` | integer, clamp 0 to 99, default 0 |
| `gear.*` | one key per gear id, coerced to boolean, default false; unknown keys dropped; `drum` forced false if `kettle2` is false |
| `hires.*` | `buddy`, `tender`, coerced to boolean, default false; `tender` forced false if `drum` is false |
| `stats.*` | integers, clamp 0 to 9999999, default 0; unknown keys dropped |
| `drivewayShown` | boolean, default false |
| anything else | dropped |

A load always lands on the morning clipboard of `day`; service state is never saved. The format stays at version 1 for the prototype: yesterday's numbers and the rain roll are not in it (the clipboard omits the Yesterday line and re-rolls rain after a load, section 7), so the validator above is the whole acceptance test for hand-edited saves.

## 13. Sprites

All sprites are string grids in the JS, one character per pixel, mapped to the palette in section 14.1, rendered once at startup to offscreen canvases and cached. Nothing is drawn from image files. Frame counts:

| Sprite | Size | Frames | Notes |
|---|---|---|---|
| Pitmaster idle | 16x16 | 4 (down, up, left, right) | Right is left flipped |
| Pitmaster walk | 16x16 | 8 (4 directions x 2) | Right frames are left flipped |
| Pitmaster slicing | 16x16 | 2 | Arm up, arm down, at 6 fps |
| Hand overlays | 8x8 | 7 | charcoal bag, raw piece, cooked piece, burnt piece, one plate, two plates on tray, empty tray; tinted per meat where relevant |
| Buddy idle | 16x16 | 1 | |
| Buddy walk | 16x16 | 8 | Pitmaster walk shape, cap and shirt recolored |
| Fire tender idle | 16x16 | 1 | |
| Fire tender walk | 16x16 | 8 | Pitmaster walk shape, hat recolored |
| Customer bodies | 16x16 | 15 (3 variants x walk down 2, walk up 2, stand 1) | |
| Customer unhappy face | 6x4 | 3 (one per variant) | Overlaid on stand frame |
| Speech bubble | 16x12 | 1 | Meat icon drawn inside |
| Patience bar | 14x2 | procedural | Green, orange in the last 20 percent |
| Meat icons | 8x8 | 5 | sausage, chicken, ribs, butt, brisket; used in bubbles, chips, shop |
| Plate icons | 8x6 | 5 | A plate with the meat on it; stacks draw each plate 1 px higher than the one below, up to 6 |
| Grate piece | 10x10 | 15 (5 meats x raw, done, burnt) | Browning tints applied procedurally between raw and done |
| Kettle | 16x16 | 1 base + 3 glow overlays (low, good, hot) | Gauge drawn procedurally |
| Drum smoker | 16x32 | 1 base + 3 glow overlays | |
| Dashed outline tile | 16x16 | 2 (single, and top/bottom halves for the drum) | Muted hairline dashes |
| Cooler | 16x16 | 2 (crate, cooler) | |
| Cutting board | 16x16 | 1 | Stacks overlaid |
| Serving table | 16x16 | 2 (middle tile, end tile) | End tile flipped for the other side |
| Canopy | 80x24 | 1 | Drawn in two passes: canvas and the two back poles before any sprite, the two front poles after sprites; speech bubbles and patience bars render last of all, so the canopy never covers an order or a wait. If it still reads badly on the phone, draw the canvas at 50 percent alpha. |
| Charcoal pile | 16x16 | 4 (full, half, low, bare) | |
| Trash can | 16x16 | 1 | |
| Fence | 16x16 | 2 (horizontal, vertical) | Corners use vertical |
| Gate | 16x16 | 2 (shut, open) | |
| Hedge | 16x16 | 1 | |
| Grass | 16x16 | 2 | |
| Path | 16x16 | 1 | |
| Smoke puff | 8x8 | 3 | Rises 1 px per frame at 8 fps, skipped under reduced motion |
| Coin pop | 8x8 | 2 | Text drawn beside it with the pixel digit set |
| Pixel digits and letters | 4x6 | 36 (0 to 9, A to Z) | Used only on the canvas for the clock, +P pops, GATE OPENS IN {n} and LAST CALL. Canvas text renders uppercase and is a duplicate of the DOM status line, not a separate string; the DOM keeps the section 18 casing. Everything else is DOM text |
| Progress arc | procedural | | Around grate slots and above the board |

About 130 authored frames. Every grid is authored in the JS as an array of strings of equal length; a startup check throws if a row is the wrong length or uses a character outside the palette map, so a typo fails loudly in the console.

## 14. Presentation

### 14.1 Palette

Twenty-two colors. The first nine are the site's canon tones so the page belongs on holysmokesbbqco.com; the rest are the yard.

| Key | Hex | Use |
|---|---|---|
| `K` | #1b1714 | near-black: page background, outlines, burnt meat |
| `U` | #2a2015 | umber: panels, fence boards, drum body |
| `C` | #E6D8B8 | cream: panel text, plates, canopy canvas |
| `O` | #D06129 | orange: buttons, hot fire, coin text |
| `Y` | #F3CF6D | gold: tips, done ring highlight, sun |
| `M` | #bfb39a | muted: hints, dashed outlines, gauge "out" |
| `H` | #3a332c | hairline: panel borders, table shadow |
| `I` | #33211A | ink: pitmaster hat, kettle body |
| `S` | #444947 | charcoal grey: kettle lid, trash can |
| `g` | #4a6741 | grass dark |
| `G` | #5f7f4c | grass light |
| `h` | #2f4a2d | hedge |
| `d` | #6b4a2a | dirt path |
| `b` | #8a6a3f | cutting board, table top, crate |
| `p` | #e8a0a0 | raw meat pink |
| `r` | #b5583a | cooking meat |
| `n` | #7a3f22 | done meat brown |
| `f` | #ff9a2e | fire bright |
| `y` | #ffd85c | fire yellow |
| `s` | #8d8a86 | smoke light |
| `t` | #5a5753 | smoke dark |
| `w` | #a9c4d9 | sky, rain streaks, cooler lid |

Skin, shirt and cap colors for people come from this set: skin `C` or `b`, shirts `O`, `w`, `G`, caps `I`, `S`, `Y`. The page and panels use cream on near-black, orange buttons with near-black text, umber panels with hairline borders, system monospace (`ui-monospace, Menlo, Consolas, monospace`).

### 14.2 Scaling

```
dpr   = window.devicePixelRatio || 1
availW = container width in CSS px (375 on the target phone)
availH = viewport height minus header (44) minus controls (48 + 48 + 24) minus 16
scale = max(1, floor(min(availW * dpr / 208, availH * dpr / 240)))
canvas.width = 208 * scale; canvas.height = 240 * scale   (device pixels)
canvas.style.width = (208 * scale / dpr) + 'px'; height likewise
```

On a 375 px wide phone at dpr 3 this gives scale 5, a 1040 by 1200 device pixel canvas shown at 346.7 by 400 CSS px, every virtual pixel exactly 5 device pixels. At dpr 2, scale 3, 312 by 360 CSS px. On a 1280 by 800 desktop at dpr 1, scale 2 or 3 depending on height. Recomputed on resize and orientation change. Drawing goes to a 208 by 240 offscreen canvas every frame and is blitted with `drawImage` scaled, smoothing off on both contexts.

### 14.3 DOM layout at 375 px

Single column, 16 px side gutter inside `main`, no horizontal scroll.

```
header   44 px   YOUR PIT          Day 3   Cash 136   ★★★☆☆
canvas   ~400 px (section 14.2), centered, near-black letterbox
status   24 px   one line: what is held, or Gate opens in 12, or Last call
#act     48 px   context action button, full width
chips    48 px   five meat chips, equal width, icon + count (name in aria-label)
footer   text:   Game numbers, not real prices or a cooking guide. Saved in this browser only.
live     aria-live="polite" region, visually hidden
```

Status line precedence (one 24 px line, one message at a time), highest first: Saving is off in this browser. (once, 4 s at load) > Can't get there (1.5 s) > Gate opens in {n} (all of prep) > Last call (3 s after 110) > Holding: ... or Hands empty. During prep the held item is still drawn on the sprite, so losing its text to the countdown is acceptable.

Panels (clipboard, till, pause, confirm, Broke) are `<section role="dialog" aria-modal="true" aria-labelledby>` elements positioned over the canvas and controls, scrollable within themselves, max-height 100 percent of the viewport, with focus moved to their heading on open and returned to `#act` on close. Coming next is a card inside the clipboard, not a dialog. Background scrim is near-black at 85 percent.

Tap targets: every button and chip is at least 44 by 44 CSS px. Focus ring: 2 px gold outline with a 2 px gap from the control, never removed.

### 14.4 Desktop (900 px and wider)

Two columns inside a 960 px max-width wrapper: the canvas column (scale from section 14.2 limited to 70 percent of viewport height) with status, `#act` and chips beneath it; a right column 320 px wide that holds the panels inline instead of as overlays during morning and evening, and a Controls list during service. Dialog semantics stay the same (role, labelledby); only the position changes via CSS.

### 14.5 Head of the document

`<!doctype html>`, `lang="en"`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>Your Pit</title>`, `<meta name="description" content="Run a backyard pit. Light the fire, cook, serve, and decide what to buy with the day's take. A game with game numbers.">`, `<meta name="color-scheme" content="dark">`, one inline `<style>`, `<script src="./pit-sim.js" defer></script>`. No other resource.

## 15. Keyboard map

| Key | Action |
|---|---|
| Arrow keys, W A S D | Move one tile per press, held keys repeat at the walk speed; sets facing; cancels any tap path. Bumping a station sets facing toward it and nothing else |
| Space, E | Context action (same as `#act`); this is how a keyboard player acts, since bumping never auto-acts |
| 1 to 5 | Select sausage, chicken, ribs, pork butt, brisket |
| Q, Shift+Q | Next, previous meat chip |
| Escape, P | Pause and resume during prep and service |
| Escape on a panel | Pause: resumes. Confirm: Keep playing. Clipboard, till, Broke: nothing |
| Enter | Activates the focused DOM control (native) |
| Tab | Moves through DOM controls (native); the canvas has `tabindex="0"` and takes movement keys only when focused or when no panel is open |

Keys are ignored while a panel is open except Escape (as listed) and the native Tab and Enter. Key handlers call `preventDefault` only for the listed keys.

Tap and click: a tap on the canvas converts to a tile and starts a walk. A tap on a station tile walks to its nearest use tile and performs the auto action on arrival. Touch handlers are passive except on the canvas where `touchstart` calls `preventDefault` to stop double-tap zoom.

## 16. aria-live events

One `aria-live="polite"` region. Messages are queued and coalesced: at most one message per second, and repeated identical messages within 5 s are dropped. Exact strings:

| Event | Message |
|---|---|
| Prep starts | Yard open. Gate opens in 30 seconds. |
| 10 s before the gate | Gate opens in 10. |
| Gate opens | Gate open. |
| Customer arrives | New customer wants {meat}. |
| Piece done | {Meat} is done on {cooker}. |
| Piece burnt | {Meat} burnt on {cooker}. |
| Served | Served {meat}, {price} plus {tip} tip. (or "no tip") |
| Walk-out | A customer walked out. |
| Walk past | Someone walked past. The line is full. |
| Fire below 30 | Fire low on {cooker}. |
| Fire reaches 0 | Fire out on {cooker}. |
| Last call | Last call. No more customers today. |
| Day over | Day over. Opening the till. |
| Purchase (gear only; the meat and charcoal cart is silent, Yard open follows it) | Bought {item}. |
| Hire / let go | Hired the buddy. / Let the buddy go. (and fire tender) |
| Coming next first shown | You can afford the driveway pop-up. It is the next rung and is not built yet. |
| Broke card | Broke. Sell gear or start over. |
| Save failure | Saving is off in this browser. |

Cooker names: kettle 1, kettle 2, the drum.

## 17. Reduced motion

When `prefers-reduced-motion: reduce` matches:

- No smoke puffs, no screen shake, no coin pop drift (the +P text appears for 600 ms without moving), no served hop, no rain streaks (flat grey tint only), no idle bobbing.
- Walking, cooking arcs, patience bars and fire gauges still animate because they carry information.
- Panel open and close are instant (no transition) in both modes anyway.

## 18. User-facing strings

Everything the player can read, grouped. Copy rules: no dashes of any kind, plain third person or imperative, no hype, no promises about the future, no "offset", no brands, no real prices, the business is "your pit".

Header and page
- YOUR PIT
- Day {n}
- Cash {n}
- Word of mouth
- Game numbers, not real prices or a cooking guide. Saved in this browser only.

Status line (precedence in section 14.3)
- Gate opens in {n}
- Last call
- Holding: charcoal / raw {meat} / cooked {meat} / burnt {meat} / {n} plate(s) of {meat}
- Hands empty
- Can't get there
- Saving is off in this browser.

Canvas text (pixel font, uppercase duplicates of the status line and clock, not separate strings): GATE OPENS IN {n}, LAST CALL, the clock, +{n}.

Action button labels: see the table in section 5.2, plus Walk when nothing is in reach, Hands full and Nothing to do here for any combination the table does not list, Light the fire and Add charcoal as the two charcoal labels, and Take 1 more {meat} plate.

Clipboard
- Morning
- Day {n}. Cash {cash}. Word of mouth {rep}.
- Clear today.
- Rain today. Fewer people come out unless the canopy is up.
- Rain today. The canopy is up.
- Next goal: {item}, {price}.
- Yesterday: {served} served, {walkouts} walked out, {past} walked past.
- Light the kettle, get sausage on, and have plates on the table when the gate opens. (day 1 only)
- In the cooler: {list}.
- Meat
- Charcoal
- Gear
- Hires
- Daily costs: ice and trash bags, 10.
- Total {n}. Cash after {n}. (the cart: meat and charcoal not yet charged)
- Open the yard
- Buy at least one bag of charcoal. / Buy at least one unit of meat. (muted reason line under a disabled Open the yard)
- New game
- Game numbers. Not real prices and not a cooking guide.
- Needs the drum smoker. / Needs the second kettle. / From day 2.
- Owned
- Hire / Let go
- Buy

Shop rows: names and effect lines as written in section 8.

Till: every line as written in section 9 (the People line includes Left at close {n}), plus Next day and New game.

Pause
- Paused
- Keep playing
- New game
- Controls (followed by the key list from section 15 as a definition list)

Confirm
- Start over? This wipes the save.
- Start over
- Keep playing

Broke and Coming next: as written in section 11.

Cooker names: Kettle 1, Kettle 2, Drum smoker. Meat names: Sausage, Chicken thighs, Pork ribs, Pork butt, Brisket. Plates of pork butt are called pulled pork on the plate icon's aria-label only.

## 19. Pinned numbers

Everything below lives in one `C` object at the top of `pit-sim.js`, plus the `MEATS` and `GEAR` tables. Nothing else in the file hard-codes one of these values.

Day and world

| Name | Value |
|---|---|
| DAY_SECONDS | 125 |
| GATE_OPENS | 30 |
| LAST_CALL | 110 |
| START_CASH | 80 |
| START_REP | 20 |
| WALK_TILES_PER_S | 5 |
| NPC_TILES_PER_S | 4 |
| TICK_SECONDS | 0.05 |
| MAX_FRAME_DT | 0.05 |

Fire

| Name | Value |
|---|---|
| FIRE_LIGHT | 60 (one bag on a cold cooker) |
| COLD_UNDER | 10 (a cooker under this is cold: a bag lights it to FIRE_LIGHT; the label reads Light the fire) |
| FIRE_ADD | 30 |
| FIRE_MAX | 100 |
| KETTLE_DECAY per s | 1.0 |
| DRUM_DECAY per s | 0.6 |
| KETTLE_SLOTS | 2 |
| DRUM_SLOTS | 4 |
| Fire bands | out under 10 (m 0), low 10 to 50 (m fire/50), good 50 to 85 (m 1.0), hot 85 to 100 (m 1.2) |
| FIRE_LOW_WARN | 30 |
| TENDER_THRESHOLD | 55 |
| TENDER_CYCLE | 4 s |
| CHARCOAL_PRICE | 2 per bag |

Meats

| Meat | Unit cost | Plates | Cook s | Window s | Price | Slots | Slice s | Drum only |
|---|---|---|---|---|---|---|---|---|
| sausage | 4 | 2 | 14 | 6 | 5 | 1 | 3 | no |
| chicken | 6 | 2 | 22 | 8 | 8 | 1 | 4 | no |
| ribs | 12 | 3 | 32 | 10 | 11 | 1 | 5 | no |
| butt | 20 | 5 | 40 | 14 | 14 | 2 | 6 | no |
| brisket | 38 | 7 | 50 | 18 | 18 | 2 | 7 | yes |

Customers

| Name | Value |
|---|---|
| SPAWN_MAX | 13 s between arrivals at rep 0 |
| SPAWN_MIN | 5 s at rep 100 |
| SPAWN_JITTER | 0.85 to 1.15 |
| PATIENCE_BASE | 45 s |
| PATIENCE_SPREAD | plus or minus 10 s |
| ORDER_FROM_TABLE | 0.80 |
| HOT_PLATE_SECONDS | 30 |
| TIP_RATE | 0.25 of price, scaled by remaining patience |
| HOT_PLATE_TIP | 1 |
| QUEUE_SPOTS | 3, 5 with the bigger table |
| TABLE_SPOTS | 3, 5 with the bigger table |
| TABLE_STACK | 6 plates per spot |
| BOARD_STACKS | 4 stacks of 8 |

Reputation

| Name | Value |
|---|---|
| REP_QUICK | +2 (wait under 40 percent of patience) |
| REP_OK | +1 |
| REP_WALKOUT | minus 3 |
| REP_DAY_MAX | +12 |
| REP_DAY_MIN | minus 15 |

Gear, hires, costs

| Item | Price |
|---|---|
| Second kettle | 90 |
| Cooler | 60 |
| Bigger table | 70 |
| Serving tray | 50 |
| Canopy | 80 |
| Drum smoker | 280 |
| Driveway pop-up (goal only) | 1000 |
| Buddy wage per day | 20 |
| Fire tender wage per day | 30 |
| Daily costs | 10 |
| Sell-back | half the purchase price, rounded down |
| STEPPER_MAX | 99 units per meat, 99 bags (matches the save clamp) |
| CASH_FLOOR | 0 at the till; debt forgiven |
| Broke test | (charcoal == 0 and cash < 2) or (stockUnits == 0 and cash < 4 + (charcoal == 0 ? 2 : 0)), before shopping |
| CLOSE_PENALTY | 0 (customers still in line at 125 cost no word of mouth) |

Weather

| Name | Value |
|---|---|
| RAIN_FROM_DAY | 4 |
| RAIN_CHANCE | 0.15 |
| RAIN_ARRIVALS | arrivals times 0.6 without the canopy |

## 20. Headless economy check

### 20.1 What was simulated

A Node script (`pitsim-econ.mjs`, 347 lines, in the Overseer's scratchpad, not in the repo) steps the service day at 0.1 s with the fire, piece, customer, table and reputation rules above, and a player agent whose travel times come from the tile distances in section 4 (5 tiles per second, 0.3 s per pickup or set-down, the slice times in the table). The buddy and the fire tender are modeled. A morning policy buys meat, charcoal, gear and hires, then the day runs. Eight seeds by default; the final numbers were also checked on seeds 9 to 24.

Competent policy: lights both kettles first, puts the quickest meat on first and starts long cooks right after (two sausage and two chicken units are always in the opening buy), adds charcoal under 50, pulls done meat before anything else, carries the plate someone in line is waiting for before loading the next piece, buys 1.1 times the expected crowd plus one plate, holds a reserve of one day's meat, fuel and wages before any gear purchase, and buys in this order: second kettle, cooler, buddy (once word of mouth reaches 45), bigger table, drum smoker, tray, canopy (on the first morning rain is possible). Expected crowd is 80 seconds divided by the arrival interval at today's reputation.

Careless policy: thinks only every 2 seconds, adds charcoal only under 15, buys two bags per cooker, over-buys 1.4 times the expected crowd plus two, puts a pork butt on the only kettle on day 1, never buys the cooler, buys gear with no reserve in the order bigger table, canopy, second kettle, tray, drum, and hires the buddy on day 3.

Milestones from the project facts: second kettle by day 3 or 4, drum by day 8 to 10, driveway price around day 15 to 20, careless broke by day 6 to 10.

Rerun for the 2026-10-18 rulings. The script now carries the rules the rulings changed: `COLD_UNDER` 10 (a bag on a cooker under 10 lights it to 60), cash floored at 0 at the till, the Broke test of section 11 run before the shop, the charcoal policy keeping one sausage's worth of cash back so the yard can always open with a bag and a unit, charcoal to drum measured as 2 tiles, and a `CLOSE_PENALTY` switch (default 0) to test charging customers still in line at close. Things the sim still rounds against the player and were left alone: customers join the line and start their wait at spawn rather than 1.25 s later at the spot; walk past is decided at spawn (which is now also the game's rule); kettle 2's footprint is treated as blocked from day 1.

### 20.2 Result with the pinned numbers (rerun)

| Policy | Second kettle | Drum | Driveway price (1000) | Broke |
|---|---|---|---|---|
| Competent, seeds 1 to 8 | day 4 in 8 of 8 | day 10 to 12 (median 11) | day 17 to 20 (median 18 to 19) | never |
| Competent, seeds 9 to 24 | day 4 in 16 of 16 | day 10 to 13 (median 12) | day 18 to 21 (median 19) | never |
| Competent, cooler bought after the drum | day 4 in 8 of 8 | day 10 to 12 | day 18 to 20 | never |
| Careless, seeds 1 to 8 | never | never | never | day 6 to 10, all 8 |
| Careless, seeds 9 to 24 | never | never | never | day 3 to 25, median 9; 12 of 16 by day 11, one lasted to day 25 at a handful of plates a day |
| Competent, CLOSE_PENALTY 1 (rejected) | day 4 | day 10 to 14 | day 17 to 22 | never |
| Careless, CLOSE_PENALTY 1 (rejected) | never | never | never | day 6 to 11 (seeds 1 to 8); one of seeds 9 to 24 survived 25 days |

Before the rerun (first-run script) the same rows read: competent drum 10 to 12 and 10 to 13, driveway 18 to 20 and 19 to 23; careless broke 5 to 10 and 2 to 25. The rulings moved the driveway one day earlier on a few seeds and the earliest careless bankruptcies one day later (the Broke test now fires on a morning the old test let through, but the cash floor and the sausage reserve give the careless agent one more working day on some seeds). Every milestone is still inside its window. The close-time penalty was rejected because it pushed the drum to day 14 on some seeds while charging the player for the clock.

The drum lands one to two days after the top of its window for a cooler-first buyer. Price changes to the drum between 250 and 300 did not move it, because what gates the drum is the sequence of earlier buys plus the reserve rule, not the drum's own price; it is left at 280 so it reads as a big purchase. Everything else is inside its window. The driveway price was lowered from 1200 to 1000 to land the window; at 1200 it fell on days 19 to 21.

### 20.3 Competent run, seed 1, day by day

start = cash at the morning before shopping; cust = came to the gate; walk = walked out; past = walked past, line full; close = still in line at 125, no penalty; rev = plate revenue; wages includes the 10 daily costs; cash = end of day after the till.

| day | start | cust | served | walk | past | close | burnt | rev | tips | wages | spoil | rain | rep | cash | bought |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 80 | 8 | 8 | 0 | 0 | 0 | 0 | 55 | 19 | 10 | 0 | | 32 | 108 | |
| 2 | 108 | 8 | 8 | 0 | 0 | 0 | 0 | 52 | 18 | 10 | 0 | | 44 | 136 | |
| 3 | 136 | 9 | 9 | 0 | 0 | 0 | 0 | 63 | 24 | 10 | 0 | | 56 | 175 | |
| 4 | 175 | 10 | 10 | 0 | 0 | 0 | 0 | 71 | 23 | 10 | 0 | | 68 | 129 | second kettle |
| 5 | 129 | 11 | 10 | 1 | 0 | 0 | 0 | 95 | 33 | 10 | 0 | | 80 | 187 | |
| 6 | 187 | 12 | 12 | 0 | 0 | 0 | 0 | 114 | 36 | 30 | 0 | | 92 | 183 | cooler, buddy |
| 7 | 183 | 14 | 12 | 0 | 0 | 2 | 0 | 126 | 41 | 30 | 0 | | 100 | 242 | |
| 8 | 242 | 17 | 17 | 0 | 0 | 0 | 0 | 172 | 58 | 30 | 0 | | 100 | 290 | bigger table |
| 9 | 290 | 17 | 17 | 0 | 0 | 0 | 0 | 172 | 54 | 30 | 0 | | 100 | 404 | |
| 10 | 404 | 16 | 16 | 0 | 0 | 0 | 0 | 164 | 48 | 30 | 0 | | 100 | 504 | |
| 11 | 504 | 16 | 15 | 1 | 0 | 0 | 2 | 182 | 60 | 30 | 0 | | 100 | 276 | drum smoker, tray |
| 12 | 276 | 17 | 16 | 1 | 0 | 0 | 2 | 200 | 59 | 30 | 0 | | 100 | 327 | canopy |
| 13 | 327 | 17 | 15 | 2 | 0 | 0 | 2 | 182 | 60 | 30 | 0 | | 100 | 441 | |
| 14 | 441 | 17 | 16 | 1 | 0 | 0 | 2 | 200 | 61 | 30 | 0 | | 100 | 574 | |
| 15 | 574 | 16 | 15 | 1 | 0 | 0 | 2 | 182 | 52 | 30 | 0 | | 100 | 680 | |
| 16 | 680 | 17 | 14 | 3 | 0 | 0 | 2 | 174 | 53 | 30 | 0 | | 100 | 779 | |
| 17 | 779 | 16 | 14 | 2 | 0 | 0 | 2 | 164 | 53 | 30 | 0 | | 100 | 868 | |
| 18 | 868 | 16 | 15 | 1 | 0 | 0 | 2 | 182 | 56 | 30 | 0 | | 100 | 978 | |
| 19 | 978 | 17 | 16 | 1 | 0 | 0 | 2 | 200 | 63 | 30 | 0 | y | 100 | 1113 | driveway price reached |

The two burnt pieces a day from day 11 are the agent's quick meats (a chicken on kettle 2, a sausage on the drum) going over their windows while it tends three fires and carries brisket; a human who pulls on the done chime will not lose them. They are left in the table as an honest reading of the agent. Day 7 shows the close-time case: two customers still in line at 125, counted, no penalty.

### 20.4 Careless run, seed 1, day by day

| day | start | cust | served | walk | past | close | burnt | rev | tips | wages | spoil | rain | rep | cash | bought |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 80 | 7 | 3 | 3 | 1 | 0 | 0 | 42 | 12 | 10 | 0 | | 17 | 44 | tray |
| 2 | 44 | 7 | 2 | 3 | 2 | 0 | 0 | 28 | 8 | 10 | 6 | | 12 | 28 | |
| 3 | 28 | 7 | 3 | 2 | 2 | 0 | 0 | 42 | 12 | 30 | 0 | | 11 | 28 | buddy |
| 4 | 28 | 5 | 4 | 1 | 0 | 0 | 0 | 56 | 13 | 30 | 0 | y | 14 | 43 | |
| 5 | 43 | 7 | 3 | 3 | 1 | 0 | 0 | 42 | 10 | 30 | 6 | | 10 | 23 | |
| 6 | 23 | 5 | 4 | 0 | 0 | 1 | 0 | 32 | 11 | 30 | 0 | y | 17 | 14 | |
| 7 | 14 | 7 | 2 | 2 | 2 | 1 | 0 | 16 | 4 | 30 | 0 | | 14 | 0 | |
| 8 | | | | | | | | | | | | | | 0 | broke |

Day 7 ends at minus 6 before the floor (4 cash left after the morning shop, 16 plus 4 in, 20 wages and 10 daily costs out); the till shows the signed Net and Cash 0, the save stores 0, and day 8 opens on the Broke card. The readable causes are all there: a tray on day 1 with 80 in the bank, a buddy on 50 a day of revenue, a pork butt blocking the only kettle for the first 40 seconds, fire left to die, walk-outs dragging word of mouth down so fewer people come.

### 20.5 What the sim changed in the design

These are the rules that exist because an earlier version of the numbers failed the anti-goals in the sim. They are not optional.

1. Prep window of 30 seconds before the first customer. With 20 seconds, the first plate hit the table 10 to 20 seconds after the gate opened and the first customers walked out on every seed. With 30 seconds and sausage at 14 seconds, plates are on the table when the gate opens.
2. The table is the menu. When customers ordered by price or by what was cooking, most ordered the slow meat and the queue wedged behind them while plates nobody wanted filled the table. Ordering from what is on the table, with a 20 percent share for what is cooking, removed the wedge without removing the wait for an empty table.
3. Table spots hold stacks by meat. Loose plate slots wedged in the same way.
4. One bag lights a cold cooker to 60. At plus 35 per bag from cold, lighting took two trips per cooker and the morning was dead time.
5. Two grate slots per kettle. With three, one kettle out-cooked anything the player could carry and the second kettle was not felt.
6. Flat good band from 50 to 85. A linear multiplier made a kettle at 50 cook at two thirds speed and every day ran slow.
7. Daily costs of 10. Without them a careless player who kept the fire alive treaded water at 5 plates a day forever, never broke and never progressing.
8. Brisket at 50 seconds and butt at 40. At 60 and 45, two brisket plates a day went unsold at close because the piece came off after the crowd thinned.

### 20.6 Rerunning it

The script is `pitsim-econ.mjs` in the Overseer's scratchpad for this task. `node pitsim-econ.mjs competent` prints seed 1 day by day and the eight-seed summary; `node pitsim-econ.mjs careless` the same; `QUIET=1` prints one summary line; `SEED=n` picks the seed shown; `SEEDS=1,2,3` picks the set; `node pitsim-econ.mjs competent trace 5` traces the agent's choices on day 5. Every constant can be overridden from the environment (`C_DAY_SECONDS=130`, `G_drum=300`, `P_brisket=20`, `T_butt=45`, `C_COLD_UNDER=0.01` to see the old cold rule (fire clamps to exactly 0, so this is "cold means 0"), `C_CLOSE_PENALTY=1` to see the rejected close-time penalty). The first-run script is kept beside it as `pitsim-econ.prev.mjs` for the before-and-after comparison in 20.2. If the builder changes a number in the `C` block of `pit-sim.js`, the same change goes into the script and both policies are rerun before the number is kept. A copy of the script should be committed beside the spec when the game is wired, so the check survives the scratchpad.

## 21. Acceptance for the prototype

- `node --check games/pit-sim/pit-sim.js` passes; the page loads in Chrome with zero console errors and zero network requests other than the two files.
- `index.html` has no inline script and no inline event handler; `pit-sim.js` is strict mode, ES2020, no dependencies.
- Day 1 is playable with one thumb at 375 px wide with no horizontal scroll, and every DOM control measures at least 44 by 44.
- With keyboard only: a full day, a purchase, a pause, a new game.
- The save key is `hs.pitsim.save`, written at the till and on purchases, removed on Start over, and a hand-edited save with a wrong version, extra keys and out-of-range numbers loads as a clean state without a console error.
- Reduced motion removes smoke, shake, hops and rain streaks.
- Playing competently by hand (sausage first, fire above 50, pull on the chime, buy in the sim's order) buys the second kettle on day 4 and the drum by day 13.
- Open the yard stays disabled with the reason line until a bag and a unit are on hand or in the cart; a till that ends below zero shows the signed Net and Cash 0 and the next morning is the Broke card.
- Every string on the page is from section 18, with no dashes, and the copy rules in the brief hold.
- No file other than the two game files and this spec is created or changed.

## 22. Rulings index (2026-10-18)

Twenty-five builder questions, answered in place. Where the builder's proposed default was adopted it is written above as the rule; the two places it was not (2 and the Coming next part of 24) say why in the Ruling column.

| # | Question | Ruling | Lives in |
|---|---|---|---|
| 1 | Step order, serve versus walk-out in one step | Fixed six-stage order; serve beats walk-out; a leaving customer is never served | 5.10 |
| 2 | Customers still in line at 125 | Leave with no penalty, counted as Left at close. Not the proposed walk-out: the sim never charged it and charging it moved the drum to day 14 | 3, 6.3, 9 |
| 3 | Meat and charcoal: cart or per tap | Cart, committed and saved on Open the yard; gear and hires immediate; steppers cap at cash and 99 | 8 |
| 4 | Open the yard with no charcoal or meat | Disabled with a reason line until a bag and a unit are on hand or in the cart | 7 |
| 5 | Broke condition | Cannot both light a fire and cook something; plates clause dropped; tested before the shop | 11, 19 |
| 6 | Negative cash at the till | Net signed, Cash floored at 0, debt forgiven, save stores 0, next morning Broke | 9 |
| 7 | Cold means exactly 0 | Whole Out band (under 10) is cold; label Light the fire under 10; sim rerun, no milestone moved | 5.4, 19 |
| 8 | Pull order | Per cooker in reach; burnt first by burn time, then overshoot fraction, then earliest put-on | 5.2 |
| 9 | Window in prog or real seconds | Prog units; Hot cooks and burns faster | 5.5 |
| 10 | In reach on a tile next to two stations | The station directly in front (facing); use-tile lists are BFS targets only | 4 |
| 11 | Keyboard bump | Sets facing only; Space or E acts; a key press cancels a tap path | 4, 5.2, 15 |
| 12 | Unlisted action table cells | Hands full or Nothing to do here; plates never leave the table; Take 1 more plate exception | 5.2 |
| 13 | Tray partial set-down | Set down what fits, keep the rest; No room only when zero fit | 5.2, 5.7 |
| 14 | Chip selection and board pickup | Chips affect the cooler only; board follows the stack rule, same for the buddy | 5.3 |
| 15 | Line behavior | Spots reserved at spawn, walk past decided at spawn, shift forward at 4 tiles per second, no collision, y-order draw, leave up own column | 4, 6.1 |
| 16 | Order rule 4 | Kept literal; burnt pieces weigh nothing; the 20 percent branch falls back to the table | 6.2 |
| 17 | Buddy and tender edges | Buddy reserves at pickup, aborts if emptied, waits at the table if no spot fits, runs during prep; tender literal, prep included | 5.8, 5.9 |
| 18 | Hire timing | Morning toggles apply to the day being opened | 8.4 |
| 19 | Status line precedence | Saving off > Can't get there > Gate opens in > Last call (3 s) > Holding or Hands empty | 14.3 |
| 20 | Yesterday line and rain after a reload | Stay on v1; omit the line after a load; rain re-rolled at clipboard open | 7, 11, 12 |
| 21 | Unowned footprints | Walkable grass under the outline; impassable once bought | 4 |
| 22 | Canopy over heads and bubbles | Canvas and back poles before sprites, front poles after, bubbles and bars last; 50 percent alpha if needed | 13 |
| 23 | Day boundary in the save | The till saves the next morning: day plus 1, cash after wages and floor, stock after spoilage | 9, 12 |
| 24 | Escape and hidden tab on panels | Escape: pause resumes, confirm keeps playing, nothing on clipboard, till, Broke; visibility pause only in prep and service. Coming next is a clipboard card, not a dialog, so the proposed Escape dismissal does not apply | 11, 12, 14.3, 15 |
| 25 | Pixel font casing | Canvas text uppercase, a duplicate of the DOM status line, not a separate string | 13, 18 |
