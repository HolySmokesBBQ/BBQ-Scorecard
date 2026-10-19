# Pit sim v2: direction and spec amendment

**Date:** 2026-10-18
**Slug:** `pit-sim`, v2 round
**Builds on:** the prototype at commit 883b0ad in `games/pit-sim/` (`index.html`, `sprites.js`, `sim.js`, `game.js`, `dev/smoke.mjs`, `dev/sheet.html`), the design spec `docs/superpowers/specs/2026-10-18-pit-sim-design.md` and the module contract `docs/superpowers/specs/2026-10-18-pit-sim-contract.md`.
**What this file is:** the why (Joel's feedback, what the two reference games do that ours does not, the calls made for v2) followed by the full spec amendment. The same amendment is applied as the top section of the design spec, and the interface changes it implies are applied as the top section of the contract. If this file and the design spec ever disagree, the design spec wins.

---

## 1. The feedback

Joel, 2026-10-18, after playing the prototype on his Android phone: "Good idea but the game could be better. Stuff is too spaced out." Then two screenshots as the bar.

What the prototype looks like next to them: a flat 13 by 15 field of one green, five small 16 by 16 objects in the corners, a 5 tile dirt path, no props, no seats, customers who stand in a line and vanish when served, a muted palette, and no feedback except a coin. The cook loop is 5 to 8 tiles a leg. On a 375 px phone the canvas is scaled 1.5x in CSS (blurry) and fills the screen.

## 2. Reading the two references

**The cafe sim (isometric cafe, customers at tables).** What it does that we do not:

- Customers sit down. Every table has people at it with a food bubble over their heads, and the seated crowd is the first thing the eye lands on. The business looks busy because people stay.
- Every tile is furnished: tables with chairs, a counter with dishes, a jukebox, plants, shelves, a menu board, striped wallpaper. There is no empty floor that is not a walkway.
- Warm, bright, saturated color with dark outlines, so small objects read at phone size.
- The action is a tap on a dish. The loop is short and close together.

**The farm sim (3/4 top-down pixel art, dense fields).** What it does that we do not:

- 3/4 view with height: buildings, trees and people are taller than a tile and overlap what is behind them. Things stand up instead of lying flat.
- Density: fields packed edge to edge, fences with posts, sheds, a barn, animals, mailboxes, a cherry tree. Paths are the only bare ground.
- Feedback everywhere: floating EXP +10 and +0.4 UP numbers, sparkles on the crops, a speech bubble ("Yoohoo!") from a visitor. Every action answers back.
- Saturated greens and pinks, two greens on the grass, warm path tan.

What we keep from neither: isometric projection (it would mean rewriting tapping and pathfinding), menus over the play area, and any brand, character or asset from either game. They are the bar for feel, not a source.

## 3. The calls for v2

These are the Overseer's calls, built to as written.

1. **View.** 3/4 top-down like the farm game, not isometric. The ground stays a 16 px tile grid with BFS on it. Every object is a sprite anchored at its bottom tile and may be taller and wider than a tile: people 16x24 with heads, hair, eyes, shirts and aprons; the kettle 16x24 with a lid and a chimney puff; the drum upright 16x32; the counter 32x24 with a cloth; the cooler with an open lid frame; the board on a stand; a shed wall along the top edge with a window; the yard sign; a tree whose canopy overhangs; fences with posts; a hedge; picnic tables with benches; chairs; a hose coil; a woodpile; string lights on two posts; a bird bath; a mailbox at the gate; a dog that wanders and never blocks. Rendering is y-sorted so tall things overlap right and people pass behind them.
2. **Density.** No bare lawn tile inside the fence. Pavers under the cook area, mowed stripes (two greens) under the seats, flower beds along two fence runs, props in every corner. Day 1 already reads as a lived-in backyard. Decor is also a shop category.
3. **Palette.** The canvas goes bright and saturated with dark outlines, 28 to 32 colors. The DOM panels keep the site palette. The site's canon tones stay on the canvas for the sign and the boxes behind canvas text.
4. **Seating and charm.** Served customers walk to a free seat, eat for 8 to 12 s with a food bubble, then a heart, pay a seat bonus tip and leave through the gate. No free seat means to go: no bonus, slightly smaller word of mouth. Day 1 has one picnic table with two seats. A Decor shop category sells chairs, a second picnic table, string lights, a flower bed and a bird bath, each with a price, seats where they apply, and charm; charm nudges the seat tip (capped) and the daily word of mouth cap a little. Decor sits on fixed footprints with a dashed outline until owned. The line at the counter stays 3 (5 with the bigger table).
5. **Feedback.** Floating cash and tip numbers that rise and fade, sparkles on a served plate, a heart from a seated customer finishing, a smoke column and a dark puff from burnt meat, a sweat drop under 25 percent patience, zzz over an idle buddy, a squash and stretch on the player when a tap lands. Reduced motion: numbers appear and fade without rising, no sparkles, no squash.
6. **Compact map.** 11 wide by 12 tall (176 by 192 px). Phone: integer 2x (352 by 384 CSS px) with 8 px side gutters allowed for the canvas only; desktop 3x (528 by 576). Cook loop legs 1 to 3 tiles. `WALK_TILES_PER_S` 5 to 6. Every other economy constant stays; seating is a bonus on top, not a nerf.
7. **Everything else stays.** The day loop, the clipboard, the till, gear and hires, the save key (with a version bump and a clean migration), zero inline script, the copy rules, and the accessibility baseline.

## 4. Prototype against v2, in one table

| | Prototype (883b0ad) | v2 |
|---|---|---|
| Map | 13 by 15, one green, a dirt path | 11 by 12: pavers, two mowed greens, beds, hedge, props in every corner |
| View | flat, everything 16x16 | 3/4, sprites taller than a tile, y-sorted |
| Phone scale | 1.5x CSS, blurry | exactly 2x CSS, 8 px canvas gutters |
| Cook loop | 5 to 8 tiles a leg | 0 to 3 steps a leg, at 6 tiles a second |
| Customers | stand in line, vanish when served | line up, then sit and eat, heart, seat tip, walk out through the gate |
| Shop | meat, charcoal, gear, hires | plus Decor: seats and charm |
| Feedback | a coin | cash and tip numbers, sparkles, hearts, smoke, sweat, zzz, squash, twinkling lights, a dog |
| Palette | 22 muted colors | 31 bright colors with dark outlines; site tones kept for the sign and canvas boxes |
| Sprites | 81 names, 16x16 people | 111 names, 263 frames, 16x24 people, 4 customer bodies |
| Save | v1 | v2, v1 migrates |

## 5. The amendment

Everything below is the amendment exactly as applied to the top of the design spec.

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
  y1        #  S  S  S  .  .  C  .  ^  W  #
  y2        #  R  .  .  P  K  .  k  .  Y  #
  y3        #  o  .  .  .  .  .  D  .  o  #
  y4        #  .  .  X  .  B  .  D  .  .  #
  y5        #  H  .  .  .  .  .  .  .  U  #
  y6        #  h  h  h  L  t  T  T  L  h  #
  y7        #  f  a  b  a  b  a  1  2  3  #
  y8        #  f  r  r  a  s  s  b  a  4  #
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
  y8        .  .  .  .  d  .  .  d  d  .  .     D  dog home (4,7), also a roam tile
  y10       .  .  .  .  .  .  .  .  .  x  .     x  pass stop (9,10)
  y12                                  +        +  customer spawn (9,12), one tile below the gate, off canvas
```

Ground types (`MAP.T`): `PAVER 0`, `FENCE 1`, `GATE 2`, `LAWN 3`, `HEDGE 4`, `BED 5`. Blockers come from objects, not ground: fixed props, active stations and owned decor (V2.2.1 to V2.2.4).

| Glyph | Ground | Thing | Tiles | Player | Customers | Drawn as |
|---|---|---|---|---|---|---|
| `#` | FENCE | Fence | x=0 and x=10 (y 0 to 11), y=0 (x 4 to 9), y=11 (x 1 to 8) | blocks | blocks | `fence_h` on rows 0 and 11, `fence_v` on columns 0 and 10, `fence_corner` at (0,0) (10,0) (0,11) (10,11); 16x24, so row 0 is clipped 8 px at the top |
| `G` | GATE | Gate | (9,11) | blocks | walks | `gate` 16x24, frame 1 (open) during service while the clock is in [GATE_OPENS, LAST_CALL) or any customer is in `state.customers`, so it stays open while the last eaters, to go customers and walk-outs leave after last call; frame 0 (shut) otherwise |
| `S` | PAVER | Shed wall | (1,0) (2,0) (3,0) (1,1) (2,1) (3,1) | blocks | n/a | `shed` 48x32 at px (16,0), window and door, roof edge on top |
| `.` | PAVER | Pavers, cook area | every `.` in rows 1 to 5 | walks | n/a | `paver`, frame `(x * 7 + y * 3) % 2` |
| `^` | PAVER | Pavers under the tree canopy | (8,1) | walks | n/a | `paver`, drawn behind the canopy by the y-sort |
| `a` `b` | LAWN | Lawn, mowed stripes | every `a` and `b`: `a` where x is even, `b` where x is odd | blocks (not paver) | walks | `lawn_a` or `lawn_b`; frame 1 (clover) where `(x * 5 + y * 3) % 4 === 0`, else frame 0 |
| `f` | BED | Flower beds, fixed | left fence run (1,7) (1,8) (1,9) (1,10); bottom fence run (2,10) (3,10) (4,10) (5,10) (6,10) | blocks | blocks | `bed` 16x20, frame `(x + y) % 3` (pink, yellow, mixed) |
| `h` | HEDGE | Hedge, the line between pavers and lawn | (1,6) (2,6) (3,6) (9,6), and under the light posts (4,6) (8,6) | blocks | blocks | `hedge` 16x24 |
| `R` | PAVER | Tool rack (spatula, tongs, brush) | (1,2) | blocks | n/a | `tools` 16x24 |
| `o` | PAVER | Herb pot | (1,3) and (9,3) | blocks | n/a | `pot` 16x16 |
| `H` | PAVER | Hose coil | (1,5) | blocks | n/a | `hose` 16x16 |
| `U` | PAVER | Sunflower planter, half barrel | (9,5) | blocks | n/a | `planter` 16x24 |
| `W` | PAVER | Woodpile | (9,1) | blocks | n/a | `woodpile` 16x16 |
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
| `F` | LAWN | Flower bed footprint (decor) | (7,10) (8,10) | n/a | walks until bought, then blocks | dashed outline 32x16 until bought, then `bed` frames 0 and 1 |
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
| Dog roam | (2,7) (3,7) (4,7) (5,7) (6,7) (4,8) (7,8) (8,8) | | the dog walks between these over the dog grid; `MAP.dogRoam` is unchanged and (4,8) stays a roam tile. A dog sitting on (4,8) behind an owned bird bath, or on (7,8) or (8,8) behind owned chairs, is partly covered; that is the 3/4 view working, not a defect |

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
| `kettle1` | cooker | none | (5,2) | (6,2,left) (5,3,up) (5,1,down) | `kettle` | 16x24 | (80,24) |
| `kettle2` | cooker | `kettle2` | (7,2) | (6,2,right) (8,2,left) (7,1,down) | `kettle` | 16x24 | (112,24) |
| `drum` | cooker | `drum` | (7,3) (7,4) | (6,3,right) (6,4,right) (8,3,left) (8,4,left) (7,5,up) | `drum` | 16x32 | (112,48) |
| `board` | board | none | (5,4) | (6,4,left) (5,3,down) (5,5,up) (4,4,right) | `board` | 16x16 | (80,64) |
| `cooler` | cooler | none | (6,1) | (6,2,up) (5,1,right) (7,1,left) | `cooler` | 16x16 | (96,16) |
| `table` | table | none | (6,6) (7,6), plus (5,6) with `bigtable` | (6,5,down) (7,5,down), plus (5,5,down) with `bigtable` | `counter`, plus `counter_ext` | 32x24, plus 16x24 | (96,88), plus (80,88) |
| `pile` | pile | none | (4,2) | (4,3,up) | `pile` | 16x16 | (64,32) |
| `trash` | trash | none | (3,4) | (4,4,left) (3,3,down) (3,5,up) (2,4,right) | `trash` | 16x16 | (48,64) |

Labels, spoken names, slots and decay are unchanged from contract 2.3.2. Station ids, types and the order of `MAP.stations` are unchanged. The pile lists one use tile on purpose: (3,2) also touches it, and that is where the fire tender idles.

Tiles that touch two or three stations (reach resolves by facing; a tap faces the tapped station): (6,2) cooler up, kettle 1 left, kettle 2 right; (5,3) kettle 1 up, board down; (6,4) board left, drum right; (7,5) drum up, counter down; (5,5) board up, counter extension down; (4,4) board right, trash left; (7,1) cooler left, kettle 2 down.

Pixel anchors the renderer and the sim share:

- Grate slots (`slotPx`, offsets from the top left pixel of the station's first tile): kettles `[(-2,-7), (8,-7)]`; drum `[(-2,-4), (8,-4), (-2,7), (8,7)]`. Two 10 px pieces on one cooker share no column.
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

Day 1 opens with kettle 1, the crate at the cooler tile, the board, the counter with three plate spots, the pile with 0 bags, the trash, picnic table 1 with two seats, every fixed prop of V2.2.2, the hedge, both flower bed runs and the dog. Dashed outlines mark kettle 2, the drum, the counter extension, both chairs, picnic table 2, the bird bath, the decor flower bed and the two light posts. No lawn tile inside the fence is bare: every lawn tile is a stripe, a clover tile, a bed, a seat, a table, a queue spot, a dog roam tile or an outlined footprint.

### V2.9 Feedback

Every effect is cosmetic, drawn by `game.js`, timed in real seconds, and uses `game.js`'s own seeded generator (game.js deviation 4), never `sim.rng()`. Positions are offsets from the top left pixel of the named thing.

| Effect | Trigger | Where | Duration | Motion | Reduced motion |
|---|---|---|---|---|---|
| Cash number `+{price}` with a coin | `served` | coin at (x - 9, y - 6) of the plate spot, text at (x, y - 6), yellow `k` with a 1 px `5` shadow at (+1,+1) | 0.9 s | rises 12 px, ease out (`12 * (1 - (1 - t)^2)`, t from 0 to 1 over 0.9 s); alpha 1 until 0.6 s, then linear to 0 | appears in place, same fade, no rise; the coin does not spin |
| Tip number `+{tip} TIP` | `served` with tip over 0 | 7 px under the cash number, cream `C` with the `5` shadow | 0.9 s | moves with the cash number | same as above |
| Sparkles on the served plate | `served` | three `sparkle` at (-3,-4) (6,-7) (2,2) from the plate spot | 0.45 s | frames 0, 1, 2 at 0.15 s each, staggered 0.05 s | none |
| Order bubble and patience bar | a customer in mode `arriving` or `waiting` (V2.5 step 2) | `bubble` at (px + 14, py - 20) with `icon_{meat}` at (px + 18, py - 18) inside; the patience bar, 14x3, at (px + 15, py - 24), just above the bubble | while in line | moves with the customer | same |
| Food bubble | a customer in mode `eating` with `eat` over 0 | `bubble` at (px, py - 21) with `plate_{meat}` at (+4, +3) inside; `cust{n}_sit` alternates frames 0 and 1 every 0.35 s | while eating | the fork moves; the bubble does not | sit frame 0, no alternation; the bubble shows |
| Heart | `seat_done` without `atClose` | `heart` at (seat px + 4, seat py - 18) | 0.8 s | frame 0 for 0.4 s then frame 1, rises 10 px, fades over the last 0.3 s | frame 0 in place for 0.8 s, then gone |
| Seat tip number `+{bonus} TIP` | `seat_done` without `atClose` | (seat px + 13, seat py - 18), magenta `j` with the `5` shadow | 0.9 s | as the cash number | appears and fades in place |
| Content face | eating customer with `eat` at 0 (the `HEART_SECONDS` pause) | `cust{n}_sit` frame 2 | 0.6 s | none | same |
| Chimney puff | a lit kettle or drum: low band every 0.9 s, good every 0.45 s, hot every 0.3 s | kettle vent at (station px + 11, station py - 10); drum vent at (station px + 7, top tile py - 4) | each puff 1.1 to 1.4 s | `smoke` frame by age, rises 8 px/s, drifts up to 3 px/s sideways | none |
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

Grids use only the characters `0` to `9` and `a` to `v`; `build()` rejects anything else. 111 names, 263 frames. People are 16x24 with a head, hair, eyes with whites, a shirt, and an apron where the role has one. Side sprites face left and are flipped for right. Frame meanings are fixed so `game.js` can index them blind.

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
| `dog` | 16x16 | 4 | a small tan dog with a red collar, facing left: walk a, walk b, sit (facing down), nap (curled up) |

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
| `drum` | 16x32 | 4 | an upright drum on short legs, lid and vent on top, the same four bands showing at the intake |
| `cooler` | 16x16 | 3 | wooden crate (day 1), cooler shut (`g` body, `h` lid), cooler open (lid up, ice inside); frame 2 while the player is in reach of it with the cooler owned |
| `board` | 16x16 | 2 | cutting board on a wood stand: empty, with a piece being sliced |
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

Dashed outlines: one box per contiguous (4 connected) run of an unowned footprint's tiles, drawn on the tile bounds, never one bounding box per footprint. 1 px, cream `C`, dashes starting at the box's top left pixel and running clockwise, 2 on and 2 off, carried around the corners. The boxes, top left px and size:

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

Totals: people and animals 28 names (94 frames), hands 24 (24), food and marks 16 (31), stations 8 (21), ground 9 (15), fixed props 11 (11), decor 5 (7), effects and text 10 (60).

### V2.12 Render order and the y-sort

Each frame, into the 176 by 192 offscreen canvas:

1. Ground: every tile's ground sprite. `PAVER` draws `paver`; `LAWN` and `GATE` draw `lawn_a` or `lawn_b`; fence, hedge and bed tiles draw a lawn tile under them on rows 6 to 11 and a paver above row 6.
2. The y-sorted pass: every fence, gate, hedge and bed tile; every fixed prop; every active station with its extras (grate pieces and cooking arcs on cookers, the counter extension, plate stacks on the counter and the board, the piece being sliced); every owned decor item; every dashed outline of an unowned footprint (stations and decor); every person (shadow, then the hand overlay that goes behind, the body, the hand overlay that goes in front); the plate on a picnic table in front of an eating customer; the dog.
3. The overhead pass: `lights_string` at (71,80) when the lights are owned; `canopy` at (76,106) when the Canopy is owned.
4. Smoke, chimney puffs, dark puffs, fire flames.
5. Bubbles (order icon, `mark_x`, food bubble), patience bars, fire gauges (V2.3), sweat, zzz, hearts.
6. The slice bar, floating numbers, coins, sparkles, tap rings.
7. Rain.
8. Canvas text, in boxes of umber `2` with cream `3` and yellow `k` text, the same box as before (`drawBoxedText`: the box is 1 px up and left of the text, text width + 3 wide, 8 tall). The clock stays at (2,2). GATE OPENS IN {n} and LAST CALL move to text position (2,183), on the bottom fence row left of the mailbox and gate: the widest, GATE OPENS IN 30, ends near x 82, clear of the sign (68 to 112, 2 to 14) and of the mailbox at x 128. At (2,9) it would have run over the sign and its YOUR PIT text.
9. Blit to `#cv` at the scale of V2.13, with the burnt shake offset.

Sort key: the bottom pixel row of the object's anchor tile, `ay * 16 + 15`. For anyone moving, `Math.round(py) + 15`. For a seated customer, the seat tile's row. For a dashed outline, its run's bottom row (V2.11). For a picnic bench, its seat row. For the plate in front of an eater, the row of V2.2.4 (the table row at a picnic seat, the chair row on a lawn chair). Lower keys draw first. Ties break in this order:

1. key;
2. layer: fence, gate, hedge and beds 0; stations, fixed props and owned decor 1; dashed outlines 2; people 3; the dog 4; eaters' plates 5;
3. draw x, the top left x pixel the sprite or box is drawn at (not the anchor tile's x);
4. list order: fence, gate, hedge and bed tiles in row major order; then `MAP.props` order; then `MAP.stations` order; then decor in `DecorId` order (within one item, its `draws` order); then outlines (stations in `MAP.stations` order, then decor in `DecorId` order, runs top left first); then the player, the buddy, the tender; then customers by id; then plates by customer id; then the dog.

The results this rule must give, checked by eye on the phone: the player at (6,5) is hidden from the shins down by the counter; a seated customer shows from the chest up over picnic table 1; anyone on row 1 under the tree is covered by the canopy; the kettle covers the feet of a player on (5,1); the bottom fence covers the feet of a customer on (9,10); the hedge covers the feet of the buddy on (4,5); people draw over a tall prop only when they stand in front of it.

### V2.13 Scaling and taps

Replaces section 14.2 and contract 4.2.

```
vw   = document.documentElement.clientWidth
vh   = window.innerHeight
dpr  = window.devicePixelRatio || 1
if (vw >= 900 && vh - 44 - 16 >= 576)  css = 3                  // desktop: 528 by 576 CSS px
else if (vw - 16 >= 352)               css = 2                  // phone: 352 by 384 CSS px
else                                   css = (vw - 16) / 176    // narrower than 368 px: fit, not integer
k = Math.max(1, Math.round(css * dpr))                           // backing store pixels per virtual pixel
cv.width = 176 * k;  cv.height = 192 * k
cv.style.width = (176 * css) + 'px';  cv.style.height = (192 * css) + 'px'
```

The page keeps its 16 px gutters for everything except the canvas. Under 900 px, `#wrap` gets `margin: 0 -8px` so the canvas may reach to 8 px from each edge (a shell CSS change in `index.html`, V2.17). On a 375 px phone the canvas is exactly 352 by 384 CSS px, every virtual pixel is exactly 2 CSS px, and header 44 + canvas 384 + status 24 + action 48 + chips 48 = 548 px fits a 740 px tall viewport with room for the footer. Smoothing is off on both contexts and `#cv` keeps `image-rendering: pixelated`. Recomputed on resize and orientation change.

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

Files: `index.html` gains one CSS rule, `@media (max-width: 899px) { #wrap { margin: 0 -8px; } }`, and nothing else. `sprites.js` is redrawn to V2.10 and V2.11. `sim.js` takes V2.2 to V2.7, V2.14, V2.15 and V2.17. `game.js` takes V2.9, V2.12, V2.13, the clipboard and till lines of V2.16 and the dog. `dev/smoke.mjs` and `dev/sheet.html` follow the contract's v2 delta. No other file changes.

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
