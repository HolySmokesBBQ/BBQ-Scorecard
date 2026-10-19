# Your Pit: the angle redo (plan)

Date: 2026-10-19. Status: plan for the engine step. Mock: `docs/superpowers/mocks/pit-sim-v3/angle-redo-mock.html` and `.png`, two phone frames side by side. Left: the near home view at 390 by 844. Right: the same scene in far view, then the creator preview patch next to a yard crop of the same pitmaster, and a "+" at near scale with its tap area. Every kit, yard, barn, fence, ground and "+" sprite in it is the size rule redraw (`art3/rule.js`, B) drawn 1:1, so the mock now shows all five fixes. The contact sheet for Order of work step 1 is the size lineup: every redrawn sprite beside the pitmaster on one ground line.

## Why

Joel tried the angled yard (v3.5) and said the 8-bit original was the better design. Five causes, all fixed here:

1. We tilted a floor plan made for a straight-down view. The tree covered the kitchen, the barn ate the back corner, the front lawn was empty.
2. No shared size rule. A kettle nearly as tall as a person, woodpiles as big as the counter, a shelf taller than the shed door.
3. The whole 11 x 12 yard was forced onto a portrait phone, so everything shrank.
4. See-through ghosts of every unbought item, including a red drum ghost over the pitmaster.
5. Two pitmaster styles (creator preview vs yard).

Target look: mock B (`b-iso-pixel.png`). Target feel: the reference restaurant game Joel loves: big readable objects, clear walkways, a camera that shows part of a bigger place.

Game rules do not change: same stations and behaviors, same seats and decor items, same queue and gate, BFS on a tile grid, sim px TILE 16. Only where things stand and how they are drawn.

## Two facts of the 2:1 view that drive every choice

- Tile (x+1, y+1) is straight below tile (x, y) on screen. Anything standing on it covers the lower part of (x, y).
- A standing person (47 rp) covers about 4 rows of depth above their feet in their own column; a seated one about 3. So nothing a player taps may sit 1 to 4 rows straight behind a tile where people stand or sit, and nothing tall may stand in front of anything used.

Hat rule (from the first mock, where woodpiles on (1,0) and (2,0) floated just above the pitmaster's cap): no prop or decor stands on an apron tile 1 to 4 rows straight behind a tile where the pitmaster or crew stands (use, idle or spawn). The barn wall and what hangs on it (door, sign, windows) are exempt. Today that keeps (0,0) to (2,0) and (0,0) to (0,6) clear.

The plan below was checked against all three. The pitmaster's lane runs behind the front gear, so the gear stays in view and he faces the camera at the counter; guests queue along the barn, behind nothing.

## A. Floor plan

Grid 11 wide (x) by 12 deep (y), the same size as today, so BFS sizes, `GRID_H` and saves keep working. Row 0 is the barn apron (the barn wall stands on its outer edge). Column 0 is the fence apron (a tall privacy fence on its outer edge). Column 10 and row 11 carry a low picket on their outer edge. Customers spawn at (8, 12), outside the gate.

Screen directions: +x runs down and to the right, +y runs down and to the left. The back corner (0, 0) is at the top.

### Ground rows (`GROUND_ROWS`)

```
     x 0123456789A
y0     FFFFFFFFFFF   barn apron
y1     FPPPPLLLLLF
y2     FPPPPLLLLLF
y3     FPPPPLLLLLF
y4     FPPPPLLLLLF
y5     FPPPPLLLLLF
y6     FPPPPLLLLLF
y7     FPPPPLLLLLF
y8     FPPPPLLLLLF
y9     FLLLLLLLLLF
y10    FLLLLLLLLLF
y11    FFFFFFFFGFF   gate (8, 11)
```

F fence or apron (blocked for everyone), P paver (pitmaster), L lawn (guests), G gate. The patio is x 1 to 4, y 1 to 8. The stone path is cosmetic lawn (`MAP.walk`): (5,1) (6,1) (7,1) (8,1) and (8,2) to (8,10).

### Everything on it

```
     x  0    1    2    3    4    5    6    7    8    9    10
y0      F    _    _    R    sn   dr   _    _    hz   sh   F      barn apron (windows over 1 and 2 and over 6 and 7, sign over 3 and 4, door at 5)
y1      .    .    .    L    T    q0   q1   q2   q3   .    F
y2      .    xu   X    Ls   T    .    .    +cn  q4   .    p1
y3      .    pI   pU   L    T    .    .    .    s    c1   F
y4      .    .    B    L    t    .    a    b    s    c2   F
y5      .    du   D    L    K    .    P1   P1   s    .    F
y6      .    du   D    L    C    .    .    .    s    .    p2
y7      LP   tI   .    L    k    .    e    f    s    .    pl
y8      W4   .    bI   L    Q    .    P2   P2   s    .    pl2
y9      TR   .    dg   .    .    .    .    .    s    .    F
y10     W3   p3   .    o    .    .    fl   fl   ps   .    p4
y11     F    W    W2   F    F    F    F    F    G    mb   F
y12                                             S
```

Kitchen: T counter, t counter extension (bigtable), K kettle 1, k kettle 2, C cooler, D drum (2 tiles), B board, X trash, Q charcoal pile, L the lane (Ls spawn), xu trash back use, du drum back use. Crew: pI prep idle, pU prep use, tI tender idle, bI buddy idle. Line: q0 to q4, s stones, ps pass stop, G gate, S customer spawn. Seats: a pt1a, b pt1b at picnic table P1; e pt2a, f pt2b at picnic table P2 (decor); c1 c2 chairs. Decor: fl flower bed, o bird bath, LP lights post. Props: W woodpiles, R tools, sh shelf, hz hose, sn sign, dr barn door, p pots, pl planters, TR tree, mb mailbox, dg dog home. `+cn` is the canopy's for-sale marker tile. Column 0 from (0,0) to (0,6) and row 0 from (0,0) to (2,0) stay empty by the hat rule.

### Stations (`STATIONS`)

| id | tiles | use tiles (face) | gear |
|---|---|---|---|
| table | (4,1) (4,2) (4,3); (4,4) bigtable | (3,1) (3,2) (3,3) right; (3,4) right bigtable | (4,4) bigtable |
| board | (2,4) | (3,4) left; (2,3) down | |
| kettle1 | (4,5) | (3,5) right | |
| cooler | (4,6) | (3,6) right | |
| kettle2 | (4,7) | (3,7) right | kettle2 |
| pile | (4,8) | (3,8) right | |
| drum | (2,5) (2,6) | (3,5) (3,6) left; (1,5) (1,6) right | drum |
| trash | (2,2) | (3,2) left; (1,2) right | |

Counter plate spots: one per counter tile, centred on the tile top (3 spots, 5 with the extension: two on (4,4)).

### Cook loop legs (lane steps, all 1 to 3)

| leg | from use tile | to use tile | steps |
|---|---|---|---|
| charcoal to kettle 1 / kettle 2 | (3,8) | (3,5) / (3,7) | 3 / 1 |
| meat to kettle 1 / kettle 2 | (3,6) | (3,5) / (3,7) | 1 / 1 |
| kettle 1 / kettle 2 to board | (3,5) / (3,7) | (3,4) | 1 / 3 |
| drum to board | (3,5) | (3,4) | 1 |
| board to counter | (3,4) | (3,3) (or (3,4) with bigtable) | 1 (0) |

### Line, gate, idle tiles

| field | value |
|---|---|
| queue | (5,1) left, (6,1) left, (7,1) left, (8,1) left bigtable, (8,2) up bigtable |
| passStop | (8,10) |
| gate | (8,11) |
| custSpawn | (8,12) |
| spawn | (3,2) right |
| buddyIdle | (2,8) right |
| tenderIdle | (1,7) right |
| prepIdle | (1,3) right |
| prepUse | (2,3) down (the board's back use) |
| dogHome | (2,9) |
| dogRoam | (1,9) (2,9) (4,9) (5,9) (5,8) (5,6) (4,10) |

Walkway: from the gate straight up the stones of column 8, then left along row 1 to the counter. Nothing stands on it. The line stands along the barn, so it covers only the empty apron tiles (4,0) to (7,0) and never the counter, the gear or a seat.

### Seats and decor (`SEATS`, `DECOR`)

All seats face down.

| seat | tile | decor |
|---|---|---|
| pt1b | (7,4) | |
| pt1a | (6,4) | |
| chair1 | (9,3) | chair1 |
| chair2 | (9,4) | chair2 |
| pt2b | (7,7) | picnic2 |
| pt2a | (6,7) | picnic2 |

| decor | tiles | blocks | draws |
|---|---|---|---|
| chair1 | (9,3) | none | chair |
| chair2 | (9,4) | none | chair |
| flowers | (6,10) (7,10) | both | flower box along the front fence, left of the gate |
| birdbath | (3,10) | (3,10) | bird bath |
| lights | (0,7) | none | post on the fence apron; the string runs along the fence top to the back corner, then along the barn eave to a hook over (8,0), never over the kitchen |
| picnic2 | (6,8) (7,8) | both | table and benches, seats pt2b pt2a |

### Props (`PROPS`, same 19 ids)

| id | tile | blocks | note |
|---|---|---|---|
| shed | (5,0) | (5,0) | the barn door, drawn into the barn wall |
| sign | (3,0) to (4,0) | none | board hung on the barn wall; `signText` is its box |
| tree | (0,9) | (0,9) | fence apron; its canopy covers only sky and fence |
| woodpile | (1,11) | (1,11) | front apron by the picket (was (1,0), the hat) |
| woodpile2 | (2,11) | (2,11) | front apron (was (2,0)) |
| woodpile3 | (0,10) | (0,10) | |
| woodpile4 | (0,8) | (0,8) | |
| tools | (3,0) | (3,0) | |
| shelf | (9,0) | (9,0) | |
| hose | (8,0) | (8,0) | |
| pot1 | (10,2) | (10,2) | right picket apron |
| pot2 | (10,6) | (10,6) | right picket apron |
| pot3 | (1,10) | (1,10) | low, front left lawn corner |
| pot4 | (10,10) | (10,10) | right picket apron |
| planter | (10,7) | (10,7) | right picket apron |
| planter2 | (10,8) | (10,8) | right picket apron |
| mailbox | (9,11) | none | on the front fence line, right of the gate |
| picnic1 | (6,5) (7,5) | both | |
| bench1 | (6,5) (7,5) | none | drawn with picnic1 |

Tall things (over 20 rp) stand only on row 0 or column 0: barn, door, sign, tools, shelf, tree, lights post. The one exception is the drum (38 with its stack), which stands on the back side of the lane, where only the empty back patio and its own back use are behind it. Low props (20 rp or less) may also stand on the right and front picket aprons (column 10, row 11), never on a tile straight in front of a seat: on column 10 that rules out (10,4) and (10,5).

The drum moved from (2,6) (2,7) to (2,5) (2,6) so the home view frames it (C). The board's back use moved to (2,3) and the tender's idle to (1,7), so nobody stands straight behind the drum except at its own back use.

Overhead: `lights` (the string, drawn high along the back fence and the barn eave) and `canopy` (gear), a canopy over the line at (5,1) to (8,2) on 4 thin posts. `smoke`: one smoke column per lit cooker (kettle1, kettle2, drum, and any smoker gear), rising from its vent at 70 percent alpha. All three draw after the world and before marks. The canopy roof sits 64 rp up, above every head, so it only covers barn wall.

## B. Size rule (art px, 1 rp = 1 art px)

A tile is a 48 by 24 rp diamond (about one meter a side). The person is the yardstick. Heights are above the ground at the sprite's foot. A sprite's pixel height is its height plus the depth of its top face on screen (12 rp for a one tile item seen from above).

Body landmarks of the art3 person (people.js, feet on row 46): knee 6, hip 12, waist 14, shoulder 24, head top 47, hat to 51, seated head top 38, hand 20.

| thing | height (rp) | width or footprint | rule |
|---|---|---|---|
| person | 47 (hat 51) | 24 | the yardstick; never scaled |
| kettle | rim 16, lid top 26 | 24, 1 tile | to the waist |
| drum | top 26, stack 38 | 22, 2 tiles | to the shoulder |
| cabinet smoker | top 40, stack 52 | 30, 1 tile | to the chin |
| stick burner | chamber 24, stack 48 | 2 tiles | chamber to the shoulder |
| cooler | lid 10, handle 12 | 26, 1 tile | to the knee |
| counter, serving table | top 13 | 1 tile deep | to the hip |
| picnic table | top 13, bench 7 | 2 tiles long | to the hip |
| board (on its stand) | 15 | 1 tile | hip plus the board |
| charcoal pile | 12 | 24, 1 tile | |
| trash can | 18 | 16 | |
| woodpile | 14 | 1 tile | to the hip, never bigger than the counter |
| shelf | 30 | 26 | below the door |
| tools rack | 28 | 26 | below the door |
| barn door | 52 | 28 | taller than every prop but the tree |
| barn window | 26 high, sill at 32 | 34, centred over two apron tiles | over (1,0) (2,0) and over (6,0) (7,0) |
| window box | 7 high under the sill, flowers 4 above | 40 | |
| smoke column | kettle 82, drum 98 above the vent | puffs up to 21 | overhead, 70 percent alpha |
| barn wall | eave 80, roof plus 40 | the whole row 0 edge | |
| tree | trunk 36, canopy top 128 | canopy 84 wide | |
| back fence | 32 | | |
| front picket, hedge | 14 | | |
| gate posts | 22 | | |
| pot, planter | 16 | | |
| bird bath | 20 | | |
| flower box | 10 | | |
| chair | seat 7, back 20 | | |
| mailbox | 26 | | |
| sign board | hooks 66, bottom 38 | 60 by 22 | hung on the barn wall over (3,0) (4,0), under the light string |
| trailer rig | chamber 26, stack 52 | 2 tiles | |
| prep table | top 13 | 1 tile | items to 17 |
| warmer | top 22 | 1 tile | |
| hose reel | 14 | 1 tile | |
| lights post | 72 | | |
| canopy posts | 64 | | |
| dog | 14 | | |
| plate | 14 by 7, food 3 above the rim | | readable on any table |
| platter | 18 by 9 | | |
| carried item | at hand height 20 | | |

Every kit and yard sprite is redrawn to this table in `games/pit-sim/art3/rule.js` (done 2026-10-19). Same names as kit.js and yard.js; `art3.sizes('rule')` swaps them in (default `'v3'` keeps today's game art, so nothing changes until the engine step flips it); the new names `plus`, `barn_window` and `window_box` are always on and listed in `RULE_MANIFEST` (index.js). Rule sprites anchor on the ground centre of their footprint; wall pieces on the wall foot under their centre, `wall_barn` and `fence_diag` on the back corner. `meta('sign').text` is the board's text box, `slots('counter')` the plate spots, `seats('picnic_bench')` and `seats('chair')` the seat tops.

How it is measured: `art3.SIZE` (frozen) holds per sprite the rule height `h`, the `extra` the 2:1 view adds above the anchor (the back half of the top face, or how far the tall part's own foot sits behind the anchor), and the opaque width `w` where the rule gives one. `art3.verifySizes()` measures every frame's opaque pixels (alpha 200 and up): frame 0 must rise `h + extra` within 2 rp and match `w` within 2 rp; no frame may rise more than 2 rp over it. Plates, platters, ground tiles and the "+" are measured by whole height. Smoke columns are a ceiling only (today: 91 and 74, under 98 and 82). All 46 rows pass. Not redrawn (fall back to v3 art in rule mode, none used by the new plan except the dog): hedge, bed, backdrop, lights_string, picnic_small, bench_small, dog (18 tall, rule 14), pieces, carried items, dish cards, gauge.

## C. Camera

World: 576 by 424 rp. It ends 8 rp below the front corner of the picket (416), with no sidewalk or street band; outside the two front edges is a plain lawn verge. Projection from sim px (sx, sy): `X = OX + 1.5 (sx - sy)`, `Y = OY + 0.75 (sx + sy)`, OX 300, OY 140. A 16 sim px tile becomes a 48 by 24 diamond (today 32 by 16). People stay 47 rp, so the yard gets roomier without anything shrinking.

| view | when | scale (CSS px per rp) | shows |
|---|---|---|---|
| near | phones (viewport under 768 CSS wide), default | k / dpr with k = round(1.5 dpr) device px per rp (1.5 at dpr 2; tile 72 CSS, at least 40 at every dpr) | the kitchen, counter, line and nearest seats; about 260 by 440 rp at 390 by 844 |
| far | phones, after a pinch in or the corner button | fit the whole world to the view (non integer allowed, nearest neighbor) | the whole yard |
| fit | desktop | the largest k with the world inside the view, at least 1 | the whole yard; no pan |

Phone behavior:
- Home (`MAP.home`): X centred on the bounds of every station sprite plus the guests on q0 and q1. Those run from the charcoal pile's left edge (OX - 108) to q1's right edge (OX + 132), 240 rp, so the centre is OX + 12 and each side keeps 10 rp (15 CSS) inside the 260 rp view. Vertically the world (424) is shorter than the view (439 at 390 by 844), so it is anchored to the view bottom and sky fills the top; on this phone pan is sideways only. Where the view is shorter than the world, centre on the same bounds and clamp.
- The window over (1,0) (2,0) is the one the home view shows. The one over (6,0) (7,0) starts at OX + 144, just right of the view, and shows on a pan or in far view.
- Drag to pan. A pointer that moves more than 8 CSS px is a drag, never a tap. The camera clamps to the world.
- Auto follow: the pitmaster stays inside a dead zone (the middle 50 percent of the width, 60 percent of the height); when he leaves it the camera eases back over 250 ms. A manual pan pauses follow until the next tap that sends him walking.
- Zoom: pinch out of near goes to far, pinch in goes to near (snap, centred on the pinch). The corner button (four corner brackets) toggles near and far. Taps work in both.
- Reduced motion: no easing; follow jumps.

## D. For-sale spots

No see-through ghosts anywhere. An unbought station, gear spot or decor spot shows a small "+" on the ground at the centroid of its tiles: a 28 by 14 dark diamond at 30 percent under a cream plus (arms 3 rp wide and 13 long) with a 1 rp umber outline, 15 by 15 rp in all. The mock draws exactly this.

Hit target: the whole footprint of its marker tiles (one tile is 72 CSS wide at near), not the plus's opaque pixels. The plus alone is about 22 CSS, under the 40 CSS floor that check 1 holds everywhere else. It is a ground mark: drawn right after the ground, under every object and person, and hidden while a person stands on that tile. It shows in prep and in service.

Tap on a "+" opens the shop on that row (Gear or Decor tab, scrolled to the row, highlighted), even when it is not affordable yet. Marker tiles:

| id | marker tiles |
|---|---|
| kettle2 | (4,7) |
| drum | (2,5) (2,6) |
| bigtable | (4,4) |
| canopy | (7,2) |
| chair1, chair2 | (9,3), (9,4) |
| flowers | (6,10) (7,10) |
| birdbath | (3,10) |
| lights | (0,7) |
| picnic2 | (6,8) (7,8) |

Gear with no spot (cooler, tray) has no marker.

## E. One pitmaster

The creator preview draws the same in-yard sprite: `art3.drawPerson('player', 'down', ...)` standing on a small angled patch of three by three paver diamonds (144 by 72 rp) with a kettle at rule size beside him, at the phone near scale. The v2 preview figure is retired. RANDOM and every option row stay as they are.

## F. Engine change list (the later step)

### sim.js (MAP)

- `GROUND_ROWS`: the table in A.
- `STATIONS`: tiles, use, slots as in A. The v2 `draw` (top left sim px) and `sortRow` are replaced by the renderer's footprint depth; keep them only if the harness still reads them, set from the new tiles. `slotPx` and `spotPx` become per tile spots on the footprint (renderer side).
- `PROPS`, `DECOR`, `SEATS`: as in A, same ids and order.
- `spawn` (3,2) right, `gate` (8,11), `custSpawn` (8,12), `passStop` (8,10), `queue`, `buddyIdle`, `tenderIdle`, `prepIdle`, `prepUse`, `dogHome`, `dogRoam`: as in A.
- `overhead`: `{ lights: { post: (0,7), via: the back corner eave, hook: (8,0) }, canopy: { tiles: (5,1) to (8,2) } }`. `signText`: the board on the barn over (3,0) and (4,0).
- New: `MAP.walk` (stone tiles), `MAP.apron` (`{ barn: 'y0', fence: 'x0' }`), `MAP.forSale` (id to marker tiles, the table in D), `MAP.home` (the ids whose bounds the home view frames: every station plus `queue[0]` and `queue[1]`; see C).
- Unchanged: `MAP_W` 11, `MAP_H` 12, `GRID_H` 13, TILE 16, walkable rules, BFS.

### game.js

- Replace `GEO` with `WORLD = { W: 576, H: 424, OX: 300, OY: 140, SX: 1.5, SY: 0.75 }`; `isoX`, `isoY`, `unIso` use it. `unIso`: `a = (X - OX) / 1.5`, `b = (Y - OY) / 0.75`, `sx = (a + b) / 2`, `sy = (b - a) / 2`.
- The yard canvas becomes the viewport (CSS box times dpr). Draw with `setTransform(k, 0, 0, k, -x0 k, -y0 k)` in near and fit; far renders the world 1:1 to an offscreen canvas and scales it with smoothing off.
- Camera object and API: `PitSim.game.camera = { get(), set(mode), centerOn(tx, ty, instant), reveal(tx, ty), pan(dxCss, dyCss), follow(on) }`, mode `'near' | 'far' | 'fit'`. Pointer handling: drag threshold 8 CSS px, two pointer pinch, corner button.
- Depth: key = the footprint's front tile `x + y`, then layer (ground marks, objects, people), then X. Long objects (counter, picnic tables, drum) draw as one slice per footprint tile, each clipped to that tile's 24 rp column band and keyed by its own tile, so a person beside one end sorts right against each part.
- Ghosts removed: `ghost()`, `GHOST_ALPHA`, the dashed outlines and the `ghost: true` capture flag. Add `plusMarker(id)` from `MAP.forSale`, capture record `{ name: 'plus', id }`.
- `tileToClient(tx, ty, opts)`: calls `camera.reveal(tx, ty)` first (instant pan, 24 CSS px margin) unless `opts.pan === false`, then returns the client point as today (tile centre, or the nearest visible point of the station's own sprite). Returns null if the tile is off screen and pan is false.
- Hit testing: client to world (`X = x0 + (cx - rect.left) / z`, same for Y), then sprites front to back on their opaque masks (stations, seats, decor), people skipped; then "+" markers by their marker tile footprints (D); else the ground tile under the point via `unIso`. A drag never taps.
- Creator preview: the patch in E.

### bridge.js

- Drop `extGhost`, `lastCounter`, and the counter mirror (`isoView`): the counter now runs down to the left, the art's own direction.
- Add `plus(ctx, x, y)`, `preview(ctx, look)` (the E patch), and the ground tiles at 48 by 24 (paver, lawn, stone), the barn wall strip along row 0 and the fence strips along column 0 and the front edges, replacing `stage` and `fenceRun` at the old size.

### art3 (redraw step, done: `art3/rule.js`, see B)

Redraw to B: kettle, drum, cabinet, stick_burner, trailer_rig, pile, woodpile, cooler, board, counter, counter_long, trash, prep_table, warmer, plates, platters, shelf, tools, pot, birdbath, chair, mailbox, picnic and bench (2 tiles along x), lights_post, canopy, sign (wall board), barn wall and door, fence pieces (back 32, front 14), ground tiles 48 by 24, a new `plus` mark (the D spec), the barn window with its window box, and the smoke puff and column sprites (`smoke_column`, `smoke_column_short`) checked against the B heights. Add `SIZE` and `verifySizes()` to index.js. People, bubbles, hearts, numbers and dish cards stay. Engine wiring: load `art3/rule.js` after fx.js in index.html, call `art3.sizes('rule')` before `art3.build()`, place every sprite by its anchor (B), and drop the bridge's v2 rect fitting for these names.

### Harness (dev/)

- Every tap goes through `PitSim.game.tileToClient` (it now pans first). Scripts that tap fixed coordinates switch to MAP lookups.
- Shots that need the whole yard call `camera.set('far')` on phones or run at desktop width.
- New checks:
  1. Near view at 390 by 844: every station tile, use tile, seat and queue spot is at least 40 CSS px wide.
  2. Occlusion: with nobody standing on it, no station or seat has more than 25 percent of its opaque pixels covered by world sprites drawn after it (the translucent overhead layer, smoke and lights, is not counted).
  3. Zero capture records with `ghost: true`; one `plus` record per unowned id in `MAP.forSale`, none for owned ones.
  4. `art3.verifySizes()` passes.
  5. The creator preview and the yard draw the same `player` look through `art3.drawPerson`.
  6. BFS from MAP: every cook loop leg in A is 1 to 3 steps.
  7. Every prop taller than 20 rp stands on row 0 or column 0 (the drum is the named exception), and no prop or decor breaks the hat rule (A).
  8. Home view at 390 by 844: every station sprite and the guests on q0 and q1 lie inside the view with at least 12 CSS px to spare on each side.

## Order of work

1. art3 redraw to B with `verifySizes()` (art3 files only, no game files). Built 2026-10-19 (`art3/rule.js`, index.js wiring, lineup sheet, mock redrawn with it); waiting on Joel's go. Gate: `verifySizes()` passes, and Joel looks at a redraw contact sheet (every redrawn sprite beside a person, at near scale) next to mock B and says go. The engine steps wait for both.
2. sim.js MAP (A) and its sim tests.
3. game.js and bridge.js: projection, camera, depth slices, markers, hit testing, preview (C, D, E, F).
4. Harness checks, then a phone pass on device before any release.
