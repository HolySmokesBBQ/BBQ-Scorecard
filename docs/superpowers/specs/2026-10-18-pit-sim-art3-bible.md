# Your Pit v3 art bible (art3)

2026-10-18. Target picture: `docs/superpowers/mocks/pit-sim-v3/b-iso-pixel.png` (mock B). Joel: "I like the middle ones in both." Source of every number below: `b-iso-pixel.html` (mock B), `screen-6-creator.html` (swatches), design doc 12.1 to 12.3 and 19.1 to 19.2. Palette code: `games/pit-sim/art3/palette.js` (`PitSim.art3.PAL`). Where this file and the design doc disagree on look, mock B wins and the line says so.

## 1. Scale and projection

| Item | Mock B | v3 game |
|---|---|---|
| Canvas | 195 x 422 art px, shown at 2 CSS px per art px | map 352 virtual px wide (11 tiles x 32), integer k (k = 3 on 1080 device px) |
| CSS per art px | 2.00 | 1.14 on a 1080 / 411 CSS phone (k 3, DPR 2.625) |
| Pixel density vs mock B | 1x | 1.75x linear |
| Tile | 32 x 16 iso diamond | 32 x 32 orthogonal, sim stays 16 px |
| Person on screen | 16 x 28 px = 32 x 56 CSS | 30 x 46 px (outline incl.) = 34 x 52 CSS |
| Angle | true isometric, 2:1 lines | iso drawn into the art on the orthogonal grid (doc 12.1, round 1) |

**Why not true iso.** An 11 x 12 diamond on a 360 CSS phone with a 4 CSS gutter gives tiles 30.6 x 15.3 CSS: the tap height fails the 34 CSS floor. Oblique stays.

**Iso rule (round 1: every boxy prop, one helper).** The first pass drew an oblique box (8 px side face rising 4); the art director found it too faint to read as the Cafeland angle Joel picked, so every prop now draws mock B's iso box inside its orthogonal footprint. The grid, footprints and tap tiles stay orthogonal (32 px tiles, 34 CSS px or more on a 360 phone); only the drawing changed. Geometry lives in `games/pit-sim/art3/proj.js` (`PitSim.art3.proj`: `isoP(ox, oy)` gives a point function `P(u, v, z) = [ox + u - v, oy + (u + v) / 2 - z]`; `isoFaces(P, u0, v0, u1, v1, z0, h)`; `boxFaces(fx, fy, U, V, H)` by the front bottom vertex; `footprintBox`; `isoLineY`). kit.js and yard.js both paint through `isoFaces`; the public helper is `art3.box(ctx, fx, fy, U, V, H, ramp, opts)`.

| Face | Shape | Tone |
|---|---|---|
| Top | rhombus, 2:1 edges (two px across per px down, mock B's isoLine stair) | `ramp.hi`, 1 px `rim(ramp)` inside both front edges |
| Left (faces +v, down left) | U wide, h tall | `ramp.base` (lit) |
| Right (faces +u, down right) | V wide, h tall | `ramp.shade` |
| Crease (opt) | 1 px under the top on both faces | `ramp.dark` |

Keep U and V even so every vertex is a whole pixel. A 1 x 1 prop uses a 28 px rhombus (U = V = 14) centred on the tile, front vertex on the footprint's front line; the serving table runs down the diagonal (U 20, V 76 on a 3 x 2 footprint, its long right face toward the line of guests). Iso props cast their footprint rhombus as a shadow, nudged 3 right and 2 down (`meta.isoShadow`). Round props (drum, kettle, trash) draw every ring as a 2:1 ellipse. The stick burner and trailer rig stay side profile (long tanks), with flat slabs for firebox and deck. Y-sort: `rowKey(row) = 32 row + 30`, movers `2 simPy + 30`; beside a long diagonal prop the renderer compares the walker with the prop's ground rhombus (in front of either front edge draws after it, behind either back edge draws before it), as the look proof's `walkerKey` does.

**Ground (round 1).** `ground(ctx, map, { iso: { corner, vertex, stones } })` paints mock B's split: warm cobbles on the patio, the upper diagonal half, and a soft lawn diamond checker below, split by a V of two 2:1 edges meeting at `vertex` (on a paver lattice point, so the edge runs along grout), with a grout curb and a dark lawn step; above the back lines through `corner` (back fence and barn foot) the ground stays clear for the backdrop. Patio grout is 2 px of `paver.grout`. Without `iso` the per-tile ground below still works. **Ground (first pass).** Pavers are mock B's diamonds on the square grid: 32 x 16 diamonds (yard.js `PHW` 16; built at 16 x 8 they read as a busy honeycomb, and 32 x 16 at 1.14 CSS per px lands on mock B's on-screen paver of about 32 x 16 CSS), 1 px `paver.dark` grout, 1 across and 2 down per tile, odd rows moved half a diamond, fill seeded among `paver.base`, `paver.shade`, `paver.alt`, a 4 px `paver.hi` stroke 1 px inside the lower left edge. Lawn is a per-tile checker of `lawnA.base` / `lawnB.base` with 3 seeded tufts per tile (half a 3 px `lawnA.hi` chevron, half a 2 px `lawnA.dark` dash). Curb: 1 px `paver.dark` line where paver meets lawn. Ground never takes outline, rim or shade passes and is cached once to its own canvas.

## 2. Palette

`PAL.ANCHOR` (fixed, never retuned): K `#1b1714` near black, U `#2a2015` umber, C `#E6D8B8` cream, O `#D06129` orange. `PAL.OL` `#1e1510` is the shared outline (round 1 deepened it from mock B's `#2a1a14` toward K so props pop off the warmer ground).

Ramps are `[hi, base, shade, dark]`. Values marked filled in `palette.js` are tones mock B never needed, chosen on the same hue line.

| Group | Ramp | hi | base | shade | dark | extras |
|---|---|---|---|---|---|---|
| Ground | lawnA | #98d866 | #7cc84a | #6ab83e | #58a234 | round 2 |
| | lawnB | #8acc5a | #6cb840 | #5ea836 | #4e942e | round 2 |
| | paver | #f6e4bc | #e6c896 | #dcbc88 | #b98650 | alt #ecd2a4, grout #c8935a (round 2) |
| | stone | #e8e1d1 | #cfc6b4 | #b3a994 | #8e8572 | |
| | sky | #ffffff | #b9e6f8 | #9fd9f4 | #7cc4e6 | |
| Plants | leaf | #7fcf63 | #58ad4f | #3d8f3f | #2f7a35 | |
| | hedge | #56ad57 | #3f9248 | #2f7a3b | #24602e | |
| | stem | #5cbf55 | #3f9a45 | #2f7a35 | #24602e | |
| | soil | #8a6040 | #6e4a2e | #56391f | #3e2814 | |
| Wood | woodL (planks, tops) | #f2c58a | #e2a866 | #c98a4b | #a26a36 | rim #f6d6a4 |
| | woodM (posts, boxes) | #e2a866 | #c98a4b | #a26a36 | #7c4c25 | rim #f2c58a |
| | woodD (legs, logs) | #9c6438 | #7a4a28 | #5e3a1e | #4a2c16 | |
| | logEnd | #f6d9a4 | #e8bc7e | #c8935a | #9c6438 | |
| | bark (trunk) | #a8744a | #8a5a34 | #6b4426 | #4e301a | |
| | board | #f3cf94 | #d6a362 | #b8844a | #8e6232 | |
| Build | barn (red wall) | #de6e55 | #c9553d | #a8432f | #8f3928 | trim #fbf3e2 |
| | roof | #7385a6 | #5b6b8a | #47546f | #36405a | |
| | glass | #d7f2ff | #8fd3f5 | #6ab8e0 | #4a96c0 | |
| | fence | #fbf3e2 | #f4ead2 | #d8c9a6 | #b5a37f | |
| Gear | kettle (black) | #575769 | #383844 | #24242c | #141418 | spec #9a9ab0 |
| | drum (red) | #e8604c | #c63d2c | #94291d | #5c1d16 | |
| | coolerRed | #d8443a | #c43a30 | #9c2a22 | #6e1c16 | |
| | coolerWhite | #fbf8f0 | #e2ddd2 | #c9c2b4 | #a89f8e | rim #ffffff, handle #f4ece0 |
| | cloth (blue) | #6ea6f2 | #3f82e0 | #2c63b8 | #214c90 | rim #a9cbff, check #8fbaf5 |
| | steel | #e6e8ee | #b9bcc6 | #8a8e9a | #5c606c | |
| | plate | #ffffff | #fbf8f0 | #d4cec2 | #b0a898 | |
| Fire | charcoal | #5a5450 | #3a3532 | #262220 | #161312 | ash #c9c2b4, ashD #8a8478 |
| | ember | #ffd25a | #ff9a3c | #e0531f | #8a2a12 | |
| | smoke | #ffffff | #f3f3f6 | #d2d3dc | #9d9eae | ol #9d9eae |
| | smokeDark | #9a948e | #6e6863 | #544f4b | #3a3633 | ol #3a3633 |
| Marks | heart | #ffb0bd | #ff4f6d | #d83652 | #a8243c | |
| | coin | #fff2b8 | #F3CF6D | #e0a82e | #c98a1e | |
| | bulbs | #ffd84f #ff8a4f #76d2ff #9cf06a #ff6f9a, wire #3a2a20 | | | | |
| | flowers | #ff7aa8 #ffd84f #ffffff #ff8a4f #c792ff, centre #ffe9a0 | | | | |

**Meats** (`PAL.MEAT[m].raw / cooking / done / burnt`, base tone shown; full ramps in code):

| Meat | raw | cooking | done | burnt | extras |
|---|---|---|---|---|---|
| sausage | #ee9a8e | #d0663e | #b84d2a | #2e221c | |
| chicken | #f4ccb4 | #e8b060 | #d9973d | #2e221c | bone #f7ecd2 |
| ribs | #f29a9a | #b85a36 | #8a3a22 | #2e221c | bone gap #5e2412 |
| butt | #f2a4a0 | #c87046 | #b86a3e | #2e221c | bark #4a2414 (not in mock B) |
| brisket | #e07c74 | #a04a30 | #b0563c | #2e221c | bark #3e2318, barkL #5a3424, ring #ff7f72, fat #f6dcae |

Burnt shares one ramp `#4a3a32 #2e221c #1b1714 #1f110b`: near black is spent on burnt meat and eyes only.

**People swaps** (base shown; ramps in code). Order matches the creator swatches.

| # | Skin base / cheek | Hair base | Apron base |
|---|---|---|---|
| 0 | #f7d9c4 / #f2a493 | #2a1c14 black | #d2412f red |
| 1 | #edc29b / #e8957c | #5a3620 brown | #e8862e orange |
| 2 | #d9a06e / #d57e62 | #9a4424 auburn | #3f9a42 green |
| 3 | #b87a4b / #c0604a | #e2b65a blond | #2f6ac0 blue |
| 4 | #8e5634 / #a04a36 | #e07a32 ginger | #4a423c charcoal |
| 5 | #5f3a25 / #7e3a2a | #b9b4ae gray | #e0609a pink |

Shirts `[hi, base, shade]`: white, purple, red, teal, yellow, green, sky, pink, orange, blue, magenta (all mock B guests), denim (creator tee). Crew shirt by role: FIRE orange, PREP green, RUN blue, DRIVE denim, TILL yellow. Pants: navy #3c4f7a (default), khaki #5a4a3a, brown #4a3a30. Shoes #3a2a22. Face: eye = OL, catch-light #ffffff, mouth #b0443a, mouth inside #6a2a1c, teeth #fff6ea. Hats: cap slate #46506c (round 1: a domed crown with a seam and button, lit streak top left, the bill out on the light side with a dark underside, so it never reads as black hair), cowboy #c9934f band #5a2a1a, bandana #d2412f dots #ffffff.

**Alpha** (`PAL.ALPHA`, `{rgb, a, css}`):

| Entry | Colour, alpha | Use |
|---|---|---|
| shadowPerson | K, 0.28 | people, posts, kettle, drum (mock B multiply 0.72) |
| shadowProp | K, 0.25 | cooler, pile, board, woodpile, tree (0.75) |
| shadowWide | K, 0.20 | tables, benches, counter, beds, stones (0.78 to 0.80) |
| smokeNear / smokeFar | #f3f3f6, 0.70 / 0.50 | puffs 1 to 3 / 4 and up |
| smokeDark | #6e6863, 0.70 | a burning cook |
| emberGlow | #ff9a3c, 0.35 | halo at a lit vent or open lid |
| spec | #ffffff, 0.60 | 1 px streaks on lids, counters, glass |
| dim | K, 0.55 | modal backdrop |

**Count.** 240 distinct world hexes, 357 with the people swaps (`PAL.all()`). Mock B itself uses 197 literal hexes plus derived ones. **Deviation from doc 12.2 rule 8** ("about 60"): 4-tone ramps for every material mock B shows cannot fit in 60; the picture wins.

**Helpers.** `PAL.outline(ramp)` returns the ramp's `ol` or `OL`. `PAL.shade(hex, t = 0.22)` mixes toward warm purple brown `#2e1a2c` (one ramp step). `PAL.rim(rampOrHex, t = 0.35)` returns a pinned `rim` or mixes `hi` toward warm cream `#fff4d6`. Also `ramp(name)` (throws on unknown), `mix`, `rgba`, `hexToRgb`, `rgbToHex`, `all`.

## 3. Light, rim, outline, shadow

| Rule | Spec |
|---|---|
| Light | from the top left. Top faces hi, front faces base, right faces shade, creases dark. |
| Cylinders (drum, kettle bowl, posts) | columns left of -2/3 r take hi, right of +1/2 r take shade (drum: 3 hi columns, 4 shade of 13). Posts 3 px: hi, base, shade. |
| Pass order | 1 flat fills, 2 details in dark (planks, bands, grooves), 3 rim, 4 shade band, 5 outline, 6 specular. |
| Rim pass | 1 px `rim(ramp)` on the front edge of every top face and on exposed top and left edges of rounded forms. |
| Shade band | 1 px `ramp.shade` on exposed bottom and right edges of front faces. |
| Flat tag | eyes, catch-lights, mouths, text, icons 8 px and under skip passes 3 and 4. |
| Outline | 1 px `OL`, 4-neighbour, outside the silhouette only; inside shapes separate by tone, never by line. Smoke uses its own `ol`. No outline on ground, sky, clouds, the backdrop tree line, stepping stones. **Deviation from doc 12.2 rule 3** (own-ramp outline): mock B outlines everything solid in one warm brown, and that is the look Joel picked. |
| Specular | 1 to 3 px: kettle `spec` top left of the lid, white glint on glass, `ALPHA.spec` streak on lids and counter tops. |
| Shadow ellipse | drawn before its sprite, on the ground layer. Centre: anchor x (people) or anchor x + 1 (props, light from the left), anchor y - 1. rx = round(visible footprint width / 2) + 1, ry = max(2, round(rx / 2.75)). Person: rx 15, ry 5. Alpha by size row above. |

## 4. People (parts compositor)

One 32 x 48 cell for player, crew and guests. Anchor (16, 48). Columns 0 and 31 only for hat brims and held tools.

**As built (people.js, mock B wins).** The head is square like mock B's 14 x 14: 24 wide x 22 tall (columns 4 to 27), not 28 wide. Body width equals head width (body B is 1 px wider each side). Cell rows: head 4 to 25 (6 to 25 for body old), neck 26, shirt 27 to 36, pants 37 to 44 (6 rows for old), shoes 45 to 46, feet end on row 46. On screen a person is 26 px wide with outline (28 for body B) and 44 px tall. The tables below are the plan the builder started from; where they differ, people.js is the reference.

| Rows (cell) | Part | Measured from mock B (14 x 26) |
|---|---|---|
| 0 to 1 | hat headroom | cap is 5 rows over the hair |
| 2 | head outline | |
| 3 to 24 | head, 22 rows x 28 | head 14 rows x 14 (54 percent of height) |
| 25 to 46 | body, 22 rows x 28 | body 12 rows |
| 47 | feet outline | |

Head interior (rows 0 to 21, columns 0 to 27):

| Feature | Rows | Columns | Tone |
|---|---|---|---|
| Hair cap (short) | 0 to 5 full, 6 to 7 fringe | sides 0 to 1 and 26 to 27 down to row 14 | hair ramp, hi streak 3 px at row 4 |
| Face | 7 to 20, chin taper rows 19 to 20 | 2 to 25 | skin base, shade column 24 to 25 on 3/4 view |
| Eyes | 11 to 14 (3 x 4 each) | 6 to 8 and 19 to 21 | `FACE.eye`, catch-light 1 px at the eye's top left |
| Blush | 16 (3 x 1) | 3 to 5 and 22 to 24 | skin `cheek` |
| Mouth | 17 (2 x 1); happy 4 x 2 | 13 to 14 | `FACE.mouth` |
| Neck | 21 | 10 to 17 | skin shade |

Eye scale note: mock B eyes are 2 x 3 at 2 CSS per px (4 x 6 CSS); 3 x 4 at 1.14 CSS keeps the same size on screen. Doc 12.2 rule 5 said 2 x 3; same look, finer grid.

Body interior (rows 0 to 21): shirt 0 to 9 with sleeve shade columns 4 and 23, hem row 9 in shirt shade; hands 3 x 3 at rows 9 to 11, columns 0 to 2 and 25 to 27; pants 10 to 18, columns 4 to 23, leg gap columns 12 to 15 from row 15; shoes rows 19 to 21, columns 4 to 11 and 16 to 23. Apron: rows 0 to 15, columns 5 to 22, bib columns 8 to 19 on rows 0 to 3, a 1 px apron shade fold at column 7.

Facings: down (face), up (back of head, 2 px of skin at the jaw corners), side (3/4 face turned left; right is the flip). Seated: rows 0 to 37 only (head plus torso to the hands), sprite 32 x 38, anchor (16, 38) on the bench seat line.

| Part set | Options |
|---|---|
| Skin | 6 (`PAL.SKIN`) |
| Hair | short, curly (2 px scallop edge, hi and dark speckle), long (sides to body row 4 behind the shoulders), buzz (rows 0 to 3, speckled, no sides below row 8), bun (short plus an 8 x 6 bun in the headroom), bald (skin crown, 3 x 2 hi specular top left) |
| Hair colour | 6 (`PAL.HAIR`) |
| Face | none; mustache (hair dark, row 16 columns 10 to 17 plus row 17 tips 9 and 18); beard (hair base, jaw rows 16 to 21, mouth stays skin); glasses (OL 5 x 6 rims round each eye, bridge row 11 columns 10 to 17, 1 px glint) |
| Hat | none; cap (crown head rows 0 to 6, brim rows 7 to 8 to column 29); cowboy (crown in headroom, band row 4, brim rows 6 to 8 full cell width); bandana (rows 0 to 4, white dots every 4 px, knot at columns 26 to 28) |
| Apron | 6 (`PAL.APRON`); guests wear none |
| Shirt, pants | `PAL.SHIRT` (crew by `ROLE_SHIRT`), `PAL.PANTS` |

Motion:

| Clip | Frames | Timing | Spec |
|---|---|---|---|
| Idle | 2 | 500 ms each | frame 1 drops head and torso (cell rows 0 to 37) 1 px; feet fixed |
| Walk | 4 | 125 ms each | 0 left contact (right shoe up 2 px), 1 pass (both down, body up 1 px), 2 right contact, 3 pass; hands swing 1 px opposite the legs; side view strides 3 px |
| Blink | 1 | 120 ms, every 2.5 to 4.5 s, seeded per person | eye rows replaced by one OL row at eye row 13 |
| Eat (seated) | 3 | 400 ms | fork down, fork up, content face |

Bust (crew card portrait): 32 x 32, cell rows 0 to 24 plus 7 rows of shoulders (shirt, columns 1 to 30, no arms). Shown at 2x on cards, 4x on the detail sheet.

## 5. Naming, anchor, API

| Kind | Name | Frames |
|---|---|---|
| Person | `<who>_down`, `<who>_side` | 0 to 1 idle, 2 to 5 walk, 6 blink, 7 unhappy |
| | `<who>_up` | 0 to 1 idle, 2 to 5 walk |
| Carrying | `<who>_carry_down`, `<who>_carry_up`, `<who>_carry_side` | 0 to 1 idle, 2 to 5 walk, hands up and out; plates go at `personHands()` |
| Seated | `<who>_sit` (32 x 38, anchor 16, 38) | 0 idle, 1 blink, 2 fork down, 3 fork up, 4 content, 5 unhappy |
| | `<who>_sit_up` | 0 to 1 idle, seen from behind |
| Bust | `bust_<who>` | 1 |
| who | `player`, `crew0` to `crew5`, `cust0` to `cust7` | |
| Stations, props, ground, effects | the v2 name where one exists (`kettle`, `drum`, `cooler`, `board`, `counter`, `counter_ext`, `pile`, `paver`, `lawn_a`, `lawn_b`, `fence_back`, `picnic`, `tree`, `smoke`, `bubble`, `coin`, `font` ...) | v2 frame meaning kept |
| New | lower snake case, noun first, variant last: `wall_barn`, `roof_barn`, `lights_string`, `stone_step` | |
| Hand overlays | v2 `hand_*` names at 16 x 16 | |

**Anchor rule.** Every frame stores `{w, h, ax, ay}`. The anchor is the bottom centre of the footprint: ax = footprint centre column, ay = the ground line under the front face (people: (16, 48)). The renderer places a sprite with its anchor on the footprint's bottom centre in world px, y-sorts by anchor y, and a flip mirrors about ax. Art grows up and right of the anchor only (side face spill), never down.

**API** (`window.PitSim.art3`, v2 shape kept): `TILE` 32, `PAL`, `build()`, `has(name)`, `frames(name)`, `draw(ctx, name, x, y, frame, flip)` (top left, as v2), `drawAt(ctx, name, ax, ay, frame, flip)` (by anchor), `anchor(name, frame)`, `drawScaled`, `canvasFor`, `text`, `textTinted`, `textWidth`, plus `look(id, parts)` to register a compositor look under a `who`. Section 7 lists what `index.js` actually exports.

**Font.** The 5 x 7 glyph set in `screen-1-season.html` (A to Z, a to z, digits, punctuation). Bold lights each pixel and the one to its right; advance = glyph width + 1, + 1 more when bold. Drop shadow 1 px down in K; floating numbers outlined in OL. Speech bubble: mock B's 18 x 15 white bubble at 1.75x (32 x 26 plus a 4 px tail), 1 px `UI.bubbleEdge` inner bottom line, OL outline.

## 6. Frame budget

| Item | Budget |
|---|---|
| Frames per look | 26 (down 8, up 6, side 8, sit 4) |
| Looks built at start | player plus hired crew (up to 7); guests 8 looks built on first need |
| World frames (stations, props, ground, effects, font, hands) | 220 or fewer |
| Total frames | 640 or fewer, flips cached only for side, sit and hand names |
| Memory | 8 MB or less of frame canvases |
| `build()` | 150 ms or less on Joel's phone; 50 ms or less in the desktop dev harness |
| Per rendered frame | 1 ground cache blit plus 200 or fewer drawImage calls; 60 fps target, 55 floor |
| Animation rates | walk 8 fps, idle 2 fps, smoke 6 fps (puff rises 1 px per frame), ember 8 fps, string lights 1 fps twinkle |
| Determinism | every seeded choice (tufts, pavers, blink timing, leaf speckle) from one mulberry32 seed per sprite name |

## 7. Assembly (index.js) and the look proof

Load order, each file adding to `PitSim.art3` and none replacing another: `palette.js`, `proj.js`, `people.js`, `kit.js`, `yard.js`, `fx.js`, `index.js`. `index.js` throws a named error if any of the first six is missing, and throws at load if two category files define the same sprite name.

| Export | What it does |
|---|---|
| `build(opts)` | builds kit, yard and fx, then prebuilds the looks in `opts.looks` (default: registered `player` and `crew*`); guests stay lazy. Checks `MANIFEST` against the category files and throws on drift. Returns `{ ms, parts: { kit, yard, fx, people }, looks, frames, names }` |
| `has`, `frames`, `setOf`, `anchor(name, frame)` | one lookup over kit, yard, fx and people. People are named sprites for any look registered with `art3.look(who, parts)`: `<who>_down`, `_up`, `_side`, `_carry_down`, `_carry_up`, `_carry_side`, `_sit`, `_sit_up`, `bust_<who>` |
| `draw` (top left), `drawAt` (anchor), `drawTile`, `placeTile`, `drawScaled`, `canvasFor`, `frameCanvas` | v2 shims over every set. `placeTile(name, tx, ty)`: yard pieces use their own registration, kit pieces sit on their footprint, people and effects stand on the tile's foot line |
| `text`, `textWidth`, `floatNum` | the fx font. `textTinted` also accepts every v2 `COLOR` key (`V2_COLOR` maps them onto the v3 palette), so game.js `T()` and `popText()` keep working at v3.4 |
| `rowKey`, `moverKey`, `compare`, `ysort(items)` | the v2 sort order doubled (proj.js) |
| `tileToScreen`, `tileAnchor(tx, ty, cols, rows)`, `moverFoot(simPx, simPy)`, `screenToTile(clientX, clientY, rect, headroom)`, `scaleFor(vw, dpr)` | the oblique projection on the 32 px grid. A mover's feet sit at `FOOT` 30 px into its tile, so its foot y equals its sort key |
| `HEADROOM` 64 | render px of sky band above row 0 (the yard `backdrop` sprite is exactly this tall). It also holds the barn roof (22 px), the tree canopy (about 30) and the back pickets (28). The game canvas is 352 x (384 + 64) |
| `names()`, `manifest()`, `verify()`, `MANIFEST`, `PEOPLE_MANIFEST` | every world sprite with set, size, frames and anchor; people by pattern |

**Palette additions** (requested by the builders, all filled): `clay` (pots, now used by yard.js), `bloom` (flower centres, base #ffe9a0 as listed above, now used by yard.js), `fur` (the dog, now used by yard.js), `orange` (UI orange on anchor O), `ironRed` (the maroon trailer tank of the gear card; not used yet). yard.js `signText` also takes a newline to force two lines (`'YOUR' + newline + 'PIT'`: gold over orange, as mock B).

**Measured** (headless Chrome, desktop, 390 x 844 at DPR 2, the look proof page, 13 loads): warm reloads give `build()` 50 to 73 ms with player and 3 crew prebuilt (kit 9 to 13, yard 13 to 17, fx 7 to 10, people 20 to 30 for the 4 looks, about 6 ms a look); the first load in a fresh profile gives 73 to 92 ms. Before the proof filled its main canvas ahead of `build()`, 2 of 3 fresh-profile loads also put 420 to 1250 ms on whichever set touched a large canvas first (the browser setting up its raster context); with the main canvas filled first that cost has not shown up in 7 fresh loads, and the fill itself takes 0 to 2 ms. The game should draw its first frame (or a fill) before calling `build()`.

**Budget against section 6.** World frames are 274 (kit 94, yard 96, fx 84), over the 220 line: beds (32), the gauge (17) and the five 5-frame meat pieces are most of it. A look is 68 atlas frames plus a bust (flips of side, carry side and sit, and the carry poses), over the 26 planned. `build()` with 4 looks is over the 50 ms desktop line; the world sets alone are under it.

**Round 1 sprites.** New: `fence_diag` (back left picket run on the diagonal), `flower_box`, `bubble_body` (with `fx.bubbleAt(ctx, tipX, tipY, bodyDx, meat)` and `fx.placeBubbles(list, heads, bounds)`: tail tip at least 2 px over the owner's head, the body slid sideways off other heads and bubbles, the tail still pointing home), `platter_<meat>` (26 x 16 carried plates with a lit rim). Redrawn: `backdrop` (352 x 176, sky, hills and tree line along the back fence line), `wall_barn` (a long lap-sided wall receding from `yard.BACK_CORNER` (144, -40) along u, gable end, slate roof and ridge, four-pane window with a flower box, hayloft door), `picnic` (0 table, 1 cast shadow) and `picnic_bench` (0 far, 1 near) on one 126 x 94 canvas and anchor, seats and plate spots in `yard.PICNIC`; `sign` (frame 1: its own post on an iso foot block, an arm, chains, a framed dark board, `signText` in 2x bold gold over orange with a dark outline when the name fits, `yard.signHook` for the light string), `lights_post` (hook 104 px up, so the string clears every head). `floatNum(..., { clamp: [x0, x1] })` keeps numbers 4 px inside. Retired from the proof (still in the library): pots, birdbath, chair, the L-shaped bed.

**Look proof.** `games/pit-sim/dev/look-proof.html` loads the seven files plus `art3/proof.js` (all `defer`, no inline script). Round 1 composes the yard on mock B's layout (patio upper half, barn wall receding top right, sky wedge top left, light string high on two posts, stepping stones across the lawn with three diagonal picnic tables, the tree and a flower box) rather than the v2 `MAP` rows; the game's map will need the same split when v3.4 swaps the art in. Under the scene: z-order strips (one walker behind, overlapping and in front of a picnic table and of the serving table) and the three look presets as full figures. Earlier it drew the v2 backyard with a mock B HUD strip, a 3 preset pitmaster toggle and three crew cards after `screen-2-crew.png`. `#look=0`, `#look=1` or `#look=2` picks the starting preset. With prefers-reduced-motion it draws one still frame. The v2 props `tools`, `shelf` and `hose` have no art3 sprite yet; the proof stands in `prep_table` 0, `prep_table` 2 and a grass `pot`. The kettle smokes in short puffs rather than mock B's column because a column from (5, 2) would cover the pit sign on the back fence at (4, 0).

**Round 2 (art director).** Palette: the round 1 lawn read lime and the 2 px orange-brown grout made a loud checkerboard; the lawn moved one step greener and darker (bases #7cc84a and #6cb840 from mock B's PNG) and the cobbles went soft cream with a light tan grout (#c8935a) and a narrow base to alt step. New sprites: `dish_<meat>` (48 x 30, card size plated meat, anchor the plate centre) and `kit.dishCard(ctx, x, y, w, h, meat, { selected, label })`, which draws one card of mock B's dish dock (wood band, orange inset, cream face, the dish, the label in the pixel font; the selected card is raised 3 px with a gold band and an orange ring); `smoke_column_short` and `smoke_column_short_dark` (32 x 82, anchor (12, 80)), a two thirds height column with almost no drift that rises straight from the kettle lid. Redrawn: `pile` 0 to 2 is one kraft charcoal bag (a tapered, slumped iso box with a lit folded top face, a lit left column, an orange band with a cream flame mark) with a few briquettes spilled at its foot, fewer as it empties; 3 is the flat folded bag. The pitmaster's tongs are two 1 px steel arms in a V, each with its own dark outline and one highlight pixel, held 10 px out and 5 px up from the fist (people.js `TONG_A`, `TONG_B`). Look proof: the prep cart left the patio and the bag moved beside the cutting station; the floating tip follows the pitmaster but stays in the clear band under the light string and above the serving table's back edge; the tree sits at x 296 so its canopy stays inside the 352 px frame; the tables stagger upper left, middle, lower right, each with a back-facing guest on the near bench, and the flower box sits bottom left; the dish dock (sausage, chicken, ribs, brisket) sits under the yard; the look toggles draw their labels with `art3.text` in umber buttons that turn orange when pressed. The kettle now carries the short column (the round 1 note about covering the pit sign no longer applies on mock B's layout).

