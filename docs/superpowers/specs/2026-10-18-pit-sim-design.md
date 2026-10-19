# Pit sim, backyard rung: design spec

**Date:** 2026-10-18
**Slug:** `pit-sim`
**Working title on the page:** YOUR PIT (the player's business is fictional and unnamed; the page never calls it a Holy Smokes business)
**Ships as (prototype):** `games/pit-sim/index.html` and `games/pit-sim/pit-sim.js`, nothing else. Standalone HTML document, `pit-sim.js` loaded with `defer`, zero inline script, zero inline event handlers, no external resources, no build step, vanilla ES2020 in strict mode.
**Status:** spec for the builder. Prototype of the backyard rung only. Joel plays it on his Android phone; if it is fun in the first three minutes it goes on to iteration, then a11y and security lenses, then wiring and deploy. None of that is in this document.
**Economy:** every number in section 19 was tuned with a headless Node simulation of the day loop (section 20). A builder who changes a number in the `C` block should rerun it.
**Revision 2026-10-18, v2 review round 2:** the canvas scale is picked in device pixels (`k = floor(target * dpr)`, CSS scale `k / dpr`), so every game pixel is a whole number of device pixels on Android widths and DPRs, and desktop 3x needs room for the controls under the canvas (V2.13); three props fill dead tiles (pot3 (4,8), pot4 (2,2), woodpile4 (9,4)) and (4,8) leaves the dog roam list; kettle grate slots move inside the kettle; ghosts of unowned gear and decor show only in the morning and evening; the unbought flower bed shows tilled soil; the hedge alternates a blossom frame; the day 1 cooler is a red cooler; floating numbers are outlined text over the served customer, the tip above the cash, the seat tip over the heart, and overlapping numbers wait their turn; sparkles are 2x; order bubbles sit 2 px higher; fire gauges draw with their cooker in the y-sort; the dog does not stand behind a seated customer; the till's bold row reads Take today. 113 sprites, 268 frames. The amended rows are marked "(round 2)". No economy number changed.
**Revision 2026-10-18, v2 review round 1:** four props fill dead pavers (woodpile2 (4,1), woodpile3 (5,1), planter2 (1,4), shelf (2,3)); unowned gear and decor draw a see-through ghost under the dashed outline, which is outline colored on pavers; the customer route from the gate to the line is drawn with pavers (render only); the back fence row uses a 16 px `fence_back` sprite inside the canvas; floating numbers sit in boxed pills and last longer; the heart is 2x on the seat's column. 113 sprites, 266 frames. The amended rows are marked "(round 1)" in V2.2, V2.2.2, V2.9 and V2.11. No economy number changed.
**Revision 2026-10-18, v2:** the section "v2 (2026-10-18): dense yard, seating, feedback" below is the governing amendment for the v2 build; it supersedes sections 4, 13 and 14.1 and the canvas scale of 14.2, and amends others where it says so.
**Revision 2026-10-18 (same day):** twenty-five builder questions answered in place; section 22 indexes where each ruling lives. The sim was rerun with the rule changes the rulings imply (cold band, cash floor, Broke test, one distance) and the tables in section 20 are from that rerun.

---

## v2 (2026-10-18): dense yard, seating, feedback

**Status:** spec amendment for the v2 build of the backyard rung. Read this section first. Where it and the sections below disagree, this section wins. It **supersedes** section 4 (the yard and tile map), section 13 (sprites) and section 14.1 (palette) in full, and section 14.2 (scaling) for the canvas size and scale; those sections stay below, marked superseded, for history. It **amends** sections 3, 5.8, 5.9, 6.1, 6.4, 6.5, 9, 10, 12, 16, 17, 18 and 19 where it says so. Everything else (the day loop, the clipboard, the till, gear, hires, the economy numbers, the copy rules, the accessibility baseline) stands as written, except `WALK_TILES_PER_S`, which goes from 5 to 6.

**Why:** Joel played the prototype (commit 883b0ad) on his Android phone on 2026-10-18: "Good idea but the game could be better. Stuff is too spaced out." He sent two reference screenshots, a cafe sim (seated customers with food bubbles, every tile furnished, warm colors) and a farm sim (3/4 top-down pixel art, dense fields, tall sprites, floating EXP and UP popups, sparkles, saturated greens and pinks). The full direction and the reading of both references are in `docs/superpowers/specs/2026-10-18-pit-sim-v2-direction.md`. That file carries a copy of this amendment; the copy in the design spec governs if the two ever drift.

### V2.1 View

3/4 top-down, like the farm reference. Not isometric: tapping, BFS and the tile grid stay as they are. The ground is an 11 by 12 grid of 16 px tiles (176 by 192 virtual px). Every object is a sprite anchored at its bottom tile and may be taller and wider than a tile. A sprite of size `w` by `h` anchored at tile `(ax, ay)` (its bottom left tile) is drawn with its top left at:

```
x = ax * 16 + dx
y = (ay + 1) * 16 - h + dy
```

`dx` and `dy` are 0 unless a table below gives a draw position. People are 16 by 24 and are drawn at `(Math.round(px), Math.round(py) - 8)`, so their feet sit on the bottom row of their tile and their head rises 8 px into the tile above. Tall things overlap the tile above them; the y-sort in V2.12 makes the player and NPCs pass behind them.

### V2.2 The yard: 11 by 12 map

Columns x 0 to 10, rows y 0 to 11. One glyph per tile. Ground type, blockers and owners are in the legend under the grid.

```
        x:  0  1  2  3  4  5  6  7  8  9 10
  y0        #  S  S  S  #  #  #  #  #  #  #
  y1        #  S  S  S  V  V  C  .  ^  W  #
  y2        #  R  o  .  P  K  .  k  .  Y  #
  y3        #  o  .  E  .  .  .  D  .  o  #
  y4        #  N  .  X  .  B  .  D  .  W  #
  y5        #  H  .  .  .  .  .  .  .  U  #
  y6        #  h  h  h  L  t  T  T  L  h  #
  y7        #  f  a  b  a  b  a  1  2  3  #
  y8        #  f  r  r  o  s  s  b  a  4  #
  y9        #  f  q  q  w  p  p  c  c  5  #
  y10       #  f  f  f  f  f  f  F  F  b  #
  y11       #  #  #  #  #  #  #  #  M  G  #
```

Actors and spots, on the same grid with everything else dotted out:

```
        x:  0  1  2  3  4  5  6  7  8  9 10
  y2        .  .  .  e  .  .  .  .  .  .  .     e  fire tender idle (3,2), faces right, toward the pile
  y3        .  .  .  .  .  .  @  .  .  .  .     @  player spawn (6,3), faces up
  y5        .  .  .  .  u  .  .  .  .  .  .     u  buddy idle (4,5), faces up, toward the board
  y7        .  .  d  d  D  d  d  .  .  .  .     d  dog roam tiles
  y8        .  .  .  .  .  .  .  d  d  .  .     D  dog home (4,7), also a roam tile
  y10       .  .  .  .  .  .  .  .  .  x  .     x  pass stop (9,10)
  y12                                  +        +  customer spawn (9,12), one tile below the gate, off canvas
```

Ground types (`MAP.T`): `PAVER 0`, `FENCE 1`, `GATE 2`, `LAWN 3`, `HEDGE 4`, `BED 5`. Blockers come from objects, not ground: fixed props, active stations and owned decor (V2.2.1 to V2.2.4).

| Glyph | Ground | Thing | Tiles | Player | Customers | Drawn as |
|---|---|---|---|---|---|---|
| `#` | FENCE | Fence | x=0 and x=10 (y 0 to 11), y=0 (x 4 to 9), y=11 (x 1 to 8) | blocks | blocks | `fence_h` on row 11, `fence_v` on columns 0 and 10, `fence_corner` at (0,11) (10,11), all 16x24; row 0 draws the 16x16 `fence_back` at y = 0 (frame 1 at the corners (0,0) and (10,0)), so nothing is clipped (round 1) |
| `G` | GATE | Gate | (9,11) | blocks | walks | `gate` 16x24, frame 1 (open) during service while the clock is in [GATE_OPENS, LAST_CALL) or any customer is in `state.customers`, so it stays open while the last eaters, to go customers and walk-outs leave after last call; frame 0 (shut) otherwise |
| `S` | PAVER | Shed wall | (1,0) (2,0) (3,0) (1,1) (2,1) (3,1) | blocks | n/a | `shed` 48x32 at px (16,0), window and door, roof edge on top |
| `.` | PAVER | Pavers, cook area | every `.` in rows 1 to 5 | walks | n/a | `paver`, frame `(x * 7 + y * 3) % 2` |
| `^` | PAVER | Pavers under the tree canopy | (8,1) | walks | n/a | `paver`, drawn behind the canopy by the y-sort |
| `a` `b` | LAWN | Lawn, mowed stripes | every `a` and `b`: `a` where x is even, `b` where x is odd | blocks (not paver) | walks | `lawn_a` or `lawn_b`; frame 1 (clover) inside an unowned decor footprint and where `(x * 5 + y * 3) % 3 === 0`, else frame 0 (round 2) |
| `f` | BED | Flower beds, fixed | left fence run (1,7) (1,8) (1,9) (1,10); bottom fence run (2,10) (3,10) (4,10) (5,10) (6,10) | blocks | blocks | `bed` 16x20, frame `(x + y) % 3` (pink, yellow, mixed) |
| `h` | HEDGE | Hedge, the line between pavers and lawn | (1,6) (2,6) (3,6) (9,6), and under the light posts (4,6) (8,6) | blocks | blocks | `hedge` 16x24 |
| `R` | PAVER | Tool rack (spatula, tongs, brush) | (1,2) | blocks | n/a | `tools` 16x24 |
| `o` | PAVER (LAWN at (4,8)) | Herb pot | (1,3) and (9,3); round 2 adds (2,2) under the shed window and (4,8) in the lawn nook between the picnic tables | blocks | n/a | `pot` 16x16 |
| `H` | PAVER | Hose coil | (1,5) | blocks | n/a | `hose` 16x16 |
| `U` | PAVER | Sunflower planter, half barrel | (9,5) | blocks | n/a | `planter` 16x24 |
| `W` | PAVER | Woodpile | (9,1); round 2 adds (9,4) by the right fence | blocks | n/a | `woodpile` 16x16 |
| `V` | PAVER | Woodpiles behind kettle 1, closing the unreachable pocket (round 1) | (4,1) (5,1) | blocks | n/a | `woodpile` 16x16 |
| `N` | PAVER | Second sunflower planter, the dead end below pot 1 (round 1) | (1,4) | blocks | n/a | `planter` 16x24 |
| `E` | PAVER | Sauce shelf beside the trash (round 1) | (2,3) | blocks | n/a | `shelf` 16x24 |
| `Y` | PAVER | Tree trunk; the canopy overhangs (8,0) (9,0) (8,1) (9,1) | (9,2) | blocks | n/a | `tree` 32x48 at px (128,0) |
| `M` | FENCE | Mailbox at the gate | (8,11) | blocks (fence) | blocks (fence) | `mailbox` 16x24, drawn over the fence tile |
| `C` | PAVER | Cooler station (a crate on day 1) | (6,1) | blocks | n/a | `cooler` |
| `P` | PAVER | Charcoal pile station | (4,2) | blocks | n/a | `pile` |
| `K` | PAVER | Kettle 1 station | (5,2) | blocks | n/a | `kettle` |
| `k` | PAVER | Kettle 2 footprint | (7,2) | walks until bought | n/a | dashed outline until bought, then `kettle` |
| `D` | PAVER | Drum smoker footprint | (7,3) (7,4) | walks until bought | n/a | one 16x32 dashed outline until bought, then `drum` |
| `B` | PAVER | Cutting board station | (5,4) | blocks | n/a | `board` |
| `X` | PAVER | Trash station | (3,4) | blocks | n/a | `trash` |
| `T` | PAVER | Counter (the serving table) | (6,6) (7,6) | blocks | blocks | `counter` 32x24 |
| `t` | PAVER | Counter extension footprint (Bigger table) | (5,6) | walks until bought | blocks | dashed outline until bought, then `counter_ext` |
| `L` | HEDGE | String lights post footprints (decor) | (4,6) (8,6) | blocks | blocks | dashed outline over the hedge until bought, then `lights_post` |
| `p` | LAWN | Picnic table 1, fixed, owned from day 1 | (5,9) (6,9) | n/a | blocks | `picnic` 32x24 and `picnic_bench` 32x8 |
| `s` | LAWN | Picnic table 1 seats | (5,8) (6,8) | n/a | goal only | lawn, with the far bench drawn under the sitter |
| `q` | LAWN | Picnic table 2 footprint (decor) | (2,9) (3,9) | n/a | walks until bought, then blocks | dashed outline 32x16 until bought |
| `r` | LAWN | Picnic table 2 seats (decor) | (2,8) (3,8) | n/a | walks until bought, then goal only | lawn |
| `c` | LAWN | Lawn chair footprints (decor); the chair tile is the seat | (7,9) (8,9) | n/a | walks until bought, then goal only | dashed outline until bought, then `chair` |
| `w` | LAWN | Bird bath footprint (decor) | (4,9) | n/a | walks until bought, then blocks | dashed outline until bought, then `birdbath` |
| `F` | LAWN | Flower bed footprint (decor) | (7,10) (8,10) | n/a | walks until bought, then blocks | dashed outline 32x16 over `bed` frame 3 (tilled soil, round 2) until bought, then `bed` frames 0 and 1 |
| `1` to `5` | LAWN | Queue spots in line order | 1 (7,7), 2 (8,7), 3 (9,7), 4 (9,8), 5 (9,9) | n/a | walks | lawn; spots 4 and 5 are active only with the Bigger table |

#### V2.2.1 Walkability

- **Player, buddy, tender:** inside the map, ground `PAVER`, no fixed prop blocks the tile, no active station tile. Unowned footprints (kettle 2, the drum, the counter extension) are pavers under a dashed outline and are walkable until bought; the moment one is bought, anyone standing on it is moved to the nearest walkable tile (unchanged rule). Lawn, beds, hedge and fence are never walkable for them, so the hedge row and the counter keep the pitmaster on the pit side without a separate rule.
- **Customers:** the tile is `MAP.custSpawn`, or its ground is `LAWN` or `GATE`; and no fixed prop blocks it (picnic table 1); and it is not a blocking tile of an owned decor footprint (picnic table 2, the bird bath, the flower bed); and it is not a seat tile, except that the customer's own BFS goal may be a seat tile. Seats of unowned decor are plain lawn. Customers never collide with each other, the dog or anyone.
- **Dog:** the customer rule without the seat exception. The dog is cosmetic (V2.9) and never blocks anyone.

BFS for everyone is 4-directional with neighbor order up, down, left, right (the sim's existing `DIR_ORDER`), so routes are deterministic.

#### V2.2.2 Fixed props (`MAP.props`)

Always present, never bought, never sold. Draw positions are the top left pixel; the sort row is the row used by the y-sort (V2.12).

| id | sprite | size | anchor tile | draw at px | blocks tiles | sort row |
|---|---|---|---|---|---|---|
| `shed` | `shed` | 48x32 | (1,1) | (16,0) | (1,0) (2,0) (3,0) (1,1) (2,1) (3,1) | 1 |
| `sign` | `sign` | 44x12 | (4,0) | (68,2) | none (hangs on the back fence) | 0 |
| `tree` | `tree` | 32x48 | (9,2) | (128,0) | (9,2) | 2 |
| `woodpile` | `woodpile` | 16x16 | (9,1) | (144,16) | (9,1) | 1 |
| `tools` | `tools` | 16x24 | (1,2) | (16,24) | (1,2) | 2 |
| `pot1` | `pot` | 16x16 | (1,3) | (16,48) | (1,3) | 3 |
| `pot2` | `pot` | 16x16 | (9,3) | (144,48) | (9,3) | 3 |
| `hose` | `hose` | 16x16 | (1,5) | (16,80) | (1,5) | 5 |
| `planter` | `planter` | 16x24 | (9,5) | (144,72) | (9,5) | 5 |
| `mailbox` | `mailbox` | 16x24 | (8,11) | (128,168) | none (fence tile) | 11 |
| `picnic1` | `picnic` | 32x24 | (5,9) | (80,136) | (5,9) (6,9) | 9 |
| `bench1` | `picnic_bench` | 32x8 | (5,8) | (80,136) | none | 8 |
| `woodpile2` (round 1) | `woodpile` | 16x16 | (4,1) | (64,16) | (4,1) | 1 |
| `woodpile3` (round 1) | `woodpile` | 16x16 | (5,1) | (80,16) | (5,1) | 1 |
| `planter2` (round 1) | `planter` | 16x24 | (1,4) | (16,56) | (1,4) | 4 |
| `shelf` (round 1) | `shelf` | 16x24 | (2,3) | (32,40) | (2,3) | 3 |
| `pot3` (round 2) | `pot` | 16x16 | (4,8) | (64,128) | (4,8) | 8 |
| `pot4` (round 2) | `pot` | 16x16 | (2,2) | (32,32) | (2,2) | 2 |
| `woodpile4` (round 2) | `woodpile` | 16x16 | (9,4) | (144,64) | (9,4) | 4 |

The sign carries YOUR PIT in the pixel font, cream on its umber board with an orange border (site tones), the text drawn at px (70,5) with `art.text`. It duplicates the page title and is not a new string.

#### V2.2.3 Queue, gate, spawn, idles

| Spot | Tile | Facing | Notes |
|---|---|---|---|
| Queue 1, front | (7,7) | up | under the counter's right tile |
| Queue 2 | (8,7) | left | |
| Queue 3 | (9,7) | left | the corner by the right fence |
| Queue 4 | (9,8) | up | active only with `gear.bigtable` |
| Queue 5 | (9,9) | up | active only with `gear.bigtable` |
| Gate | (9,11) | | customers enter and leave here |
| Customer spawn | (9,12) | up | off canvas; customers appear and are removed here |
| Pass stop | (9,10) | up | a walk past stops here for `WALK_PAST_PAUSE`, then leaves |
| Player spawn | (6,3) | up | |
| Buddy idle | (4,5) | up | not a use tile of any station |
| Fire tender idle | (3,2) | right | not a use tile; the pile (4,2) is the tile he faces, so grabbing a bag needs no walk |
| Dog home | (4,7) | | the dog starts and naps here; `MAP.dogHome = { x: 4, y: 7 }`, replacing (4,8) in contract D4 (this spec governs). Moved off (4,8) so the owned bird bath at (4,9), 16x24, never covers the napping dog |
| Dog roam | (2,7) (3,7) (4,7) (5,7) (6,7) (7,8) (8,8) | | the dog walks between these over the dog grid. Round 2: (4,8) holds pot3 and is no longer a roam tile, and the dog skips a roam tile whose south neighbor is a taken seat, so it never stands behind a seated customer's head. A dog on (7,8) or (8,8) behind owned chairs with nobody seated is partly covered; that is the 3/4 view working, not a defect |

The line runs from the counter along row 7 to the right fence, then down the fence toward the gate. Customers walk from the spawn up through the gate to their reserved spot by BFS; with no collision they pass through occupied spots freely.

#### V2.2.4 Seats (`MAP.seats`)

All seats face down, toward the camera, so every seated face is visible.

| Seat id | Tile the customer sits on | Facing | Comes with | Furniture drawn |
|---|---|---|---|---|
| `pt1b` | (6,8) | down | day 1 (picnic table 1) | `picnic_bench` behind, `picnic` in front |
| `pt1a` | (5,8) | down | day 1 (picnic table 1) | same |
| `chair1` | (7,9) | down | decor `chair1` | `chair` on the seat tile |
| `chair2` | (8,9) | down | decor `chair2` | `chair` on the seat tile |
| `pt2b` | (3,8) | down | decor `picnic2` | `picnic_bench` behind, `picnic` in front |
| `pt2a` | (2,8) | down | decor `picnic2` | same |

`MAP.SEAT_ORDER = ['pt1b', 'pt1a', 'chair1', 'chair2', 'pt2b', 'pt2a']`, nearest to the front of the line first (BFS steps from queue 1: 2, 3, 2, 3, 5, 6). The seated sprite `cust{n}_sit` is drawn at (seat px, seat py - 6). While a customer is in mode `eating` (the `HEART_SECONDS` pause included), their `plate_{meat}` is drawn in the y-sorted pass with layer 5 (V2.12):

- **Picnic seat:** on the table at (seat px + 4, seat py + 17). It sorts on the table row, `(seat y + 1) * 16 + 15` (159 for both picnic tables), so it draws right after the picnic table and before the row 10 beds.
- **Lawn chair:** in the lap, where the sit sprite's arms reach, at (seat px + 4, seat py + 9). It sorts on the chair row, `seat y * 16 + 15` (159), after the chair and the sitter.

### V2.3 Stations

Ground under every station is `PAVER`. Faces are the direction from the use tile toward the station. Use tiles are BFS targets for tap to walk; reach is still the station on the tile directly in front of the player (unchanged rule from section 4).

| id | type | gear | tiles | use tiles (x, y, face) | sprite | size | draw at px |
|---|---|---|---|---|---|---|---|
| `kettle1` | cooker | none | (5,2) | (6,2,left) (5,3,up) | `kettle` | 16x24 | (80,24) |
| `kettle2` | cooker | `kettle2` | (7,2) | (6,2,right) (8,2,left) (7,1,down) | `kettle` | 16x24 | (112,24) |
| `drum` | cooker | `drum` | (7,3) (7,4) | (6,3,right) (6,4,right) (8,3,left) (8,4,left) (7,5,up) | `drum` | 16x32 | (112,48) |
| `board` | board | none | (5,4) | (6,4,left) (5,3,down) (5,5,up) (4,4,right) | `board` | 16x16 | (80,64) |
| `cooler` | cooler | none | (6,1) | (6,2,up) (7,1,left) | `cooler` | 16x16 | (96,16) |
| `table` | table | none | (6,6) (7,6), plus (5,6) with `bigtable` | (6,5,down) (7,5,down), plus (5,5,down) with `bigtable` | `counter`, plus `counter_ext` | 32x24, plus 16x24 | (96,88), plus (80,88) |
| `pile` | pile | none | (4,2) | (4,3,up) | `pile` | 16x16 | (64,32) |
| `trash` | trash | none | (3,4) | (4,4,left) (3,3,down) (3,5,up) (2,4,right) | `trash` | 16x16 | (48,64) |

Labels, spoken names, slots and decay are unchanged from contract 2.3.2. Station ids, types and the order of `MAP.stations` are unchanged. The pile lists one use tile on purpose: (3,2) also touches it, and that is where the fire tender idles. (4,1) and (5,1) are a closed pocket, boxed in by the shed, the pile, kettle 1, the cooler and the back fence, so neither is a use tile: the first draft listed (5,1) for kettle 1 and the cooler, which no BFS could reach (amended at integration, 2026-10-18).

Tiles that touch two or three stations (reach resolves by facing; a tap faces the tapped station): (6,2) cooler up, kettle 1 left, kettle 2 right; (5,3) kettle 1 up, board down; (6,4) board left, drum right; (7,5) drum up, counter down; (5,5) board up, counter extension down; (4,4) board right, trash left; (7,1) cooler left, kettle 2 down.

Pixel anchors the renderer and the sim share:

- Grate slots (`slotPx`, offsets from the top left pixel of the station's first tile): kettles `[(0,-7), (6,-7)]` (round 2: both pieces inside the kettle's 16 px, overlapping 4 px in the middle); drum `[(-2,-4), (8,-4), (-2,7), (8,7)]`.
- Counter plate spots (`spotPx`, absolute px, the top left of the bottom plate; each further plate draws 1 px higher, up to 6): index 0 (98,92), 1 (108,92), 2 (118,92); with `bigtable` also 3 (88,92) and 4 (80,92). `table.spots[i]` is drawn at `spotPx[i]`. The `served` event's `x, y` are the `spotPx` of the spot the plate came from.
- Board stacks: offsets (1,3) (8,3) (1,9) (8,9) from the board tile's top left, as before.
- Fire gauge: 3 px wide at x = station px + 18, from the sprite's top + 4 to its bottom, colored by band (V2.10), ticks at 50 and 85. `slotPx` stays as above; + 18 clears the second grate piece, which runs from + 8 to + 17. The gauge is drawn in render pass 5 with the patience bars (V2.12), not in the y-sorted station draw, so a person on (6,2), (8,2) or (8,3) never covers it. On kettle 1 its top 4 rows sit over the cooler crate's lower left corner; that is accepted.
- Counter extension: `Station` keeps one `sprite` and one `draw`; there is no new field. `game.js` derives the extension from the `table` tile whose `gear` is `'bigtable'`, (5,6), with the V2.1 formula: `counter_ext` at x = 5 * 16 = 80, y = (6 + 1) * 16 - 24 = 88, drawn only while `gear.bigtable` is owned, and `counter` is drawn in frame 1 while it is owned (frame 0 otherwise). The table's tap hit boxes (V2.13) are the `counter` rect (96, 88, 32 by 24) plus, when owned, the `counter_ext` rect (80, 88, 16 by 24).

### V2.4 Distances and the cook loop

At `WALK_TILES_PER_S` 6 a tile takes 0.167 s. BFS steps between use tiles, checked with a BFS over this exact grid:

| Leg | From tile | To tile | Steps | Seconds |
|---|---|---|---|---|
| Cooler to kettle 1 | (6,2) | (6,2) | 0 (turn) | 0 |
| Kettle 1 to board | (6,2) | (5,3) | 2 | 0.33 |
| Kettle 1 to board, standing below the kettle | (5,3) | (5,3) | 0 (turn) | 0 |
| Board to counter | (5,5) | (6,5) | 1 | 0.17 |
| Board to counter, standing above the board | (5,3) | (6,5) | 3 | 0.50 |
| Counter back to cooler and kettles | (6,5) | (6,2) | 3 | 0.50 |
| Kettles to charcoal pile | (6,2) | (4,3) | 3 | 0.50 |
| Charcoal pile to kettle 1 | (4,3) | (5,3) | 1 | 0.17 |
| Kettle 1 to trash | (5,3) | (4,4) | 2 | 0.33 |
| Counter to charcoal pile (the one long leg) | (6,5) | (4,3) | 4 | 0.67 |
| Charcoal pile to kettle 2 | (4,3) | (6,2) | 3 | 0.50 |
| Charcoal pile to drum | (4,3) | (6,3) | 2 | 0.33 |
| Kettle 2 to board | (6,2) | (5,3) | 2 | 0.33 |
| Drum to board | (6,4) | (6,4) | 0 (turn) | 0 |
| Buddy idle to board | (4,5) | (5,5) | 1 | at 4 tiles/s, 0.25 |
| Buddy, board to counter | (5,5) | (6,5) | 1 | 0.25 |
| Fire tender idle to kettle 1 | (3,2) | (5,3) | 3 | 0.75 |
| Fire tender idle to kettle 2 | (3,2) | (6,2) | 5 | 1.25 |
| Fire tender idle to the drum | (3,2) | (6,3) | 4 | 1.00 |

Every regular leg is 0 to 3 steps; counter to pile is 4. A plate cycle (cooler, kettle, board, counter, back) is about 8 steps against about 15 in the prototype. The fire tender idles at (3,2) (amends 5.9).

**The buddy's route** (amends 5.8 and contract 2.5.6; his idle tile is (4,5), not (5,9), and he walks by BFS between the board and the counter). His idle tile is only diagonal to the board, so every plate starts with a walk. His task values stay `'idle' | 'pickup' | 'carry' | 'wait' | 'return'` (contract D6: buddy objects unchanged); the walk to the board is the first part of `pickup`.

1. **idle** at (4,5), facing up. When `chooseBoardStack()` gives a stack whose meat fits the table, he reserves that meat as in v1 and enters `pickup`.
2. **pickup, walking:** BFS (player grid) to (5,5), the board's use tile facing up. If the BFS returns null he releases the reservation and stays idle. On arrival he faces up and `t = BUDDY_HANDLE` starts counting down; the 0.4 s handle runs only after he arrives.
3. **pickup, handle done:** re-check the reserved stack. If it is gone (the player took the last plate), release it and go to `return`. Otherwise take 1 plate as in v1.
4. **carry:** BFS to `table.use[0]`, (6,5), and face down on arrival. He always sets down from (6,5), with or without the Bigger table, even though (5,5) is also a counter use tile once the extension is owned. If the BFS returns null he puts the plate back on the board and goes to `return`.
5. **wait:** set down exactly as v1 (waits holding the plate until a spot fits, then `BUDDY_HANDLE`).
6. **return:** BFS to (4,5), face up on arrival, `idle`.

That is 1 + 1 + 2 = 4 steps at 4 tiles per second plus two 0.4 s handles, about 1.8 s a plate. The zzz of V2.9 counts sim clock seconds spent in task `idle` (`game.js` notes `state.clock` when the task becomes `idle`); the sim clock stops while paused, so a pause never counts toward it.

### V2.5 Customers in v2

Amends sections 6.1, 6.4 and 6.5 and contract 2.5.6. Spawning, the order roll, patience, the walk past decision and the counter tip formula are unchanged.

1. **Routes.** Every customer walk is a BFS over the customer grid (V2.2.1) at `NPC_TILES_PER_S` 4: spawn (9,12) to the reserved queue spot; shift forward to the new spot; queue spot to seat; seat or queue spot to the spawn, where the customer is removed. A walk past goes from the spawn to the pass stop (9,10), pauses `WALK_PAST_PAUSE` facing up, and goes back. The fixed column routes of contract 2.5.6 are gone.
2. **In line.** A customer at a spot faces that spot's facing (V2.2.3). Patience, the bar and walk-outs are unchanged. When patience falls to `SWEAT_FRAC` (0.25) of the max, a sweat drop shows (V2.9); at `PATIENCE_WARN_FRAC` (0.2) the bar turns red and the mood turns unhappy as before. Patience and `wait` advance only in mode `waiting`, as in v1; a waiting customer shifting forward one spot stays `waiting` and keeps draining. Nothing drains in `arriving`, `toSeat`, `eating`, `leaving` or `passing`: the clock on a customer stops at the serve. The order bubble and the patience bar (with its red warning) draw only in `arriving` and `waiting`; the sweat drop only in `waiting`. A `toSeat` customer shows no bubble and carries `hand_plate_{meat}`; the food bubble starts at `eating`.
3. **Served at the counter.** Serving still happens from the counter's stacks to customers in line, front first, with the same price, tip and `cash` changes. At the moment of serving the sim looks for a seat: the first id in `MAP.SEAT_ORDER` whose seat is owned, whose `state.seats[id]` is `null`, and for which a customer grid BFS from the customer's anchor tile (goal that seat) returns a path. If no seat qualifies, the serve is to go (step 6). On this map the BFS test never changes the pick: every seat is reachable from every queue spot, and the spawn from every seat, under all 64 decor combinations (V2.18 asserts it). It only defines the null case. If the BFS from a seat to the spawn ever returns null when a customer stands up, that customer is removed on the spot.
4. **Seat found.** The seat is reserved at once (`state.seats[id] = customer id`), and `seat_taken` is emitted. The sim draws one `rng()` for the eat time: `eatMax = EAT_MIN + (EAT_MAX - EAT_MIN) * rng()`, 8 to 12 s, seeded. The customer leaves the line (everyone behind shifts forward as before), turns to face the first step of the BFS route to the seat, holds `LEAVE_TURN_SECONDS`, and walks to the seat (mode `toSeat`) carrying the plate. On arrival: mode `eating`, facing down, `eat = eatMax`. A food bubble with the plate icon shows over the head, and the plate is drawn per V2.2.4 (on the table at a picnic seat, in the lap on a lawn chair).
5. **Done eating.** `moveCustomers` (stage 2) skips the pause and movement of customers in mode `eating`; it still counts down `hop` for everyone. The `eat` countdown and the `HEART_SECONDS` pause both run in stage 5, after the serve checks (contract D8). When `eat` reaches 0, the seat bonus tip is paid at once: `bonus = min(SEAT_BONUS_MAX, SEAT_BONUS_BASE + floor(charm / CHARM_STEP))`, that is 1 plus floor(charm / 10), capped at 3. `cash += bonus`, `today.seatTips += bonus`, `today.seated += 1`, `stats.seated += 1`, `bonusPaid = true`, emit `seat_done`. A heart pops over the head. The customer stays seated for `HEART_SECONDS` (0.6 s, counted down in `pause`) in the content frame, then stands, also in stage 5: the seat is freed at that moment (`state.seats[id] = null`), so it is free for a serve on the next tick; mode `leaving`, reason `seated`, mood happy, and they walk out through the gate by BFS at once, with no turn pause.
6. **No free seat: to go.** The customer takes it to go: emit `to_go`, `today.togo += 1`, mode `leaving`, reason `togo`, mood happy, the served hop, a takeout box in hand, BFS out through the gate. No seat bonus.
7. **Word of mouth per serve** (amends section 10): served quick (wait under 40 percent of patience) with a seat: +2 (`today.happy`). Served quick and to go: +1 (`REP_TOGO_QUICK`, `today.togoQuick`). Served otherwise, seated or to go: +1 (`today.ok`). Walk-out minus 3, walk past 0, left at close 0, as before. The seat choice is made at serve time, so these counters are final at serve time. The +1 for a quick to go serve, against +2 for every quick serve in v1, is intended: the Overseer's direction (item 4) names a slightly smaller rep gain for to go. Build it as written; the economy rerun in V2.19 item 2 checks what it does on busy days with only two seats.
8. **Freeing a seat.** A seated customer frees the seat only by standing up at the end of `HEART_SECONDS`. A reserved seat (customer still walking to it) is not free. Seats never carry over: `state.seats` is cleared at `openGate`.
9. **Day end** (amends section 3 and contract 2.5.2 and 2.7.5). The early end (after last call, or sold out per sim deviation 8) now also waits until no customer is in mode `toSeat` or `eating`, so a seated customer finishes and leaves before the till opens, at most 12.6 s plus the walk.
   - **Sold out.** On every tick where `soldOut()` is true and the clock is at or past `GATE_OPENS`, the sim runs `closeOutLine()` (everyone in line is left at close, no penalty) and sets `spawnAt = Infinity`, the same as at last call. Nothing can restock during service, so once sold out the yard stays sold out; `closeOutLine()` does nothing once the line is empty. No new customer spawns after that, so nobody is counted as walking past, and nobody still in line can walk out at minus 3 while the eaters finish. The day ends on the first such tick on which no customer is in `toSeat` or `eating`.
   - **Hard end** at `DAY_SECONDS` 125: first the line closes out as before (left at close, no penalty); then every customer still in `toSeat` or `eating` whose bonus is unpaid is paid the seat bonus on the spot (`seat_done` with `atClose: true`, no heart, no sentence, counted in both `today.seated` and `stats.seated`); then the till runs. A customer never loses a seat tip to the clock.
10. **Hop and moods.** Served customers hop once (0.3 s, skipped under reduced motion), seated or to go. Walk-outs leave with the unhappy walk frames.
11. **Facing on v2 routes.** The v1 code turns leavers `'up'`, which pointed at the v1 gate and now points at the counter; that rule is gone. Whenever the sim gives a customer a new BFS route (served to a seat, to go, walk-out, left at close, a shift forward, the walk in from the spawn), they face the direction of its first step; with an empty route they keep their facing. Leaving the line (to a seat, to go, walk-out, left at close) still holds `LEAVE_TURN_SECONDS`, spent facing that first step. Standing up from a seat routes at once with no turn pause. A walk past pauses at the pass stop facing up (v1 used down). On arrival at a queue spot the customer faces that spot's facing in `MAP.queue`; on arrival at a seat, down. While walking, everyone faces the step in progress, as before.

### V2.6 Charm

- Each owned decor item adds its `charm` (V2.7). `charm = min(CHARM_MAX, sum of owned decor charm)`, with `CHARM_MAX` 30. The full decor set is exactly 30.
- **Effect on tips:** the seat bonus only (V2.5 step 5). Charm 0 to 9 gives 1, 10 to 19 gives 2, 20 and up gives 3 per seated customer. The counter tip formula of section 6.4 does not change.
- **Effect on word of mouth:** the upper bound of the daily rep clamp becomes `REP_DAY_MAX + floor(charm / CHARM_STEP)`: 12 at charm 0 to 9, 13 at 10 to 19, 14 at 20 to 29, 15 at 30. The lower bound stays minus 15. Rep still drives only the arrival interval.
- Charm is computed, never saved (`sim.charm()`).

### V2.7 DECOR catalog

A new shop category, `kind: 'decor'`, shown between Gear and Hires. Decor buys work like gear: immediate, saved, announced, no undo, one of each, sold back at half on the Broke card. Footprints are fixed; unowned footprints show a dashed outline (V2.12). Picnic table 1 is not decor; it is a fixed prop owned from day 1.

| id | label | price | seats | charm | footprint tiles | seat tiles | prerequisite | effect line |
|---|---|---|---|---|---|---|---|---|
| `chair1` | Lawn chair | 25 | 1 | 3 | (7,9) | `chair1` (7,9) | none | One more seat by the line. Charm 3. |
| `chair2` | Second lawn chair | 25 | 1 | 3 | (8,9) | `chair2` (8,9) | `chair1` | One more seat by the line. Charm 3. |
| `flowers` | Flower bed | 30 | 0 | 4 | (7,10) (8,10) | | none | Flowers along the fence by the gate. Charm 4. |
| `birdbath` | Bird bath | 40 | 0 | 4 | (4,9) | | none | Birds stop by between the tables. Charm 4. |
| `lights` | String lights | 60 | 0 | 10 | (4,6) (8,6) | | none | Lights strung over the serving table. Charm 10. |
| `picnic2` | Second picnic table | 80 | 2 | 6 | (2,9) (3,9) | `pt2a` (2,8), `pt2b` (3,8) | none | Two more seats on the lawn. Charm 6. |

Draw positions when owned: `chair` at (112,136) and (128,136); `bed` frame 0 at (112,156) and frame 1 at (128,156); `birdbath` at (64,136); `lights_post` at (64,80) and (128,80) with `lights_string` at (71,80) in the overhead pass; `picnic` at (32,136) and `picnic_bench` at (32,136).

`needsText` for `chair2`: Needs the first lawn chair. Selling `chair1` on the Broke card also sells `chair2` (two sales, like the second kettle and the drum): `sell chair1` is emitted first, then `sell chair2`, and `sell()` returns the message Sold Lawn chair for 12 and Second lawn chair for 12. Sale prices, `floor(price * SELL_BACK)`: 12, 12, 15, 20, 30, 40.

"Like gear" includes the reserve warning: a decor row whose buy would leave less than `GEAR_RESERVE` (30) gets the same text appended to its effect line as a gear row (game.js deviation 10), Leaves {n}. A day of meat and charcoal is about 30.

Pricing against the tuned economy (section 20.3, competent seed 1): day 2 opens with 108 cash and day 3 with 136, so a 25 chair fits beside a day of meat and charcoal on day 2 or 3. The second kettle (90) lands on day 4, and the second picnic table at 80 is the same size of decision on the same mornings. Charm 10 from the lights adds a coin per seated customer, about 8 to 15 a day once the seats fill, so the lights pay back in 4 to 8 days. The seat bonus is on top of the prototype economy: nothing the prototype paid is taken away.

### V2.8 Day 1 yard

Day 1 opens with kettle 1, the crate at the cooler tile, the board, the counter with three plate spots, the pile with 0 bags, the trash, picnic table 1 with two seats, every fixed prop of V2.2.2, the hedge, both flower bed runs and the dog. Dashed outlines mark kettle 2, the drum, the counter extension, both chairs, picnic table 2, the bird bath, the decor flower bed and the two light posts. In the morning and evening each outline sits over a see-through ghost (alpha 0.5) of what will stand there; during service only the outlines show, so the yard reads as what is really there (round 2). The unbought flower bed shows its box of tilled soil (round 2). No lawn tile inside the fence is bare: every lawn tile is a stripe, a clover tile, a bed, a seat, a table, a queue spot, a dog roam tile or an outlined footprint.

### V2.9 Feedback

Every effect is cosmetic, drawn by `game.js`, timed in real seconds, and uses `game.js`'s own seeded generator (game.js deviation 4), never `sim.rng()`. Positions are offsets from the top left pixel of the named thing.

| Effect | Trigger | Where | Duration | Motion | Reduced motion |
|---|---|---|---|---|---|
| Cash number `+{price}` with a coin | `served` | over the served customer (round 2): coin at (px, py - 26), text at (px + 9, py - 26), clamped inside the canvas; yellow `k` outlined text, drawn four times in outline `5` at 1 px offsets and then in its color, no box (round 2). With no customer to read, the plate spot's (x, y - 6) | 1.4 s | rises 14 px, ease out (`14 * (1 - (1 - t)^2)`, t from 0 to 1 over 1.4 s); alpha 1 until 1.0 s, then linear to 0 | appears in place, same fade, no rise; the coin does not spin |
| Tip number `+{tip} TIP` | `served` with tip over 0 | 11 px above the cash number at the customer's px (`TIP_GAP_PX` -11, round 2), white `h` outlined text | 1.4 s | moves with the cash number | same as above |
| Waiting their turn (round 2) | a number whose box overlaps a number that started under 0.5 s ago (within 8 px in y), or a heart within 12 px of one that started under 0.5 s ago | | | starts 0.3 s later per such number, at most 3, so busy service reads one popup after another | same delay, no rise |
| Sparkles on the served plate | `served` | three `sparkle` drawn at 2x (14x14) centered on (-3,-4) (6,-7) (2,2) from the plate spot (round 2) | 0.45 s | frames 0, 1, 2 at 0.15 s each, staggered 0.05 s | none |
| Order bubble and patience bar | a customer in mode `arriving` or `waiting` (V2.5 step 2) | `bubble` at (px + 14, py - 22) with `icon_{meat}` at (px + 18, py - 20) inside; the patience bar, 14x3, at (px + 15, py - 26), just above the bubble (round 2: 2 px higher, clear of the next customer's head) | while in line | moves with the customer | same |
| Food bubble | a customer in mode `eating` with `eat` over 0 | `bubble` at (px, py - 21) with `plate_{meat}` at (+4, +3) inside; `cust{n}_sit` alternates frames 0 and 1 every 0.35 s | while eating | the fork moves; the bubble does not | sit frame 0, no alternation; the bubble shows |
| Heart | `seat_done` without `atClose` | `heart` drawn at 2x (16x16) at (seat px, seat py - 24) (round 1) | 1.4 s | frame 0 for 0.4 s then frame 1, rises 12 px, fades over the last 0.3 s | frame 0 in place for 1.4 s, then gone |
| Seat tip number `+{bonus} TIP` | `seat_done` without `atClose` | over the heart at (seat px - 4, seat py - 34), clamped inside the canvas, pink `i` outlined text (round 2) | 1.4 s | as the cash number | appears and fades in place |
| Content face | eating customer with `eat` at 0 (the `HEART_SECONDS` pause) | `cust{n}_sit` frame 2 | 0.6 s | none | same |
| Chimney puff | a lit kettle or drum: low band every 0.9 s, good every 0.45 s, hot every 0.3 s | kettle vent at (station px + 11, station py - 10); drum vent at (station px + 7, top tile py - 4); the 8 px `smoke` is drawn centered on the vent (round 1) | each puff 1.1 to 1.4 s | `smoke` frame by age, rises 8 px/s, drifts up to 3 px/s sideways, always away from the cooler's column (round 1), so kettle 1's stream stays off the cooler | none |
| Burnt burst | `piece_burnt` | three `smoke_dark` at (-3,0) (0,-2) (3,0) from the piece; plus the 1 px screen shake for 120 ms | 0.5 s | rise 12 px/s | none (the burnt piece frame carries it) |
| Burnt smoke column | a burnt piece still on a grate | one `smoke_dark` every 0.35 s at (piece x + 1, piece y - 3) | each 1.2 s | rises 10 px/s, sways 2 px | none |
| Sweat drop | a waiting customer at or under `SWEAT_FRAC` (0.25) of patience | `sweat` at (px + 12, py - 6) | repeats every 1.2 s | frame 0 slides down 3 px over 0.6 s, then frame 1 (splash) for 0.15 s | frame 0 shown still while it applies (it is information) |
| zzz | the buddy's task has been `idle` for `ZZZ_AFTER` (3 s) of sim clock without a break (V2.4; a pause does not count) | `zzz` at (px + 10, py - 14) | until his task changes | frames 0, 1, 2 every 0.5 s, drifting up 4 px a cycle | frame 2 shown still |
| Squash and stretch | a canvas tap that `walkTo` accepts (returns true) | the player sprite, anchored at the feet, centered | 0.12 s | drawn 18x22 for 0.06 s, then 14x26 for 0.06 s, then 16x24 | none |
| Served hop | `served` | the customer | 0.3 s | drawn 2 px higher | none |
| Walk out mark | `walk_out` | `mark_x` in that customer's bubble, at the order bubble position (the bubble at (px + 14, py - 20), the mark at (px + 18, py - 18)), following them as they leave | 0.6 s | none | same |
| Tap ring | any canvas tap | the tapped tile | 0.35 s | as game.js deviation 8 | ring kept, no shrink |
| Fire flame | a cooker in the good or hot band | `fire` at (station px + 4, sprite top - 4) | while lit | 6 fps | frame 0 |
| String lights twinkle | lights owned | `lights_string` | always | frames 0 and 1 swap every 0.5 s | frame 0 |
| Bird at the bath | bird bath owned | `birdbath` frame 1 | 2 s, every 8 to 14 s | none | frame 0 always |
| Dog | during service | the dog | always | see the dog rules below | sits at home (4,7) in frame 2 and never moves |
| Rain | rain day, service | as section 11 | | streaks | flat tint |

**Line bubble placement.** The v1 spots (bubble at py - 14, bar at py - 2) land on a 16x24 head, and a bubble above the head of queue 1 at (7,7) covers plate spots 1 and 2 (x 108 to 125). A side bubble for queue 1 alone would land on queue 2's bubble, so every customer in line uses the same side layout above. Along row 7 the three bubbles sit at x 126, 142 and 158 without touching each other, above the heads of the people behind; down the right fence (spots 3 to 5 at x 9) the bar and bubble of each spot stack under the one before (y 88 to 103, 104 to 119, 120 to 135); nothing in line covers the plate spots at x 80 to 125. The bubble's tail is at its bottom left corner, pointing at the head.

**Smoke frames.** `smoke` and `smoke_dark` puffs (chimney puffs, the burnt burst, the burnt smoke column) pick their frame by age: `frame = min(2, floor(3 * age / life))`, where `life` is that puff's duration from the table.

**Dog rules.**
- **Timer and pick:** the dog starts at `MAP.dogHome` (4,7). Each time it arrives at a tile it waits `2 + 3 * r` seconds, `r` from `game.js`'s own mulberry32 generator, then picks uniformly from `MAP.dogRoam` minus the tile it stands on, and walks there.
- **Path:** a 4 direction BFS run by `game.js`, neighbor order up, down, left, right, where a tile is open when `sim.custWalkable(x, y, -1, -1)` is true (the customer rule with no seat goal) and `y <= 10`, so the dog never takes the gate (9,11) or the spawn (9,12) and never leaves the yard. If the BFS returns null it stays put and picks again after the next wait.
- **Frames:** walking at 2 tiles/s uses walk frames 0 and 1, side view, flipped for right. A vertical step keeps the last horizontal facing and still uses frames 0 and 1. On arrival it sits (frame 2); on `dogHome` it naps (frame 3) instead. Frame 3 is used only on `dogHome`.
- **Panels and reduced motion:** during the morning and evening panels, and always under reduced motion, the dog snaps to home (4,7) in frame 2.

**Frozen yard.** During the morning and evening panels the yard is drawn frozen, and while the game is paused it holds as well: no effect advances, and nothing new spawns, so chimney puffs and the burnt smoke column stop when the phase leaves service. While paused the dog holds where it is; at the panels it is at home.

### V2.10 Palette

The canvas goes bright and saturated: 31 colors plus transparent. The DOM panels keep the site palette (the custom properties in `index.html`, unchanged). The first four canvas colors are the site tones; the canvas uses them for the sign and for the boxes it draws behind canvas text. Dark brown `5` is the outline color for wood, props and people; near black `1` is kept for eyes, burnt meat and the darkest shadows, so outlines read at 2x without going harsh.

| char | index | key | hex | role |
|---|---|---|---|---|
| `0` | 0 | | transparent | |
| `1` | 1 | `K` | #1b1714 | site near black: eyes, burnt meat, text box shadow |
| `2` | 2 | `U` | #2a2015 | site umber: sign board, canvas text boxes |
| `3` | 3 | `C` | #E6D8B8 | site cream: sign text, plates, tip numbers, clock text, footprint outlines |
| `4` | 4 | `O` | #D06129 | site orange: sign border, coals, orange shirt, gauge hot |
| `5` | 5 | `outline` | #3b2417 | dark brown outline for wood, props and people; number shadows |
| `6` | 6 | `woodD` | #7a4a26 | wood dark: fence shadow, shed boards, table legs, bark |
| `7` | 7 | `woodM` | #a8693a | wood mid: fence, benches, crate, board stand, woodpile |
| `8` | 8 | `woodL` | #d79a5b | wood light: table tops, board, highlights, gauge low |
| `9` | 9 | `paver` | #e8c890 | warm paver tan |
| `a` | 10 | `paverD` | #c9a46b | paver joints and shade |
| `b` | 11 | `lawnA` | #6cc24a | lawn stripe a, gauge good, patience bar full |
| `c` | 12 | `lawnB` | #4fa83d | lawn stripe b, mowed darker |
| `d` | 13 | `leafD` | #2f7a32 | hedge, tree shade, bed foliage |
| `e` | 14 | `leafL` | #a6e05a | leaf highlights, clover |
| `f` | 15 | `cloth` | #5bb8f0 | sky blue table cloth, shirts, bird bath water, sweat |
| `g` | 16 | `clothD` | #3a86c8 | cloth shade, deep water, cooler body |
| `h` | 17 | `white` | #fbf7ef | cloth and plate shine, eye whites, sparkles, bulb cores, flame cores |
| `i` | 18 | `pink` | #f27aa8 | flowers, cheeks, pink shirt |
| `j` | 19 | `magenta` | #d94a8c | flower shade, hearts, seat tip number |
| `k` | 20 | `yellow` | #ffd84a | flowers, sunflowers, coin, cash number, fire, bulbs, patience bar middle |
| `l` | 21 | `skinL` | #f6c49a | skin light |
| `m` | 22 | `skinM` | #d9935f | skin mid, shade for skin light |
| `n` | 23 | `skinD` | #8f5634 | skin dark |
| `o` | 24 | `red` | #d8402f | red shirt, mailbox, collar, mark x, patience bar warn |
| `p` | 25 | `raw` | #f29a9a | raw meat pink |
| `q` | 26 | `cooking` | #d0663e | cooking meat |
| `r` | 27 | `done` | #8e3b1f | done meat, mahogany |
| `s` | 28 | `steelL` | #9aa4ae | kettle lid shine, hose nozzle, trash lid, bird bath stone |
| `t` | 29 | `steelD` | #4d5560 | kettle bowl, drum body, trash can |
| `u` | 30 | `smokeL` | #ddd8cf | light smoke, chimney puffs |
| `v` | 31 | `smokeD` | #6e6863 | dark smoke from burnt meat, gauge out |

Hair uses `5` (dark brown), `o` (red), `k` (blonde) and `1` (black). Shirts use `4`, `f`, `o`, `i`, `h`; aprons `h` or `3`. Gauge bands: out `v`, low `8`, good `b`, hot `4`. Patience bar: `b` above `PATIENCE_MID_FRAC`, `k` down to `PATIENCE_WARN_FRAC`, `o` under it.

### V2.11 Sprites

Grids use only the characters `0` to `9` and `a` to `v`; `build()` rejects anything else. 113 names, 268 frames (round 1 added `fence_back` and `shelf`; round 2 added `hedge` frame 1, blossoms, and `bed` frame 3, tilled soil, and repainted `cooler` frame 0 as a red cooler). People are 16x24 with a head, hair, eyes with whites, a shirt, and an apron where the role has one. Side sprites face left and are flipped for right. Frame meanings are fixed so `game.js` can index them blind.

People and animals

| name | size | frames | shows |
|---|---|---|---|
| `player_down` | 16x24 | 3 | the pitmaster facing down, cap `4`, cream apron: stand, walk a, walk b |
| `player_up` | 16x24 | 3 | the same from behind |
| `player_side` | 16x24 | 3 | the same in profile, facing left |
| `player_slice` | 16x24 | 2 | knife up, knife down; replaces the body while slicing, any facing |
| `buddy_down` | 16x24 | 3 | the buddy, cap `k`, shirt `f`, no apron: stand, walk a, walk b |
| `buddy_up` | 16x24 | 3 | |
| `buddy_side` | 16x24 | 3 | |
| `tender_down` | 16x24 | 3 | the fire tender, wide hat `7`, shirt `o`, soot apron `6`: stand, walk a, walk b |
| `tender_up` | 16x24 | 3 | |
| `tender_side` | 16x24 | 3 | |
| `cust0_down` | 16x24 | 5 | customer 0 (shirt `4`, hair `5`, skin `l`): stand, walk a, walk b, unhappy walk a, unhappy walk b |
| `cust0_up` | 16x24 | 3 | stand (in line), walk a, walk b |
| `cust0_side` | 16x24 | 4 | stand, walk a, walk b, stand unhappy (a frown in profile) |
| `cust0_sit` | 16x24 | 3 | seated facing down, arms forward on the table: eat a (fork down), eat b (fork up), content (eyes shut, smile) |
| `cust1_down` `cust1_up` `cust1_side` `cust1_sit` | 16x24 | 5, 3, 4, 3 | customer 1: shirt `f`, hair `o`, skin `m` |
| `cust2_down` `cust2_up` `cust2_side` `cust2_sit` | 16x24 | 5, 3, 4, 3 | customer 2: shirt `i`, hair `k`, skin `l` |
| `cust3_down` `cust3_up` `cust3_side` `cust3_sit` | 16x24 | 5, 3, 4, 3 | customer 3: shirt `h` with an `o` stripe, hair `1`, skin `n` |
| `shadow` | 12x4 | 1 | soft ellipse in `5` on a checker; under every standing or walking person at (px + 2, py + 13) |
| `dog` | 16x16 | 4 | a small tan dog with a red collar, facing left: walk a, walk b, sit (facing down), nap (curled up, head at the right end with the ear up, shut eye and collar showing; round 1) |

Customer body is `arrivals % 4` (was `% 3`).

Hand overlays, 8x8, 1 frame each. Drawn at (px + 4, py + 4) after the body when facing down, left or right, and at (px + 4, py - 1) before the body when facing up.

| name | shows |
|---|---|
| `hand_charcoal` | a paper charcoal bag |
| `hand_raw_sausage` `hand_raw_chicken` `hand_raw_ribs` `hand_raw_butt` `hand_raw_brisket` | a raw piece in `p`, one shape per meat |
| `hand_cooked_sausage` `hand_cooked_chicken` `hand_cooked_ribs` `hand_cooked_butt` `hand_cooked_brisket` | the same shapes in `r` |
| `hand_burnt` | a black lump with a `v` highlight |
| `hand_plate_sausage` `hand_plate_chicken` `hand_plate_ribs` `hand_plate_butt` `hand_plate_brisket` | one plate with the meat; also carried by a customer walking to a seat |
| `hand_tray_sausage` `hand_tray_chicken` `hand_tray_ribs` `hand_tray_butt` `hand_tray_brisket` | two plates on a tray |
| `hand_tray` | the empty tray, drawn when `gear.tray` is owned and the hands are empty |
| `hand_togo` | a takeout box with a red stripe, carried by a to go customer as they leave |

Food, icons and marks

| name | size | frames | shows |
|---|---|---|---|
| `icon_sausage` `icon_chicken` `icon_ribs` `icon_butt` `icon_brisket` | 8x8 | 1 | order icons for bubbles, chips and shop rows |
| `plate_sausage` `plate_chicken` `plate_ribs` `plate_butt` `plate_brisket` | 8x6 | 1 | a plate with the meat: counter stacks, the food bubble, the plate on a picnic table |
| `piece_sausage` `piece_chicken` `piece_ribs` `piece_butt` `piece_brisket` | 10x10 | 4 | raw `p`, cooking `q`, done `r` with a cream ring and a check, burnt `1` with a `v` highlight |
| `mark_x` | 8x8 | 1 | a red X shown in a walk out's bubble |

Stations

| name | size | frames | shows |
|---|---|---|---|
| `kettle` | 16x24 | 4 | a kettle on three legs, lid hinged open behind the grate, a vent on the lid; by band: cold (no glow), low (dim `4` coals), good (`k` and `4`), hot (with `h` cores) |
| `drum` | 16x32 | 4 | an upright drum on short legs, steel lid and vent on top, a red painted body with a highlight stripe and mahogany shade (round 1), the same four bands showing at the intake |
| `cooler` | 16x16 | 3 | wooden crate (day 1), cooler shut (`g` body, `h` lid), cooler open (lid up, ice inside); frame 2 while the player is in reach of it with the cooler owned |
| `board` | 16x16 | 2 | cutting board on a wood stand with a leg crossbar: empty with a cleaver on it (round 1), with a piece being sliced |
| `counter` | 32x24 | 2 | the serving table with a sky blue cloth hanging over the front: frame 0 with both end caps, frame 1 with the right cap only (used when the extension is owned) |
| `counter_ext` | 16x24 | 1 | the extension: left end cap, cloth continuing |
| `pile` | 16x16 | 4 | charcoal sacks: full (over 6), half (3 to 6), low (1 to 2), bare (0, an empty pallet) |
| `trash` | 16x16 | 1 | a lidded steel can |

Ground, fence and hedge

| name | size | frames | shows |
|---|---|---|---|
| `paver` | 16x16 | 2 | warm tan pavers, two joint patterns |
| `lawn_a` | 16x16 | 2 | mowed stripe a: plain, clover |
| `lawn_b` | 16x16 | 2 | mowed stripe b: plain, clover |
| `fence_h` | 16x24 | 1 | boards running left to right with posts, rows 0 and 11 |
| `fence_v` | 16x24 | 1 | the side fence seen edge on, a post and rails, columns 0 and 10 |
| `fence_corner` | 16x24 | 1 | a corner post |
| `fence_back` | 16x16 | 2 | round 1: the back fence row (y = 0) inside the canvas, post cap and two rails; frame 0 rail, frame 1 corner post |
| `gate` | 16x24 | 2 | shut, open (swung inward) |
| `hedge` | 16x24 | 1 | rounded boxwood with height |
| `bed` | 16x20 | 3 | a wood edged flower bed: pink, yellow, mixed blooms poking 4 px above the tile |

Fixed props

| name | size | frames | shows |
|---|---|---|---|
| `shed` | 48x32 | 1 | shed wall along the top edge: roof edge, boards, a window with a flower box, a door |
| `sign` | 44x12 | 1 | a blank umber board with an orange border; YOUR PIT is drawn on it with the font |
| `tree` | 32x48 | 1 | a round leafy canopy 32x32 over a trunk, dappled `d` and `e` |
| `woodpile` | 16x16 | 1 | split logs, stacked |
| `hose` | 16x16 | 1 | a green hose coil on a hook, with a nozzle |
| `tools` | 16x24 | 1 | a rack on a post: spatula, tongs, brush |
| `pot` | 16x16 | 1 | a clay pot of herbs |
| `planter` | 16x24 | 1 | a half barrel of sunflowers |
| `mailbox` | 16x24 | 1 | a red mailbox on a post, flag up |
| `shelf` | 16x24 | 1 | round 1: a two plank sauce rack, three bottles (red, yellow, mahogany) with cream labels, a steel tub below |
| `picnic` | 32x24 | 1 | picnic table: the top 8 rows empty (the far bench is separate), then the table top, legs and the near bench |
| `picnic_bench` | 32x8 | 1 | the far bench, drawn behind seated customers |

Decor and gear props

| name | size | frames | shows |
|---|---|---|---|
| `chair` | 16x24 | 1 | a wooden lawn chair facing down, the back rising behind the sitter |
| `lights_post` | 16x32 | 1 | a tall post standing in the hedge, a hook on top |
| `lights_string` | 66x10 | 2 | the sagging wire with bulbs in `k`, `i`, `f`, `h`; the frames swap which bulbs glow |
| `birdbath` | 16x24 | 2 | a stone bowl of water on a pedestal: empty, a small bird on the rim |
| `canopy` | 40x32 | 1 | the Canopy gear, now a striped patio umbrella over picnic table 1: canvas on rows 0 to 11, the pole down columns 19 and 20 |

Effects and text

| name | size | frames | shows |
|---|---|---|---|
| `bubble` | 16x12 | 1 | a cream speech bubble with its tail at the bottom left corner; icon slot at (4,2) for an order icon, (4,3) for a plate |
| `heart` | 8x8 | 2 | a heart in `j` with an `h` glint: big, small |
| `sparkle` | 7x7 | 3 | a four point star in `h` and `k`: small, large, fading |
| `smoke` | 8x8 | 3 | a light puff in `u`: small, medium, large |
| `smoke_dark` | 8x8 | 3 | a dark puff in `v`: small, medium, large |
| `fire` | 8x8 | 3 | flame frames in `4`, `k`, `h` |
| `coin` | 8x8 | 2 | coin face, coin edge |
| `sweat` | 4x6 | 2 | a sweat drop in `f` and `h`: drop, splash |
| `zzz` | 8x8 | 3 | z, zz, zzz in `h` with a `5` edge |
| `font` | 4x6 | 38 | 0 to 9, A to Z, `+`, `:`; cream glyphs on transparent, tinted where V2.9 says |

Procedural (drawn by `game.js` with `COLOR`, not sprites): dashed footprint outlines, the patience bar, the fire gauge, cooking arcs, the slice bar, the tap ring, rain, and the boxes behind canvas text. The prototype's `outline`, `grass`, `path`, `table_mid`, `table_end` and `canopy_pole` sprites are retired.

Dashed outlines: one box per contiguous (4 connected) run of an unowned footprint's tiles, drawn on the tile bounds, never one bounding box per footprint. 1 px, cream `C` on lawn and hedge and outline `5` on pavers (round 1), dashes starting at the box's top left pixel and running clockwise, 2 on and 2 off, carried around the corners. The boxes, top left px and size:

| Footprint | Boxes |
|---|---|
| `kettle2` | (112,32) 16x16 |
| `drum` | (112,48) 16x32 |
| counter extension (`bigtable`) | (80,96) 16x16 |
| `lights` | (64,96) 16x16 and (128,96) 16x16, two boxes, nothing across the counter |
| `chair1` | (112,144) 16x16 |
| `chair2` | (128,144) 16x16 |
| `picnic2` | (32,144) 32x16 on (2,9) and (3,9); its seats (2,8) and (3,8) get no outline |
| `birdbath` | (64,144) 16x16 |
| `flowers` | (112,160) 32x16 |

Each box sorts on its run's bottom row, layer 2 (V2.12).

Totals: people and animals 28 names (94 frames), hands 24 (24), food and marks 16 (31), stations 8 (21), ground 10 (17), fixed props 12 (12), decor 5 (7), effects and text 10 (60).

### V2.12 Render order and the y-sort

Each frame, into the 176 by 192 offscreen canvas:

1. Ground: every tile's ground sprite. `PAVER` draws `paver`, and so do the customer route tiles (9,10) (9,9) (9,8) (9,7) (8,7) (7,7) (round 1, render only: their ground stays `LAWN`); `LAWN` and `GATE` draw `lawn_a` or `lawn_b`; fence, hedge and bed tiles draw a lawn tile under them on rows 6 to 11 and a paver above row 6.
2. The y-sorted pass: every fence, gate, hedge and bed tile (hedge frame `x % 2`, round 2); every fixed prop; every active station with its extras (the fire gauge (round 2), grate pieces and cooking arcs on cookers, the counter extension, plate stacks on the counter and the board, the piece being sliced); every owned decor item, and `bed` frame 3 on the unbought flower bed (round 2); in the morning and evening only, the ghosts of unowned gear and decor (round 2); every dashed outline of an unowned footprint (stations and decor); every person (shadow, then the hand overlay that goes behind, the body, the hand overlay that goes in front); the plate on a picnic table in front of an eating customer; the dog.
3. The overhead pass: `lights_string` at (71,80) when the lights are owned; `canopy` at (76,106) when the Canopy is owned.
4. Smoke, chimney puffs, dark puffs, fire flames.
5. Bubbles (order icon, `mark_x`, food bubble), patience bars, sweat, zzz, hearts. (Round 2: fire gauges moved into pass 2 with their cooker, so a player standing in front covers them.)
6. The slice bar, floating numbers, coins, sparkles, tap rings.
7. Rain.
8. Canvas text, in boxes of umber `2` with cream `3` and yellow `k` text, the same box as before (`drawBoxedText`: the box is 1 px up and left of the text, text width + 3 wide, 8 tall). The clock stays at (2,2). GATE OPENS IN {n} and LAST CALL move to text position (2,183), on the bottom fence row left of the mailbox and gate: the widest, GATE OPENS IN 30, ends near x 82, clear of the sign (68 to 112, 2 to 14) and of the mailbox at x 128. At (2,9) it would have run over the sign and its YOUR PIT text.
9. Blit to `#cv` at the scale of V2.13, with the burnt shake offset.

Sort key: the bottom pixel row of the object's anchor tile, `ay * 16 + 15`. For anyone moving, `Math.round(py) + 15`. For a seated customer, the seat tile's row. For a dashed outline, its run's bottom row (V2.11). For a picnic bench, its seat row. For the plate in front of an eater, the row of V2.2.4 (the table row at a picnic seat, the chair row on a lawn chair). Lower keys draw first. Ties break in this order:

1. key;
2. layer: fence, gate, hedge and beds 0; stations, fixed props, owned decor and the ghosts of unowned gear and decor 1 (a ghost uses the footprint's sort row); dashed outlines 2; people 3; the dog 4; eaters' plates 5;
3. draw x, the top left x pixel the sprite or box is drawn at (not the anchor tile's x);
4. list order: fence, gate, hedge and bed tiles in row major order; then `MAP.props` order; then `MAP.stations` order; then decor in `DecorId` order (within one item, its `draws` order); then outlines (stations in `MAP.stations` order, then decor in `DecorId` order, runs top left first); then the player, the buddy, the tender; then customers by id; then plates by customer id; then the dog.

The results this rule must give, checked by eye on the phone: the player at (6,5) is hidden from the shins down by the counter; a seated customer shows from the chest up over picnic table 1; anyone on row 1 under the tree is covered by the canopy; kettle 2 covers the feet of a player on (7,1); the bottom fence covers the feet of a customer on (9,10); the hedge covers the feet of the buddy on (4,5); people draw over a tall prop only when they stand in front of it.

### V2.13 Scaling and taps

Replaces section 14.2 and contract 4.2.

```
vw   = document.documentElement.clientWidth
vh   = window.innerHeight
dpr  = window.devicePixelRatio || 1
controls = 24 + 48 + 52 + 8                                          // #status, #act, #chips, slack (round 2)
if (vw >= 900 && vh - 44 - 16 - controls >= 576)  target = 3         // desktop: 528 by 576 CSS px at dpr 1
else if (vw - 16 >= 352)                          target = 2         // phone: 352 by 384 CSS px at dpr 2
else                                              target = (vw - 16) / 176
k = Math.max(1, Math.floor(target * dpr))                            // device pixels per virtual pixel (round 2)
css = k / dpr
cv.width = 176 * k;  cv.height = 192 * k
cv.style.width = (176 * css) + 'px';  cv.style.height = (192 * css) + 'px'
then nudge #cv (position relative) so its top left lands on a whole device pixel
```

Round 2 replaces the paragraph below on non integer DPRs: the scale is now picked in device pixels, so every virtual pixel is exactly `k` device pixels. 412 CSS px at dpr 2.625 gives k 5 and a 335 CSS px canvas; 360 at dpr 3 gives k 5 (293 CSS px); 1280 by 720 at dpr 1.5 gives k 3 (352 CSS px). On a 375 px phone at dpr 2 and on a desktop at dpr 1 the sizes are unchanged (352 by 384 and 528 by 576). A desktop window too short for the canvas plus the action button and the meat chips takes the 2x path instead of 3x.

The page keeps its 16 px gutters for everything except the canvas. Under 900 px, `#wrap` gets `margin: 0 -8px; width: auto` so the canvas may reach to 8 px from each edge (a shell CSS change in `index.html`, V2.17). On a 375 px phone the canvas is exactly 352 by 384 CSS px, every virtual pixel is exactly 2 CSS px, and header 44 + canvas 384 + status 24 + action 48 + chips 48 = 548 px fits a 740 px tall viewport with room for the footer. Smoothing is off on both contexts and `#cv` keeps `image-rendering: pixelated`. Recomputed on resize and orientation change.

Non integer device pixel ratios are accepted as they come; build this formula exactly as written. At dpr 2.625 or 2.8125, `k = round(2 * dpr)` gives 5 or 6 backing pixels per virtual pixel against 5.25 or 5.625 device pixels, so some virtual pixels land one device pixel wider than others; at 360 CSS px wide `css` is 1.95. Smoothing off and `image-rendering: pixelated` keep every edge hard, so there is no blur, which was Joel's complaint at 1.5x, and the 352 by 384 CSS px acceptance size stays exact. No builder adds a further fix. Joel's phone (about 384 or 412 CSS px wide) takes the integer 2x path.

Taps: a tap maps to a virtual pixel, `vx = (clientX - rect.left) / rect.width * 176`, `vy = (clientY - rect.top) / rect.height * 192`. First the drawn boxes of active stations are hit tested in reverse draw order (the table's box is the `counter` rect plus the `counter_ext` rect when owned, V2.3); a hit calls `sim.walkTo` with that station's first tile, so tapping the 8 px of a kettle or the counter that overhang the row above still picks the station. Otherwise the tile `(floor(vx / 16), floor(vy / 16))` goes to `walkTo`. People and props never take a tap.

### V2.14 Save version 2 and migration

Amends section 12 and contract 2.8. The key is unchanged: `hs.pitsim.save`. `SAVE_VERSION` is 2. Format:

```json
{
  "v": 2,
  "day": 5,
  "cash": 187,
  "rep": 80,
  "stock": { "sausage": 0, "chicken": 2, "ribs": 0, "butt": 1, "brisket": 0 },
  "charcoal": 3,
  "gear": { "kettle2": true, "cooler": false, "bigtable": false, "tray": false, "canopy": false, "drum": false },
  "decor": { "chair1": true, "chair2": false, "flowers": false, "birdbath": false, "lights": false, "picnic2": false },
  "hires": { "buddy": false, "tender": false },
  "stats": { "days": 4, "served": 45, "walkouts": 1, "past": 3, "burnt": 0, "seated": 30 },
  "drivewayShown": false
}
```

`validateSave(obj)` accepts `v === 2` and `v === 1` and always returns a version 2 object; anything else returns `null` and a new game starts, as before.

- **From v1:** `day`, `cash`, `rep`, `stock` (the raw meat inventory), `charcoal`, `gear` and `hires` migrate field by field under the existing rules and clamps. `stats` (the five v1 keys) and `drivewayShown` carry over as well; `stats.seated` starts at 0. `decor` is all false, so the seats are the day 1 set (picnic table 1, two seats). The game shows Your save was updated for the new yard. on the status line for 4 s and once in the live region, detected in `game.js` by reading `parsed.v === 1` before validation. Right after showing the notice, `game.js` calls `writeSave()` once, so the stored save is version 2 at once and a reload before the next purchase or till does not show the notice again.
- **A v1 save written at reason `'open'`:** no v1 save holds service state, so this is the only mid day save. It loads on that day's morning with the bought stock kept and the cash already spent, unchanged v1 behavior. The day 1 default cart (sim deviation 12) still applies only when stock and charcoal are both 0.
- **v2 rules:** `decor.*`, one key per decor id, `=== true`, unknown keys dropped; `decor.chair2` forced false when `decor.chair1` is false. `stats.seated` integer, clamp 0 to `MAX_STAT`, default 0. Every v1 rule still applies.
- `serialize()` writes exactly this shape. Service state, `state.seats` and charm are never saved.

### V2.15 Events and aria-live

New and changed events (contract 2.9 gets these rows):

| type | payload | when | sentence |
|---|---|---|---|
| `seat_taken` | `id, seat` | a served customer reserved a seat, emitted right after `served` | none |
| `to_go` | `id` | a served customer found no free seat, emitted right after `served` | No free seat. They took it to go. |
| `seat_done` | `id, seat, bonus, x, y, atClose` | a seated customer finished and the seat tip was paid; `x, y` is the seat tile's top left px; `atClose` is true when the day's hard end paid it | A seated customer tipped {bonus} more. (none when `atClose`) |
| `purchase` | `id, label, price, kind` with `kind` `'gear'` or `'decor'` | gear or decor bought | Bought {label}. (unchanged) |
| `sell` | `id, label, price` | a Broke card sale, gear or decor | Sold {label} for {price}. (unchanged) |
| `save_wanted` | `reason` gains `'decor'` | after a decor buy | none |
| `walk_past` | `id, reason` with `'full'` or `'soldout'` | unchanged (sim deviation 9) | unchanged |

Game side, no sim event: Your save was updated for the new yard. once after loading a v1 save. The live queue rules (one message a second, identical messages within 5 s dropped) are unchanged.

### V2.16 New and changed user-facing strings

Copy rules unchanged: no dashes of any kind, plain words, game numbers only, no brands, no offset, no anonymous, no promises.

Clipboard
- Decor (section heading, between Gear and Hires)
- Charm adds to the tip each seated customer leaves, up to 3 more, and lets word of mouth climb a little faster. (muted note under the Decor heading)
- Seats {n}. Charm {c}. Each seated customer tips {b} more. (a line in `#clip-top` under the goal line)
- Decor labels and effect lines exactly as in V2.7
- Needs the first lawn chair.

Till
- Seat tips, detail {n} sat down, amount +{seatTips} (a new row right after Tips)
- People line: Came to the gate {customers}. Served {served}. Sat down {seated}. Took it to go {togo}. Walked out {walkouts}. Walked past (line full) {past}. Left at close {close}.
- Word of mouth reasons: +{happy*2} from {happy} quick serves at a seat, +{togoQuick} from {togoQuick} quick serves to go, +{ok} from {ok} other serves, -{walkouts*3} from {walkouts} walk-outs{, capped at +{max} / -15 for the day}, where `max` is the charm clamp of V2.6
- Net now counts seat tips: `net = revenue + tips + seatTips - wages - DAILY_COSTS`

Live region and status line
- No free seat. They took it to go.
- A seated customer tipped {n} more.
- Your save was updated for the new yard. (status precedence: after Saving is off in this browser., before Can't get there)

Canvas text (pixel font, uppercase)
- +{n} (cash, as before), +{n} TIP (counter tip and seat tip), YOUR PIT on the sign (a duplicate of the title)

The Broke card lists owned decor with the same Sell for {n} buttons as gear.

### V2.17 Constants and files

`PitSim.C` changes; nothing else in `C` moves:

| Name | Prototype | v2 |
|---|---|---|
| `WALK_TILES_PER_S` | 5 | 6 (4.8 px a tick; `game.js` draws `Math.round(px)`) |
| `SAVE_VERSION` | 1 | 2 |
| `EAT_MIN` | | 8 |
| `EAT_MAX` | | 12 |
| `HEART_SECONDS` | | 0.6 |
| `SEAT_BONUS_BASE` | | 1 |
| `SEAT_BONUS_MAX` | | 3 |
| `CHARM_STEP` | | 10 |
| `CHARM_MAX` | | 30 |
| `REP_TOGO_QUICK` | | 1 |
| `SWEAT_FRAC` | | 0.25 |
| `ZZZ_AFTER` | | 3 |

The day loop (125 s, prep 30, last call 110), fire, meats, customers, patience, the counter tip, queue and table sizes (3, or 5 with the Bigger table), gear, hires, wages, daily costs, weather, the Broke test and the goal order stay as section 19 has them.

Files: `index.html` gains one CSS rule, `@media (max-width: 899px) { #wrap { margin: 0 -8px; width: auto; } }`, and nothing else. `sprites.js` is redrawn to V2.10 and V2.11. `sim.js` takes V2.2 to V2.7, V2.14, V2.15 and V2.17. `game.js` takes V2.9, V2.12, V2.13, the clipboard and till lines of V2.16 and the dog. `dev/smoke.mjs` and `dev/sheet.html` follow the contract's v2 delta. No other file changes.

### V2.18 Acceptance additions

- On a 375 px wide viewport the canvas is 352 by 384 CSS px, there is no horizontal scroll, and every DOM control is still 44 by 44 or larger.
- Day 1 shows a seated customer with a food bubble within the first 45 s after the gate opens when the player keeps sausage on the counter, then a heart and +1 TIP when they finish.
- With both picnic seats full, the next served customer leaves with a takeout box and the live region says No free seat. They took it to go.
- Buying the lawn chair on day 2 adds a third seat at (7,9) at once, the clipboard reads Seats 3. Charm 3. Each seated customer tips 1 more., and the save round trips.
- A hand written v1 save loads on its morning with day, cash, word of mouth, stock, charcoal, gear and hires intact, decor empty, and the update notice on the status line.
- The y-sort checks of V2.12 hold on the phone at 2x.
- Reduced motion: numbers appear and fade without rising; no sparkles, squash, puffs, shake, twinkle or dog walking; the sweat drop and the zzz show still.
- Seat reachability (Node part of `dev/smoke.mjs`): for all 64 decor combinations, each with and without `gear.bigtable`, a customer grid BFS built on `sim.custWalkable` finds a path from every queue spot in `MAP.queue` to every owned seat, and from every owned seat to `MAP.custSpawn` (9,12).
- The v2 economy rerun of V2.19 item 2 is not part of build acceptance.

### V2.19 Overseer items, decided 2026-10-18

1. **Cook times: 14 and 22.** The shipped `sim.js` cooks sausage in 10 s and chicken in 16 s, against 14 and 22 in sections 8.1 and 19, with no Deviations entry. Decided: sausage 14 and chicken 22, per section 19 and contract D2. The chicken effect line goes back to the text in section 8.1 and contract 2.4, Chicken thighs: 2 plates, 22 seconds on good fire, sells for 8. The sausage line names no seconds and does not change.
2. **Economy rerun.** The section 20 economy run was not repeated for v2. WALK 6, the shorter legs and the seat tips all help the player; expect the second kettle and the drum up to a day earlier, and the driveway price one to three days earlier for a player who buys decor. The to go word of mouth (+1 for a quick to go serve, V2.5 step 7) slows rep on busy days with two seats and is to be checked by the same run. `pitsim-econ.mjs` is not in the repo and this workflow may only edit `games/pit-sim/` and the three spec docs, so the rerun is not part of this build's acceptance. If it is cheap, the builder adds `games/pit-sim/dev/econ.mjs` (dev only, never shipped): it drives the real `createSim` with a scripted competent bot for 10 days on seed 1, prints the day by day table, and the result is recorded here. If not, this item stays open for the Overseer before Joel's next play.

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

> **Superseded by v2 (V2.2, V2.3, V2.4).** Kept for history. The map, the legend, the distances and the station positions below describe the prototype at 883b0ad. Walkability, reach, facing and the BFS rules still apply as V2.2.1 restates them.

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

> **Amended by v2 (V2.4):** idle tile (4,5), BFS between the board and the counter.

A second sprite. Loop: idle at (5,9); when a stack is on the board and a spot fits on the table, take one plate (the stack a waiting customer ordered first, else oldest), walk (5,9) to (6,7) at 4 tiles per second, set down, walk back. About 2.3 s per plate including 0.4 s of handling at each end. He never slices, never touches fire. While he exists the player can still carry; both use the same stack rules.

Edge cases, decided: he runs from the moment the yard opens, prep included. He reserves his plate when his 0.4 s pickup starts; if the stack empties first (the player took the last plate) he aborts to idle. When the player and the buddy reach for the last plate in the same step, the player wins, because player actions run before NPC actions in the step order (section 5.10). If no spot fits when he arrives at (6,7) he waits there holding the plate until one does, then sets it down. He does not block any tile: the player can stand on (5,9) with him (section 6.1, no collision).

### 5.9 The fire tender (hire)

> **Amended by v2 (V2.2.3, V2.4):** idle tile (3,2), facing the pile.

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

> **Amended by v2 (V2.2.3, V2.5):** customers enter at the gate (9,11) from (9,12) and walk by BFS; the queue spots and the walk past stop are in V2.2.3.

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

> **Amended by v2 (V2.5, V2.6):** the counter tip is unchanged; a seated customer adds a seat tip when done, and word of mouth per serve depends on seated or to go.

On being served meat with price `P` after waiting `w` of patience `pat`:

```
tip = round(P * 0.25 * (1 - min(1, w / pat))) + (plateAge < 30 ? 1 : 0)
cash += P + tip
rep += (w < 0.4 * pat) ? 2 : 1
```

Coin pop shows `+P` and, when tip > 0, `+tip` in gold beneath it.

### 6.5 Sprites and behavior

> **Amended by v2 (V2.5, V2.11):** four bodies (`arrivals % 4`); served customers sit and eat or leave with a takeout box.

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

> **Amended by v2 (V2.16):** a Seat tips row after Tips, the People line gains Sat down and Took it to go, Net counts seat tips.

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
Take today                sales and tips after wages and daily costs   {net, signed}
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

> **Amended by v2 (V2.5 step 7, V2.6):** quick serves to go give +1; the daily cap rises with charm.

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

> **Amended by v2 (V2.14):** save version 2 with `decor` and `stats.seated`; v1 saves migrate.

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

> **Superseded by v2 (V2.11).** Kept for history. The list below is the prototype's 16x16 set; the v2 list has 111 names and 263 frames.

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

> **Superseded by v2 (V2.10).** Kept for history. The DOM panels still use the site tones listed here.

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

> **Superseded by v2 (V2.13)** for the canvas size and scale: 176 by 192 virtual px, exactly 2x CSS on a phone, 3x from 900 px.

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

> **Amended by v2 (V2.15):** adds the to go and seat tip sentences and the save update notice.

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

> **Amended by v2 (V2.9):** the reduced motion column there covers every new effect.

When `prefers-reduced-motion: reduce` matches:

- No smoke puffs, no screen shake, no coin pop drift (the +P text appears for 600 ms without moving), no served hop, no rain streaks (flat grey tint only), no idle bobbing.
- Walking, cooking arcs, patience bars and fire gauges still animate because they carry information.
- Panel open and close are instant (no transition) in both modes anyway.

## 18. User-facing strings

> **Amended by v2 (V2.16):** new Decor, seat, till and notice strings.

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

> **Amended by v2 (V2.17):** `WALK_TILES_PER_S` is 6; new seating and charm constants; decor prices in V2.7. Nothing else here moves.

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
