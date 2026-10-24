// game.js: input, canvas rendering, DOM panels, aria-live, save hooks, pause, feedback, the dog.
// Contract v3.1: docs/superpowers/specs/2026-10-19-pit-sim-v3-1-contract.md (X1, X4 to X10 reads, X12 calls
//           only, X13, X14, X17, with the X18 Overseer's calls); design [S 6], [S 8], [S 12.3]; mocks
//           docs/superpowers/mocks/pit-sim-v3/screen-2-crew (.png and .html), screen-3-week, screen-4-report.
//
// v4.8 (2026-10-23): Hiring Day (#hiring, its rounds, picks and tryouts) is gone. The crew sheet's
//     Help wanted board (#help, cards help-{i} with their line under them) opens #card in board mode
//     (card-hire, card-pass, card-why with the plain refusal). PitSim.game.board counts its open applicants.
//
// v3.1 deviations (PitSim.game is X13.8: every W17.7 member, version '0.6.0', crew; v4.8: board):
// 43. #card and the crew sheet stand in place of the panel that opened them (panels are exclusive, as
//     the sheets were in v3.0); Back or Escape rebuilds that panel and focuses the opener. While #card
//     is open over the crew sheet, the hidden panel is rebuilt after every action, so its ids
//     (#crew-slots) always read the live state.
// 44. A successful hire (card-hire) closes #card: a board or walk-in hire returns to the crew sheet
//     with focus on the new card. Letting a card go returns to the panel under the card sheet.
// 45. Level mode (X13.3): when both skills are at potential the two picks stay enabled under
//     ui.levelBoth, since a level then lifts the mood whatever skill is passed (X5.5); a pick at
//     potential otherwise is disabled with ui.atPotential on the line under it and as its title.
//     When the last banked level is spent the sheet shows the card (crew mode, its week controls
//     hidden outside the week), so the new stars are in view; Back returns to where it opened.
// 46. Stars: the grid cards show only filled stars (full, half) and, once potential is known, hollow
//     stars up to it (a half potential is the hollow frame's left five columns beside an empty
//     right half); the card sheet shows five slots (full, half, hollow, empty). While sprites.js has
//     fewer than four star frames, or no mood or portrait, the mock's maps (screen-2-crew) and the
//     role's in-yard down frame stand in.
// 47. The board, walk-in and crew cards keep their aria-label to X10 (ui.boardAria, ui.appAria); a
//     held card adds its ui.moodAria sentence. The mood face on each card carries data-mood and its
//     own ui.moodAria label.
// 48. (v4.8: Hiring Day's blue framed buttons and sticky footer went with it.)
// 49. The crew sheet lists each card beside a column of its Bring and Train buttons, its XP meter
//     (xp-{id}, ui.xp) and, while it has levels banked, ui.banked (banked-{id}); the walk-ins and the
//     board sit in two columns. Train buttons keep ui.train and are disabled once anyone
//     trained (X13.5); card-train reads ui.trainDone when disabled (X13.3).
// 50. The compact money table: the Fee row's detail is ui.deposit ("Deposit 30"); Signing and send-off
//     also joins the detail table (rep-money-detail, a box of its own under Money and Word of mouth)
//     when crewSpent is above 0, and the stock and Paid at the shop rows count crewSpent, so both
//     tables add up. The Yard day report gets the same Show every row control over its v2.1 rows.
// 51. rep-third sits under rep-host-third in the host box on a booking report, and under the money
//     boxes on a Yard day report. The report crew rows show ui.xp beside the meter.
// 52. The report fit (X13.6): rfit1 to rfit3 apply in order while #till is taller than two screens;
//     the fourth step (word of mouth beside money) is v3.0's container rule from 300 px already.
// 53. Offer tags sit in the band's top left where the SAT and SUN tags were, in the UI font at 2x, green
//     for SAFE BET, orange for STRETCH and gold for INVITE on near black.
// 54. Crew looks: ensureCrewLook(role, look) calls art.setCrewLook only when art.crewKey(role) does not
//     already name that look (remembering what an earlier call returned), so the yard can check every
//     frame without rebuilding sprites; the yard, the hub crew tile and the report hero all call it.
// 55. #third-line (X13.6 "one line") wraps to a second line on a phone: ui.thirdNow runs to 61
//     characters and the hub's 12 px monospace holds about 48 on a 375 phone. It stays 12 px.
// 56. The card sheet's portrait carries the NEW badge and the taken or yours band as the grid card
//     does; the role badge and the mood face sit in card-role and card-mood under it (X13.3). The
//     overall stars also have a .sr text (ui.starsMany or ui.starsOne).
// Carry-forward items (X17) in this file: (2) #third-line under the hub pills, rep-host-third under the
//     host quote and rep-third when a third is crossed; (4) the compact money table with Show every
//     row (rep-money-more over rep-money-detail) and the report shrink steps; (1) the SAFE BET,
//     STRETCH and INVITE tags on the offer cards. Item (3) is sim.js (X5.10).
// Review round 1 (2026-10-19, contract X20.6 and X20.11; each is an Overseer's call):
// 57. (v4.8: Hiring Day's top row, news and pass confirm went with it.)
// 58. Action buttons on the card and crew sheets (and the report's Level up) are pixBtn: uppercase UI
//     font with a shadow, the accessible name in sentence case; Pass is quiet; Bring shows COMING with
//     a check or RESTING (ui.bringOn, ui.bringOff), aria-pressed unchanged; resting cards dim.
// 59. Level mode: ui.levelWhat under each pick, say.levelUp and ui.levelStars in #card-why, and the
//     risen skill row outlined gold (.lvl-new, static).
// 60. The hub: next-crew (ui.crewNext or ui.crewNone) on the Next event card; the crew tile draws up
//     to three portrait busts with mood faces; Pit news adds news-fired-{id} (ui.firedUp).
// 61. The report: wages on their own compact row, Costs without a detail line, one line rows at 14 px
//     in a minmax(0, 1fr) money column; crew rows put name, face and XP meter on one line with a
//     13 character XP label, then the line, the mood words, ui.wageRow and a gold Level up chip; the
//     tutorial till shows tut-floor.
// 62. Grid cards draw the mock's 11 px outlined stars and its 6 by 6 coin; hollowHalf is one glyph.
// 63. Yard numbers: tips and seat tips merge into a fresh one of the same kind within 12 by 8 px, a
//     number whose projected screen box overlaps a live one's moves up a 9 px row until it is clear
//     (v3.5), and tips keep 6 px off the fence.
//
// Contract v3.0: docs/superpowers/specs/2026-10-18-pit-sim-v3-0-contract.md (v3.0: W1, W4 to W7 reads, W14
//           sentences, W15, W16 calls only, W17, W18, with the W22 Overseer's calls), on top of
//           docs/superpowers/specs/2026-10-18-pit-sim-contract.md, v2.1 section K7 sentences, K8, K9 (calls
//           only), K10; v2 delta D11 (calls only), D12, D13, D14.
// Design:   docs/superpowers/specs/2026-10-18-pit-sim-v3-season-design.md [S 2.3], [S 3], [S 4], [S 5.2],
//           [S 8], [S 9], [S 14], [S 19.2], [S 19.3]; mocks docs/superpowers/mocks/pit-sim-v3/screen-1-season,
//           screen-3-week, screen-4-report, screen-6-creator (.png and .html);
//           docs/superpowers/specs/2026-10-18-pit-sim-v2-1-tutorial.md [T 2.6], [T 3.4];
//           docs/superpowers/specs/2026-10-18-pit-sim-design.md, v2 section [V2.9], [V2.12], [V2.13], [V2.16].
//
// v3.0 deviations (PitSim.game is W17.7: every D14 and K10 member, version '0.5.0', rail, sign, panel):
// 25. W22.1: the creator data is state.profile ({ name, look }); state.player stays the v2 mover. Every
//     W17 "player" that means the profile reads state.profile (hostSays {name}, the creator prefill).
// 26. SHELL_IDS gains all fourteen ids of the W18 skeleton (W18 says twelve; the four sections, their
//     four headings, week-top, week-body, week-foot, sheet-body, creator-body and season-end-body).
// 27. Headings and numbers use art.uiText (W16.3) with a .sr twin holding the words. When uiText is not
//     on art (or throws) the same words show as one bold monospace span at the mock size, so an
//     element's textContent is the W15 string either way. Small pictograms with no sprite (the guests
//     and venue pins of the offer cards) are drawn from the mock's maps onto small canvases; the star,
//     check and flame frames fall back to those maps too while sprites.js has no such sprite.
// 28. Every DOM line carries exactly its W15 string as textContent; icons are aria-hidden canvases set
//     before or inside the words (the coin sits between "Pay" and the number, as in the mock).
// 29. A served booked guest pays no plate price, so no "+0" cash number floats up: the tip (when there
//     is one) rises from the cash spot over the customer, with the usual sparkles.
// 30. The tutorial clipboard's DOM is emptied when any other loop screen opens, and the sheet body when
//     the sheet closes, so ids shared by the v2 rows (cart, goal, seats, dec-*, buy-*) are never doubled.
// 31. Offer cards switch to one column, and creator rows put their label above the controls, through
//     CSS container queries on the panel (W17.2 "under 340 px panel width", W17.5 "narrower than 420 px").
// 32. W17.4 and W22.24: the report's title band is #till-h itself on booking and Yard day reports (the
//     sky over lawn band with ev_{type} at 4x behind the UI font title); rep-top is inserted above it.
//     The parts box has no title (W15 pins none). The Yard day report keeps the v2.1 People paragraph
//     below the boxes. rep-top shows on booking and Yard day reports, not on the tutorial till.
// 33. Rain on the news card reads as a Yard day matter (W22.10): "Rain today. A Yard day draws fewer
//     people unless the canopy is up." or "Rain today. The canopy is up for a Yard day."
// 34. The hub tiles carry an aria-label joining their lines with commas; their small windows are sprite
//     canvases (crew: buddy and tender, gear: the next gear piece, menu: the plates, shop: cooler and pile).
// 35. The Shop card's "items" count is the number of cart lines above zero. The Gear card's next item is
//     the first unowned gear row in CATALOG order.
// 36. hire() in loop 'week' has no day gate (W22.12), so the crew sheet ignores needs.day there.
// 37. Fire it up from the pause panel saves the look and names and returns to #pause (the game stays
//     paused); from the loop creator it opens the week hub.
// 38. The creator preview is 4 by 3.5 tiles (64 by 56, playtest round 1 P-15; was 96 by 64 at up to
//     3x): back fence, a lawn row, a paver row and a half, the pitmaster at (8, 28), kettle frame 2 at
//     (40, 28) and three puffs over its vent, drawn at up to 5x (320 by 280 on a 375 phone). The puffs
//     rise every 0.2 s while the creator is open and stand still under reduced motion.
// 39. PitSim.game.panel reads 'howto' while the Controls card covers a panel.
// 40. W22.25 runs as fit levels on #week (fitWeek): after every build with the hub showing, the hub
//     is rebuilt at level 0, then 1 to 4 while #week's scrollHeight is over 2 x innerHeight. Level 1
//     drops the booking cards' art band to 48 px (event icon at 2x), level 2 puts the Yard day on one
//     row (icon, label, its W15 lines as wrapping items, a smaller Book), level 3 puts the event
//     length row and Controls and New game side by side (five 44 px buttons over two columns), and
//     level 4 is the two column meat list, which the Inventory card already uses at every level.
//     Spacing is tight enough that a fresh week 1 at 375 by 812 fits by level 3. The fit reruns only
//     when what sets the hub's height changes (offers, rail meat count, inventory lines, the goal,
//     the next gear, the Load up reason, the viewport), so an ordinary tap rebuilds the hub once.
// 41. The W13.3 save notice on #status stops when the yard opens, so the cook's own status (the gate
//     countdown) is never hidden behind it; it still shows on the screen the save opened on.
// 42. booking_picked arrives as { type: 'booking_picked', id, booking } (integration I-1, contract W23);
//     the sentence reads the picked offer from sim.state.season.booking.
// Playtest round 1 (2026-10-19, contract W24; each an Overseer's call):
// P-10. The booking report: the hero band is about 150 px with the event label in cream over a large
//     gold DONE (the last word of ui.reportH) and a row of v2 guests, the event icon and the buddy on
//     the grass; #till-h's words stay the W15 title. The parts box is titled ui.howWent. Money rows
//     that would read zero or none (wages, seat tips, spoiled, thrown out, left on the grate, burnt)
//     are left out; the detail sits on the label line with a dotted leader. Food cost is foodCost plus
//     raw meat thrown out (sim.js P-3), so the rows add up to Take today; thrown out and left on the
//     grate show as information ("counted in food cost"). Cash names the cash at week start. The
//     result line gives the reason guests missed (ui.missedLine or ui.missedOutLine) and the cold
//     plates (ui.coldLine). The word of mouth box shows the change, the new number and "was N"; the
//     W15 fansLine stays as .sr text.
// P-11. The offer buttons read Pick and Picked (ui.book, ui.booked); the picked one is gold with dark
//     words and the green check badge, and the picked card's frame is gold.
// P-12. Inventory: with no cooler the meter is hidden and ui.invNoCooler always shows (muted while the
//     cooler is empty); the charcoal pile icon draws at 2x.
// P-13. The pit name on the hub and season end signs is bold UI text at 3x, 2x when 3x would not fit.
// P-14. Hub tiles: a chevron after each title; the Gear window shows the cooker owned (the drum, or
//     one or two kettles). The windows stay 38 px tall: at 72 px the fresh week 1 hub ran past two
//     screens at every fit level (1687 of 1624 px), which [S 2.3] and W19 step 45 forbid.
// P-15. The creator preview of deviation 38 at the new size.
// P-16. Shop sheet: a coin before each price, a dark box around each count, and on the charcoal row
//     inc5-charcoal (ui.inc5, aria-label ui.inc5Aria) that adds five bags.
// P-17. #hud-rep reads a heart and the number in every season loop (class fans); the tutorial day keeps
//     the v2.1 stars.
// Playtest round 2 (2026-10-19, contract W25; each an Overseer's call):
// R-1. Gear and decor rows grey Buy and word "Leaves N" from sim.canBuy(id), the sim's own rule (the
//     picked deposit counts toward the cart). The "Leaves N" reserve note is left out while a booking
//     is picked: its cart is already counted and its fee comes after the cook.
// R-2. The board draws up to BOARD_DRAW_MAX (8) plates a stack, so the 14 plate stacks of sim.js R-2
//     never draw into each other; a fifth stack sits in the middle of the board.
// R-3. The Season finale card says what the drum smoker would make of it (ui.finaleDrum) while it is
//     not owned, and Pit news says it from week 5 (ui.finaleNews). Both numbers come from
//     PitSim.genOffers with the drum added, so they are always the generator's own.
// R-4. The booking report puts Gear bought (gearSpent, the items named) and the stock the cook kept or
//     drew on (rowKept or rowDrawn, the rest of cashAfter - cashStart - Take) between Take today and
//     Cash, so week start + Take - gear + stock = Cash on every report. The tutorial and Yard day tills
//     show their food, charcoal, spoiled, thrown out and grate rows as information (no minus: the shop
//     already took them) and add Gear bought and Paid at the shop above Cash.
// R-5. The Yard day and booking reports drop the New game button under Next week (the hub and the pause
//     panel have it); the tutorial till keeps it.
// R-6. From season 2 the hub heading reads ui.weekOfYear and #week-when ui.seasonWhen.
// R-7. The Next event card adds ui.mixHint when the picked rail has a two slot meat and a one slot meat.
// R-8. "Pick one" shows only over two or more cards; the shop line with no cooler is ui.coolerNone.
// R-9. At 1 or 2 stars the hero reads ui.reportHLow in cream with only the event icon on the grass.
// R-10. The Menu tile names the plates (plateLabel); Pit news drops the goal line when the Gear tile
//     already names the same item, and hides when nothing is left in it; tile windows are 54 px.
// R-11. The host quote sits beside a framed guest head with a stepped tail; the report's cooler box
//     takes the ui.inventory legend.
// R-12. Cash in the pills, the report header, the Cash row and the season end card has a thousands
//     comma (fmt).
// R-13. The rail draws a clock before the seconds and each booking count on a cream ticket, so the
//     plates left read differently from the chips' stock.
// R-14. The creator's name fields start empty with the default as the placeholder; Random sits in the
//     scene's corner; under 900 px the preview is sticky at the top of the creator at up to 26 percent
//     of the screen height; the arrow rows keep their label beside the control.
// R-15. A shop section with one item of the same name (Charcoal) drops its heading.
// Playtest round 3 (2026-10-19, contract W26; each an Overseer's call):
// Q-1. #title reads the pit name in upper case once a profile exists ('YOUR PIT' before the creator,
//     and the document title stays Your Pit).
// Q-2. The shop at a booking lists only the rail meats, each with ui.covers ("Covers 6 of 6 plates");
//     the other meats fold under an Other meats button (aria-expanded) that opens them with
//     ui.offMenu, and opens on its own when the cart already holds one. ui.noSpare shows when every
//     rail meat is covered and one of them has no whole spare unit. The charcoal row carries the
//     pile sprite; Back is a 44 px chevron button at the top right of the sheet, beside the title.
// Q-3. The report: the stock row reads ui.rowKept or ui.rowDrawn as an information row (muted, its
//     signed amount kept so the column adds up) with the bags and units in the detail; a missed
//     line without the bigger table adds ui.missedTable; Take today's amount is the UI font at 3x.
// Q-4. Pit news: no Coming next card while the Driveway cannot be bought (sim.js Q-8); the weather
//     line only while the Yard day is picked; from week 5, ui.finaleTable while the bigger table is
//     not owned. The pre-gate status line adds ui.mixShort after the countdown on a booking whose
//     rail mixes a two slot and a one slot meat. The rail draws a +N box under it for booked guests
//     waiting off canvas (sim.gateWaiting()).
// Q-5. The hub: the pip bar is gone (the season strip carries the weeks), the season label never
//     wraps, the pill values are the UI font at 2x and their labels at 2x a word group a line, the
//     cooler meter is a row of cells (one a unit), and offer cards open with a small scene drawn
//     from v2 sprites (fence, guests behind a table with the event icon, a kettle) with a SAT or
//     SUN tag (on the 48 px band of fit level 1 and up, its middle 22 rows); the card lines are 15 px bold.
// Q-6. The creator: on a phone the scene is cropped to the panel width at 4x (3x under 700 px of
//     screen height), 44 px tall, the pitmaster near the middle and the kettle to the right; Random
//     sits at the scene's bottom right with a dice glyph; Fire it up is a sticky footer on phones;
//     the field labels are the UI font (white, gold while the field has focus).
// Q-7. The tutorial morning wears the hub's look (blue stripes, a DAY 1 header in the UI font, the
//     shop rows in an umber card, chunky buttons, Open the yard in the UI font), adds ui.practice,
//     and leaves out the goal line and the Gear, Decor and Hires sections while the tutorial runs
//     (the hub has them from week 1). Its copy and its #open target are unchanged.
// Q-8. #rep-top's week and cash are the UI font at 2x.
//
// v2.1 deviations (PitSim.game is exactly D14 plus the K10 members version '0.4.0' and banner):
// 19. Banner placement. The banner sits at the top left (2, 2) as [T 2.6] says, except that while the
//     tutorial target is a station whose drawn box starts in the top third of the canvas (draw y under
//     VH / 3: the pile, both kettles, the cooler) it moves to the bottom edge, (2, VH - 2 - h), so it
//     never sits over the station, its flames or its chimney (the build brief's rule). A step with no
//     target keeps the last placement, so the cook step does not jump while the ring fills. The box,
//     the colors, the wrap, the text inset (3 px in from the box's top left plus 8 px a line) and the
//     arrow placement of K10 are unchanged. PitSim.game.banner carries no position.
// 20. PitSim.game.banner is a getter worked out from the state each read (the lines and target that
//     render pass 8 draws now), so a read right after an action never sees a stale frame.
// 21. Warning puffs: each chimney puff remembers its cooker, and a puff of a cooker that has a warning
//     piece draws as smoke_dark from the moment the warning starts, not only puffs spawned after it.
//     burn_warning also starts that cooker's next puff at once.
// 22. The Controls card focuses back on the button that opened it (#howto-btn or #pause-controls).
//     #pause-skip, once used, is removed and focus moves to #resume.
// 23. The tutorial step last spoken is forgotten on tutorial_done and on a new game, so a new
//     tutorial speaks its first step again.
// 24. Charcoal: game.js still draws pile frames 0 to 3 by bags and hand_charcoal for carried
//     charcoal, so the new art shows with no game change. There is no charcoal icon (K9), so the
//     charcoal shop row stays without one.
// Review round 2 (contract K14, [T 2.6], [T 4]): a tap on the drawn arrow is a tap on its station
// (arrowBox, onPointer); the arrow hides when its center falls on the player's body, above or below
// the station (replacing round 1's below and in reach rule); facing up, the charcoal draws at
// feet - body height - 9, clear of the hair; the pile shows full from 5 bags, half at 3 or 4; a two
// line banner is 21 tall.
//
// Deviations (v2, kept):
//  1. Cooking arcs are a 12 by 12 one pixel ring around each grate piece, filled clockwise
//     from the top (v1 deviation 3, kept). Orange while cooking, green for the done window,
//     near black when burnt.
//  2. The fire gauge (V2.3, x = first tile px + 18, 3 px wide, sprite top + 4 to its bottom) is
//     an outline colored track with the band color filling its full width from the bottom and a
//     cream pixel at each edge for the 50 and 85 ticks. Since review round 2 it is drawn with its
//     cooker in the y-sorted pass, so a player on a use tile in front of the cooker covers it.
//  3. Cosmetic randomness comes from a local mulberry32 seeded from sim.seed (now the rule, D8).
//  4. The v1 two pixel bounce on a change of hands is gone; the v2 squash on an accepted tap
//     replaces it. The action button still scales down for 0.1 s on a successful press (DOM
//     only, off under reduced motion).
//  5. Ids #howto-btn, #howto-close and #crowd (v1 deviation 6) stay. #seats (D14) is created
//     here inside #clip-top, right under #goal, before #crowd.
//  6. walk_past with reason 'soldout' reads "Someone looked in. Nothing left to sell." and the
//     till's People line adds "Looked in, sold out {n}." when that count is not zero (v1 deviation 7).
//  7. Tap ring (v1 deviation 8): a one pixel 16 by 16 ring, yellow when walkTo took the tap,
//     orange when refused, dropping to its four corners after 0.6 of C.FX.TAP_RING_S; reduced
//     motion keeps the full ring. It is drawn on the tile handed to walkTo, which is the
//     station's first tile when a station's drawn box was hit (D13).
//  8. Patience bar (v1 deviation 9) at the V2.9 position: three colors, and under the warn
//     fraction the order icon blinks at 2 Hz unless reduced motion is on.
//  9. A gear or decor row whose buy would leave less than C.GEAR_RESERVE says so in its effect
//     line before the tap (v1 deviation 10, extended to decor per V2.7).
// 10. Till order (v1 deviation 11) and P resuming from the pause panel (v1 deviation 12) stay.
// 11. YOUR PIT is drawn right after the sign sprite inside the y-sorted pass instead of in
//     pass 8, so a pitmaster standing on row 1 in front of the sign covers the text rather
//     than the text printing over the head. Position MAP.signText, art.text, cream.
// 12. fxLog entries for the continuous emitters are one per stream, not one per sprite: a
//     'puff' when a cooker's chimney stream starts, a 'column' when a burnt piece's smoke
//     column starts, a 'sweat' when a waiting customer starts sweating, a 'zzz' when the
//     buddy's zzz starts, a 'bird' per visit. Sparkles log one entry each (three per serve).
//     This keeps the 500 entry log from filling with puffs between the entries a harness reads.
// 13. A draw whose box crosses a canvas edge is skipped unless it is a person, shadow or hand
//     overlay (the D15 step 33 exception); a draw wholly outside is never issued (D14). The back
//     fence row (y = 0) draws the 16 px fence_back sprite at y = 0, so no fence piece crosses an edge.
// 14. Transient effects (numbers, sparkles, hearts, puffs, rings, marks, sweat, zzz, bird) are
//     cleared when the yard opens, when the next morning starts and on a new game, so the
//     frozen evening yard does not carry into the next morning.
// 15. "Station px, station py" in V2.9 (chimney vents) is read as the top left pixel of the
//     station's first tile, the same origin as slotPx; "sprite top" is the station's draw y.
// 16. index.html: the one rule is @media (max-width: 899px) { #wrap { margin: 0 -8px; width: auto; } }.
//     width: auto is added inside it because the shell's #wrap { width: 100% } would keep the box
//     at the column width and the negative margins would only move it 8 px left, putting the
//     canvas off center; with width auto the stage's flex column stretches it to the column plus 16 px.
// 17. Review round 1 (2026-10-18, now contract D12 and D14):
//     a. Floating numbers are drawn by popText: a 1 px outline box and an umber box behind the
//        glyphs. Cash is yellow, the counter tip white, the seat tip pink.
//     b. The heart sits on the seat's column at (seat x, seat y - 24) and is drawn at 2x (16 by 16);
//        the seat tip number sits left of the seat at (seat x - 30, seat y - 22).
//     c. (v3.6) Unowned gear and decor spots show a "+" mark on the ground; no ghosts
//        under their dashed outline (layer 1, the footprint's sort key); captureFrame marks those
//        records ghost: true. The dashed outline is drawn in the outline color on pavers and cream
//        on the lawn and hedge.
//     d. PATH_TILES, the customer route from the gate to the line, is drawn with the paver sprite.
//        Render only: MAP.tiles and every walk rule are unchanged.
//     e. Chimney puffs are centered on the vent (the 8 px smoke sprite is drawn at vent x - 4) and
//        drift away from the cooler's column only, so kettle 1's stream stays off the cooler.
// 18. Review round 2 (2026-10-18, now contract D12, D13 and D14; replaces 17a to 17c where they differ):
//     a. D13 picks the scale in device pixels: k = floor(target * dpr) backing pixels per virtual
//        pixel (at least 1), CSS scale k / dpr, so every game pixel is exactly k device pixels
//        (412 px at dpr 2.625 gives k 5 and a 335 CSS px canvas). The canvas is nudged with
//        position relative so its top left lands on a whole device pixel. 3x on desktop needs
//        room for #status, #act and #chips too (CONTROLS_H) or it falls back to the 2x rule.
//     b. Floating numbers are outlined text with no box: the string four times in the outline
//        color at 1 px offsets, then in its color. The cash number sits over the served customer
//        (the coin at the customer's px, the text after it, at py - 26; left aligned so a
//        pitmaster on (6,5) stays clear) and the tip number at the customer's px,
//        C.FX.TIP_GAP_PX (-11) above it; the seat tip sits over the heart at (seat x - 4,
//        seat y - 34). Every number is clamped inside the canvas. A number whose box overlaps one
//        that started under 0.5 s ago (within 8 px in y) starts 0.3 s later per such number,
//        at most 3; a heart within 12 px of one that started under 0.5 s ago starts 0.3 s later.
//     c. (v3.6) The "+" marks show in prep and in service
//        0.5. The dashed outlines draw in every phase.
//     d. The unbought Flower bed draws bed frame 3 (tilled soil) on its footprint. Lawn tiles use
//        clover frame 1 inside unowned decor footprints and where (x * 5 + y * 3) % 3 === 0.
//        Hedge tiles alternate frames by x % 2 (frame 1 has blossoms).
//     e. Sparkles are drawn at 2x (14 by 14, centered on the old 7 by 7 spot). Order bubbles,
//        their icon and the walk out mark sit 2 px higher (bubble at px + 14, py - 22) and the
//        patience bar at py - 26, so a bubble no longer touches the next customer's head.
//     f. The dog skips a roam tile whose south neighbor is a taken seat.
//     g. The till's bold row is "Take today" (sales and tips after wages and daily costs); the
//        number is still till.net.
(function () {
'use strict';
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});

const VERSION = '0.6.0';

const FALLBACK_COLOR = {
  K: '#1b1714', U: '#2a2015', C: '#E6D8B8', O: '#D06129', outline: '#3b2417', woodD: '#7a4a26', woodM: '#a8693a',
  woodL: '#d79a5b', paver: '#e8c890', paverD: '#c9a46b', lawnA: '#6cc24a', lawnB: '#4fa83d', leafD: '#2f7a32',
  leafL: '#a6e05a', cloth: '#5bb8f0', clothD: '#3a86c8', white: '#fbf7ef', pink: '#f27aa8', magenta: '#d94a8c',
  yellow: '#ffd84a', skinL: '#f6c49a', skinM: '#d9935f', skinD: '#8f5634', red: '#d8402f', raw: '#f29a9a',
  cooking: '#d0663e', done: '#8e3b1f', steelL: '#9aa4ae', steelD: '#4d5560', smokeL: '#ddd8cf', smokeD: '#6e6863'
};

const SHELL_IDS = [
  'root', 'hdr', 'title', 'hud-day', 'hud-cash', 'hud-rep', 'stage', 'wrap', 'cv', 'status',
  'act', 'chips', 'panels', 'clipboard', 'clipboard-h', 'clip-top', 'shop', 'hire', 'clip-foot',
  'till', 'till-h', 'till-body', 'pause', 'pause-h', 'pause-body', 'howto', 'howto-h', 'howto-body',
  'newgame', 'newgame-h', 'newgame-body', 'broke', 'broke-h', 'broke-body', 'foot', 'live',
  'week', 'week-h', 'week-top', 'week-body', 'week-foot', 'sheet', 'sheet-h', 'sheet-body',
  'creator', 'creator-h', 'creator-body', 'season-end', 'season-end-h', 'season-end-body',
  // v3.1 (X14): the card sheet (v4.8: Hiring Day is gone; the Help wanted board is on the crew sheet).
  'card', 'card-h', 'card-body',
  // v3.2 Days (D8.3): the result card after a quick day.
  'daycard', 'daycard-h', 'daycard-body'
];
const PANEL_IDS = ['clipboard', 'till', 'pause', 'newgame', 'broke', 'week', 'sheet', 'creator', 'season-end', 'card', 'daycard'];
// v3.0: the mock palette (screen-1-season, screen-3-week, screen-4-report, screen-6-creator).
const UI = {
  K: '#1b1714', cream: '#E6D8B8', creamL: '#fff4dc', creamDim: '#b9a888', gold: '#F3CF6D', white: '#ffffff',
  ink: '#13235c', navyD: '#0f2266', blueL: '#a9c2ff', paleBlue: '#dbe6ff', woodX: '#5a3412', signText: '#fff3d6',
  green: '#7ed957', red: '#ff7262', orangeLo: '#5a230a'
};
// W16.4 swatch symbols and the four W16.1 colors, used only when sprites.js has no LOOK or 36 colors yet.
const LOOK_FALLBACK = {
  skin: ['w', 'l', 'm', 'x', 'n', 'z'], hairColor: ['2', '5', 'r', '8', '4', 's'], apron: ['o', '4', 'c', 'f', 'v', 'i']
};
const LEGEND36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const PALETTE_EXT = ['#f7d9c4', '#b87a4b', '#714227', '#5f3a25'];
// Pictograms with no sprite, from the screen mocks (offer card lines), and fallbacks for v3.0 frames.
const PIX = {
  people: { map: ['.ww...ww.', 'wwww.wwww', '.ww...ww.', '.........', 'wwww.wwww', 'wwww.wwww', 'wwww.wwww'], pal: { w: '#9fd0ff' } },
  pin: { map: ['.rrrrr.', 'rrrrrrr', 'rrwwwrr', 'rrwwwrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '..rrr..', '...r...'], pal: { r: '#ef4b3f', w: '#fff4dc' } },
  starOn: { map: ['....k....', '...kyk...', 'kkkyyykkk', 'kyoyyyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', '.kyk.kyk.', '.kk...kk.'], pal: { k: '#1b1714', y: '#F3CF6D', o: '#fff6c9' } },
  starOff: { map: ['....k....', '...kyk...', 'kkkyyykkk', 'kyyyyyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', '.kyk.kyk.', '.kk...kk.'], pal: { k: '#1b1714', y: '#6e6863' } },
  check: { map: ['kkkkkkkk', 'kgggggwk', 'kggggwwk', 'kwgggwgk', 'kwwgwwgk', 'kgwwwggk', 'kggwgggk', 'kkkkkkkk'], pal: { k: '#1b1714', g: '#3fae4a', w: '#ffffff' } },
  flameOn: { map: ['...k....', '..kok...', '..kook..', '.kooyok.', '.koyyok.', 'kooyyok.', 'koyyyyok', 'koyyyyok', '.koyyok.', '..kkkk..'], pal: { k: '#1b1714', o: '#D06129', y: '#ffd84a' } },
  flameOff: { map: ['...k....', '..kvk...', '..kvvk..', '.kvvvvk.', '.kvvvvk.', 'kvvvvvk.', 'kvvuuvvk', 'kvvuuvvk', '.kvvvvk.', '..kkkk..'], pal: { k: '#2a2015', v: '#6e6863', u: '#7a4a26' } },
  arrowL: { map: ['...##', '..###', '.####', '#####', '.####', '..###', '...##'], pal: { '#': '#ffffff' } },
  arrowR: { map: ['##...', '###..', '####.', '#####', '####.', '###..', '##...'], pal: { '#': '#ffffff' } },
  // Q-6: the die on Random (screen-6-creator); Q-4: the waiting guest on the rail.
  arrowD: { map: ['#######', '.#####.', '..###..', '...#...'], pal: { '#': '#ffffff' } },   // Q-2: an open fold
  dice: { map: ['kkkkkkk', 'kwwwwwk', 'kwkwwwk', 'kwwkwwk', 'kwwwkwk', 'kwwwwwk', 'kkkkkkk'], pal: { k: '#1b1714', w: '#ffffff' } },
  // v3.1 (screen-2-crew): the info box glyph, the Crew button's two people, the next arrow.
  info: { map: ['.##.', '.##.', '....', '###.', '.##.', '.##.', '.##.', '####'], pal: { '#': '#ffffff' } },
  crew2: { map: ['..##....##..', '.####..####.', '.####..####.', '..##....##..', '.####..####.', '######.#####', '######.#####'], pal: { '#': '#ffffff' } },
  arrowBig: { map: ['.....#...', '.....##..', '########.', '#########', '########.', '.....##..', '.....#...'], pal: { '#': '#ffffff' } }
};
// v3.1 deviation 46: the half and hollow star frames from the 9 by 9 maps, for a sprites.js without them.
PIX.starHalf = { map: PIX.starOn.map.map(function (r, i) { return r.slice(0, 5) + PIX.starOff.map[i].slice(5).replace(/y/g, 'd'); }),
  pal: { k: '#1b1714', y: '#F3CF6D', o: '#fff6c9', d: '#6e6863' } };
PIX.starHollow = { map: PIX.starOff.map.map(function (r) { return r.replace(/y/g, '.').replace(/k/g, 'g'); }), pal: { g: '#F3CF6D' } };
// The mock's 7 by 7 title stars (screen-2-crew), with a darker foot.
const TITLE_STAR = ['...a...', '..aaa..', 'aaaaaaa', '.aaaaa.', '.aaaaa.', '.bb.bb.', '.b...b.'];
const TITLE_STAR_COLS = [['#E8503A', '#97341f'], ['#FFFFFF', '#a9b4cc'], ['#10215E', '#081236']];
// The mood faces of the mock (screen-2-crew moodFace), frame 2 - mood: Fired up, Happy, OK, Grumpy, Done.
const MOOD_PIX = (function () {
  const base = ['..######..', '.#oooooo#.', '#oooooooo#', '#oooooooo#', '#oooooooo#', '#oooooooo#', '#oooooooo#', '#oooooooo#', '.#oooooo#.', '..######..'];
  const eyes = [[3, 4], [3, 5], [6, 4], [6, 5]];
  const shapes = [
    { fill: '#FFD23F', k: [[2, 6], [7, 6], [3, 7], [4, 7], [5, 7], [6, 7]], w: [[3, 6], [4, 6], [5, 6], [6, 6]] },
    { fill: '#FFD23F', k: [[2, 6], [7, 6], [3, 7], [4, 7], [5, 7], [6, 7]], w: [] },
    { fill: '#FFD23F', k: [[3, 7], [4, 7], [5, 7], [6, 7]], w: [] },
    { fill: '#F6A623', k: [[3, 6], [4, 6], [5, 6], [6, 6], [2, 7], [7, 7]], w: [] },
    { fill: '#EE5A3A', k: [[2, 2], [3, 3], [7, 2], [6, 3], [3, 6], [4, 6], [5, 6], [6, 6], [2, 7], [7, 7]], w: [] }
  ];
  return shapes.map(function (sh) {
    const g = base.map(function (r) { return r.split(''); });
    eyes.concat(sh.k).forEach(function (p) { g[p[1]][p[0]] = 'e'; });
    sh.w.forEach(function (p) { g[p[1]][p[0]] = 'w'; });
    return { map: g.map(function (r) { return r.join(''); }), pal: { '#': '#2A1406', o: sh.fill, e: '#2A1406', w: '#ffffff' } };
  });
})();
const ROLE_FALLBACK = ['run', 'fire', 'prep', 'till', 'pit'];
const ROLE_KIND = { run: 'buddy', fire: 'tender', prep: 'prep', till: 'till', pit: 'pit' };   // the in-yard sprite prefix of each role (X12.2)
const TAG_COLOR = { safe: '#9ff0a8', stretch: '#ffb070', invite: '#F3CF6D' };   // deviation 53
const CR_ROWS = [   // creator option rows in W17.5 order: [look key, id part, kind, label key]
  ['skin', 'skin', 'swatch', 'crSkin'], ['hair', 'hair', 'chooser', 'crHair'],
  ['hairColor', 'haircolor', 'swatch', 'crHairColor'], ['face', 'face', 'chooser', 'crFace'],
  ['hat', 'hat', 'chooser', 'crHat'], ['apron', 'apron', 'swatch', 'crApron']
];
const CR_SCENE_W = 64, CR_SCENE_H = 56;   // P-15: a smaller patch at a bigger scale (5x on a 375 phone)
const BAND_FRAME = { out: 0, low: 1, good: 2, hot: 3 };
const DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', a: 'left', s: 'down', d: 'right'
};
// The yard is drawn angled (tile x runs down and right, tile y down and left), so each key keeps
// its grid direction, the one of the two nearest its screen direction that the pitmaster has always
// had: Up walks up and right, Right down and right, Down down and left, Left up and left. Measured
// on screen by dev/smoke.mjs --desktop (keyboard checks).
const KEY_HELP = [
  ['Arrow keys, W A S D', 'Walk one tile a press, also between days. The yard is angled: Up goes up and right, Right goes down and right, Down goes down and left, Left goes up and left. Hold a key to keep walking.'],
  ['Space, E', 'During service, do what the action button says.'],
  ['1 to 5', 'Pick sausage, chicken, ribs, pork butt or brisket.'],
  ['Q, Shift+Q', 'Next or previous meat.'],
  ['Escape, P', 'Pause and resume.'],
  ['Tap the yard', 'Walk there. Tap a station to walk over and use it.'],
  ['Arrange yard', 'Tap a piece to pick it up. Arrow keys move it, R turns a long piece, Enter or Space sets it down, Escape leaves.']
];
const BOARD_OFFS = [[1, 3], [8, 3], [1, 9], [8, 9], [4, 6]];   // board stacks, from the board's draw px (R-2: a fifth)
const BOARD_DRAW_MAX = 8;                                  // R-2: plates drawn a stack, whatever C.BOARD_STACK holds
const SPARKLE_OFFS = [[-3, -4], [6, -7], [2, 2]];          // from the served plate spot
const BURST_OFFS = [[-3, 0], [0, -2], [3, 0]];             // from the burnt piece
const FX_LOG_MAX = 500;
const LAWN_FROM_ROW = 6;                                   // fence, hedge and bed tiles sit on lawn from this row down
const OVERFLOW_OK = /^(shadow|hand_|player_|buddy_|tender_|prep_|cust[0-9]_)/;
const CONTROLS_H = 24 + 48 + 52 + 8;                       // #status, #act, #chips with its margin, slack (D13 3x test)
const CONTROLS_H_DESK = 40 + 52 + 8;                       // Joel 2026-10-20: desktop sets #status and #act on one slim row
const CASH_ABOVE_PX = 26;                                  // the cash number sits at the served customer's py - 26
const STAGGER_S = 0.3;                                     // a number or heart that would overlap a fresh one waits this long
const STAGGER_WINDOW_S = 0.5;
const STAGGER_MAX = 3;
const PATH_TILES = new Set(['9,10', '9,9', '9,8', '9,7', '8,7', '7,7']);   // customer route, drawn as pavers
const SMOKE_HALF_W = 4;                                    // chimney puffs are centered on the vent
const BANNER_W = 172;                                      // tutorial banner box ([T 2.6])
const BANNER_TEXT_W = 164;                                 // widest line, art.textWidth
const BANNER_MAX_LINES = 2;

// Perimeter of a 12 by 12 ring, clockwise from the top center (44 pixels).

// Page state.
const el = {};
let sim = null;
let C = null, FX = null, MAP = null, MEATS = null, MEAT_IDS = null, CATALOG = null, STRINGS = null, art = null, COLOR = null;
let VW = 176, VH = 192, TILE = 16;
let off = null, octx = null, vctx = null, kpx = 1;
let mqReduced = null, mqDesktop = null;
let reduced = false, saveOff = false, saveOffNoted = false, migrated = false;
let last = null, rafId = 0, tAnim = 0, nowMs = 0, stopped = false;
let currentPanel = null, returnPanel = null;
let howtoOpen = false, howtoFrom = null, howtoClose = null;
const held = new Set();
let crng = null; // cosmetic rng
const SEAT_BY_ID = Object.create(null);
let extTile = null; // the table tile that comes with the Bigger table

// Effects. Every start time is on the effect clock tAnim, which stops while the game is
// paused and while a panel is open (the frozen yard of V2.9).
const nums = [];       // { kind, str, x, y, color, coin, at }   x, y is the text position at rest
const sparkles = [];   // { x, y, at }
const hearts = [];     // { x, y, at }
const puffs = [];      // { x0, y0, vx, rise, life, at, dark, sway, src }   src: the chimney's cooker id
const rings = [];      // { x, y, at, ok }
const markX = new Map();   // customer id -> tAnim when the mark ends
const sweatAt = new Map(); // customer id -> tAnim when the sweat started
const puffT = {}, puffOn = {};
const columnT = new Map(); // cooker:piece -> seconds to the next column puff
let rainDrops = null;
let squashAt = -1;
let zzzSince = null, zzzAt = -1;
let birdNext = 0, birdUntil = -1;
let shakeUntil = 0, blockedUntil = 0, lastCallUntil = 0, saveOffUntil = 0, noticeUntil = 0;
// Walk pasts with reason 'soldout' this day, counted from events (today.past holds both
// reasons). Reset when the yard opens; a reload during the evening shows them as line full.
let pastSoldOut = 0;
const fxLog = [];

// The dog: the live object of D14 holds only its six fields; the walk state lives beside it.
const dog = { x: 4, y: 7, px: 64, py: 112, frame: 2, flip: false };
const dogAI = { path: [], next: null, wait: 0, anim: 0 };

// Draw records for captureFrame (D14).
let capturing = false;
// v3.4: the art3 bridge (art3/bridge.js); the off canvas is the 352 by 384 render px yard, drawn
// with a 2x transform so every sim px position and step in this file scales with it.
let B3 = null;
const RS = 2;
const SIDE_W = 380;               // v3.4 playtest: the side column's width at 900 px and up (index.html)
let recs = [];
const SIZE = Object.create(null);
SIZE.hand_split = [8, 8, 1];   // v4.9: the carried split (art3 carry_split), the hand_charcoal box

// Live region.
const liveQueue = [];
const liveRecent = new Map();
let liveLastAt = -Infinity;

// DOM caches.
const chipEls = {};
const chipSig = {};
const lastHud = { day: '', cash: '', rep: '', pit: '' };
let lastAct = null, lastActDis = null, lastStatus = null, lastPhase = '', lastPaused = null, lastHow = null;
let clip = null;

// Tutorial (v2.1).
let lastSpokenStep = null;      // id of the last tutorial_step whose text went to #live
let bannerBottom = false;       // deviation 19: the banner's placement, kept while a step has no target
let pulsed = [];                // elements carrying tut-pulse right now
let howtoOpener = null;         // id of the button that opened the Controls card
const warnOn = Object.create(null);   // cooker id -> its warning bubble showed at the last observe

// Season screens (v3.0).
let rowSink = [];               // where cartRow, ownRow, goalRow and hireRow put their refreshers
let armedBuy = null;           // feedback audit item 22: the gear or decor row whose Buy waits on Confirm
let sheetKind = null;           // 'shop' | 'gear' | 'menu' | 'crew' while #sheet is open
let sheetOpener = null;         // the hub card that opened the sheet (focus returns there)
let sheetRows = [];
let sheetMsg = '';              // the last refused buy's message, shown in #shop-room
let shopOther = false;          // Q-2: the shop's Other meats rows are open
let crFromPause = false;        // the creator was opened from the pause panel
let crDraft = null;             // the look being edited
let crAnim = 0, crAnimAt = -1;  // creator smoke phase (seconds) and the last redraw
let crOff = null;               // the creator preview's 96 x 64 offscreen canvas
const lastChips = { charcoal: '' };

// Crew cards (v3.1).
let crewPick = false;           // v3.2 (D8.2): the crew sheet opened from #day-train; Train spends the day
let sheetFrom = 'week';         // the panel the sheet returns to: 'week', 'yard' or 'morning' (X13.1)
let crewMsg = '';               // the crew sheet's last refusal or swap note, in #crew-why
let cardCtx = null;             // #card: { mode, key, from, opener, back, msg, sure }
let moneyMore = false;          // the report's rep-money-detail is open
let tillFit = 0;                // the report's shrink level (X13.6, deviation 52)
let noticeKey = 'notice';       // the save notice on #status: 'notice' or 'noticeCrew' (X11.3)
const lookCache = new Map();    // card id -> its look, so a card that moved on still has a face on the report
const nameCache = new Map();    // card id -> its name
const crewLookMemo = {};        // role -> { want, got } of the last setCrewLook (deviation 54)

// ---------------------------------------------------------------- helpers

function mk(tag, opts, children) {
  const e = document.createElement(tag);
  if (opts) {
    if (opts.id) e.id = opts.id;
    if (opts.cls) e.className = opts.cls;
    if (opts.text !== undefined && opts.text !== null) e.textContent = String(opts.text);
    if (opts.type) e.type = opts.type;
    if (opts.attrs) for (const k in opts.attrs) e.setAttribute(k, opts.attrs[k]);
    if (opts.on) e.addEventListener('click', opts.on);
  }
  if (children) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c === null || c === undefined || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return e;
}
function btn(id, text, cls, on) { return mk('button', { id: id, text: text, cls: cls, type: 'button', on: on }); }
function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
function h3(text) { return mk('h3', { text: text }); }
function stars(rep) {
  const n = Math.max(0, Math.min(5, Math.round((rep || 0) / 20)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}
function signed(n) { return n >= 0 ? '+' + n : String(n); }
// R-12: cash with a thousands comma, for the DOM only (sim strings and canvas text stay plain).
function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
// "a", "a and b", "a, b and c" (a generated data list, W22.26 (a)).
function andList(words) {
  if (words.length <= 1) return words.join('');
  return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
}
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
function meatList(counts) {
  const parts = [];
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const id = MEAT_IDS[i];
    const n = counts && counts[id] ? counts[id] : 0;
    if (n > 0) parts.push(n + ' ' + MEATS[id].label);
  }
  return parts.join(', ');
}
function iconCanvas(name) {
  if (!art.has(name)) return null;
  const c = art.canvasFor(name, 0, 2);
  c.setAttribute('aria-hidden', 'true');
  c.style.display = 'inline-block';
  c.style.verticalAlign = 'middle';
  c.style.marginRight = '6px';
  c.style.imageRendering = 'pixelated';
  return c;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function owned(entry) { return PitSim.tileOwned(entry, sim.state.gear, sim.state.decor); }
function custById(id) {
  const list = sim.state.customers;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function byId(a, b) { return a.id - b.id; }
function isChairSeat(seat) { return seat.decor === 'chair1' || seat.decor === 'chair2'; }
function easeOut(t) { const u = 1 - Math.max(0, Math.min(1, t)); return 1 - u * u; }

// ---------------------------------------------------------------- v3.0 helpers

// W15 strings: {token} filled by plain replacement.
function fill(str, map) {
  let s = String(str === undefined || str === null ? '' : str);
  if (map) for (const k in map) s = s.split('{' + k + '}').join(String(map[k]));
  return s;
}
function U(key, map) { return fill(STRINGS.ui && STRINGS.ui[key] !== undefined ? STRINGS.ui[key] : '', map); }
function SAY(key, map) { return fill(STRINGS.say && STRINGS.say[key] !== undefined ? STRINGS.say[key] : '', map); }
function U1(n, oneKey, manyKey, map) { return U(n === 1 ? oneKey : manyKey, Object.assign({ n: n }, map || {})); }
function weekWhen(w) { const l = STRINGS.weekLabel || []; return l[w - 1] || ''; }
function bookingLabel(type) { return STRINGS.booking && STRINGS.booking[type] ? STRINGS.booking[type] : String(type); }
function starsWord(n) { return n <= 0 ? U('noStars') : U1(n, 'starsOne', 'starsMany'); }
function loopOf(s) { return s.loop || 'tutorial'; }
function inSeason(s) { const l = loopOf(s); return l !== 'tutorial'; }
function profileName(s) { return s.profile && s.profile.name ? s.profile.name : (STRINGS.defaultName || 'Pitmaster'); }
function pitName(s) { return s.pitName ? String(s.pitName) : (STRINGS.defaultPit || 'Your Pit'); }
function stockUnits(s) {
  let n = 0;
  for (let i = 0; i < MEAT_IDS.length; i++) n += s.stock[MEAT_IDS[i]] | 0;
  return n;
}
function railList(counts, labelKey) {
  const parts = [];
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const m = MEAT_IDS[i];
    const n = counts && counts[m] ? counts[m] | 0 : 0;
    if (n > 0) parts.push(n + ' ' + MEATS[m][labelKey || 'label']);
  }
  return parts.join(', ');
}
function sumCounts(counts) {
  let n = 0;
  if (counts) for (let i = 0; i < MEAT_IDS.length; i++) n += counts[MEAT_IDS[i]] | 0;
  return n;
}
// The W7.1 times of the event in progress (v2 constants on a today without them).
function tGate(s) { return s.today && typeof s.today.gateAt === 'number' ? s.today.gateAt : C.GATE_OPENS; }
function tLast(s) { return s.today && typeof s.today.lastCallAt === 'number' ? s.today.lastCallAt : C.LAST_CALL; }
function tEnd(s) { return s.today && typeof s.today.endAt === 'number' ? s.today.endAt : C.DAY_SECONDS; }
// v3.8: the clock box text, OVERTIME once the hard end passes with paid guests still waiting.
function clockStr(s) { return s.today && s.today.overtime && !s.today.comp ? 'OVERTIME' : String(Math.max(0, Math.ceil(tEnd(s) - s.clock))); }
function todayKind(s) { return s.today && s.today.kind ? s.today.kind : 'tutorial'; }
function dpr() { return window.devicePixelRatio || 1; }

// A canvas painted from a character map (the mock pictograms), aria-hidden.
function pixCanvas(map, pal, scale) {
  const k = Math.max(1, scale | 0);
  const w = map.reduce(function (m, r) { return Math.max(m, r.length); }, 0), h = map.length;
  const c = document.createElement('canvas');
  c.width = w * k; c.height = h * k;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const col = pal[map[y][x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * k, y * k, k, k);
    }
  }
  c.setAttribute('aria-hidden', 'true');
  c.className = 'px';
  return c;
}
// A sprite frame as an aria-hidden canvas at an integer scale, or the fallback map, or null.
function sprEl(name, frame, scale, fb) {
  let c = null;
  if (art.has(name)) {
    try { c = art.canvasFor(name, Math.max(0, Math.min(art.frames(name) - 1, frame | 0)), scale); } catch (e) { c = null; }
  }
  if (!c && fb) return pixCanvas(fb.map, fb.pal, scale);
  if (!c) return null;
  c.setAttribute('aria-hidden', 'true');
  c.className = 'px';
  return c;
}
// Review 1: the mock's 6 by 6 coin for the grid cards (palette colors: outline, yellow, white, woodL).
const COIN6 = { map: ['.oooo.', 'oyhyyo', 'ohyyyo', 'oyyyso', 'oyyyso', '.oooo.'], pal: { o: '#3b2417', y: '#ffd84a', h: '#fbf7ef', s: '#d79a5b' } };
function starEl(on, scale) { return sprEl('star', on ? 0 : 1, scale || 1, on ? PIX.starOn : PIX.starOff); }
function flameEl(on, scale) { return sprEl('flame', on ? 0 : 1, scale || 1, on ? PIX.flameOn : PIX.flameOff); }
function checkEl(scale) { return sprEl('check', 0, scale || 1, PIX.check); }
function coinEl(scale) { return sprEl('coin', 0, scale || 1, null); }

// The mock UI font (art.uiText) as an aria-hidden canvas, or null when sprites.js has none.
function uiCanvas(str, scale, color, opts) {
  if (!art || typeof art.uiText !== 'function') return null;
  try {
    const o = { scale: scale, dpr: dpr(), color: color };
    if (opts && opts.shadow) o.shadow = opts.shadow;
    if (opts && opts.bold) o.bold = true;
    const c = art.uiText(String(str), o);
    if (!c) return null;
    c.setAttribute('aria-hidden', 'true');
    c.classList.add('ut');
    return c;
  } catch (e) { return null; }
}
// Puts words in the UI font into parent: the canvas plus a .sr span holding srText (default str),
// or, without uiText, one bold span whose text is srText (deviation 27). Returns parent.
function uiPut(parent, str, scale, color, opts, srText) {
  const words = srText === undefined ? String(str) : String(srText);
  const c = uiCanvas(str, scale, color, opts);
  if (c) {
    parent.appendChild(c);
    parent.appendChild(mk('span', { cls: 'sr', text: words }));
  } else {
    const sp = mk('span', { cls: 'utf', text: words });
    sp.style.fontSize = Math.max(11, Math.round(scale * 7)) + 'px';
    sp.style.color = color;
    if (String(str) !== words && String(str) === String(str).toUpperCase()) sp.style.textTransform = 'uppercase';
    if (opts && opts.shadow) sp.style.textShadow = '0 ' + Math.max(1, scale) + 'px 0 ' + opts.shadow;
    parent.appendChild(sp);
  }
  return parent;
}
// A palette character's color (W16.1 legend, 36 entries; the four new ones from W16.1 when absent).
function paletteColor(ch) {
  const i = LEGEND36.indexOf(ch);
  if (i <= 0) return 'transparent';
  const pal = art.PALETTE || [];
  if (pal[i]) return pal[i];
  if (i >= 32 && i < 36) return PALETTE_EXT[i - 32];
  return 'transparent';
}
// The swatch color of look option idx for skin, hairColor or apron.
function swatchColor(key, idx) {
  const sym = key === 'skin' ? 'S' : key === 'hairColor' ? 'H' : 'A';
  const L = art.LOOK && art.LOOK[key] && art.LOOK[key][idx];
  const ch = L && typeof L[sym] === 'string' ? L[sym] : LOOK_FALLBACK[key][idx];
  return paletteColor(ch);
}
function lookCounts() { return PitSim.LOOK_COUNTS || { skin: 6, hair: 6, hairColor: 6, face: 4, hat: 4, apron: 6 }; }
function copyLook(l) {
  const out = {};
  const keys = PitSim.LOOK_KEYS || ['skin', 'hair', 'hairColor', 'face', 'hat', 'apron'];
  const d = PitSim.DEFAULT_LOOK || { skin: 1, hair: 0, hairColor: 1, face: 0, hat: 1, apron: 0 };
  for (let i = 0; i < keys.length; i++) out[keys[i]] = l && Number.isInteger(l[keys[i]]) ? l[keys[i]] : d[keys[i]];
  return out;
}
function applyLook(look) {
  if (art && typeof art.setLook === 'function') { try { art.setLook(look); } catch (e) { console.error(e); } }
  if (B3) B3.setPlayer(copyLook(look));
}
function lookLabel(key, idx) { const l = STRINGS.look && STRINGS.look[key]; return l && l[idx] !== undefined ? l[idx] : String(idx); }
function rowWord(labelKey) { return U(labelKey).toLowerCase(); }

// ---------------------------------------------------------------- v3.1 crew helpers

// An array valued ui string (thirdNow, thirdUp) at index i, filled.
function UA(key, i, map) {
  const a = STRINGS.ui ? STRINGS.ui[key] : null;
  return fill(Array.isArray(a) && a[i] !== undefined ? a[i] : '', map);
}
function roleIds() { return Array.isArray(PitSim.ROLE_IDS) ? PitSim.ROLE_IDS : ROLE_FALLBACK; }
function roleOf(r) { return roleIds().indexOf(r) >= 0 ? r : 'run'; }
function roleWord(r) { return STRINGS.role && STRINGS.role[r] ? STRINGS.role[r] : String(r).toUpperCase(); }
function roleName(r) { return STRINGS.roleName && STRINGS.roleName[r] ? STRINGS.roleName[r] : String(r); }
function roleJob(r) { return STRINGS.roleJob && STRINGS.roleJob[r] ? STRINGS.roleJob[r] : ''; }
function skillName(r, i) { const k = STRINGS.skill && STRINGS.skill[r]; return k && k[i] !== undefined ? k[i] : ''; }
function skillHelp(r, i) { const k = STRINGS.skillHelp && STRINGS.skillHelp[r]; return k && k[i] !== undefined ? k[i] : ''; }
function clampMood(m) { return Math.max(-2, Math.min(2, Math.round(Number(m) || 0))); }
function moodWord(m) { const l = STRINGS.mood || []; return l[clampMood(m) + 2] || ''; }
// Stars as text: 2.5, 3 (half steps).
function half(n) { return String(Math.round((Number(n) || 0) * 2) / 2); }
function starsText(n) { const v = Math.round((Number(n) || 0) * 2) / 2; return U1(v, 'starsOne', 'starsMany', { n: half(v) }); }
function cardStarsOf(skills) {
  if (typeof PitSim.cardStars === 'function') return PitSim.cardStars(skills);
  const a = skills && Number(skills[0]) || 1, b = skills && Number(skills[1]) || 1;
  return Math.floor(((a + b) / 2) * 2) / 2;
}
function wageOf(stars, role) {
  if (typeof PitSim.wageFor === 'function') return PitSim.wageFor(stars, role);
  const t = C.WAGE_TABLE || [10, 13, 16, 20, 24, 29, 34, 40, 46], f = C.ROLE_WAGE || { run: 1, fire: 1.25, prep: 1 };
  return Math.round(t[Math.max(0, Math.min(8, Math.round((stars - 1) * 2)))] * (f[role] || 1));
}
// The cards you hold (state.crew), noting each look and name for the report (deviation 47).
function crewList() {
  const list = sim && Array.isArray(sim.state.crew) ? sim.state.crew : [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].look) lookCache.set(list[i].id, list[i].look);
    if (list[i] && list[i].name) nameCache.set(list[i].id, list[i].name);
  }
  return list;
}
function crewCard(id) {
  const list = crewList();
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
// sim.crewView (X7) as fresh card views in id order, or the raw cards with their stars.
function crewViews() {
  crewList();
  let v = null;
  if (typeof sim.crewView === 'function') { try { v = sim.crewView(); } catch (e) { v = null; } }
  if (!Array.isArray(v)) v = crewList().map(function (c) { return Object.assign({}, c, { stars: cardStarsOf(c.skills) }); });
  return v.slice().sort(byId);
}
function crewViewOf(id) {
  if (typeof sim.crewView === 'function') { try { return sim.crewView(id) || null; } catch (e) { return null; } }
  const c = crewCard(id);
  return c ? Object.assign({}, c, { stars: cardStarsOf(c.skills) }) : null;
}
function payrollNow() {
  if (typeof sim.payroll === 'function') { try { const p = sim.payroll(); if (p) return p; } catch (e) { /* fall through */ } }
  let now = 0;
  const list = crewList();
  for (let i = 0; i < list.length; i++) if (list[i].bring) now += list[i].wage | 0;
  return { now: now, budget: C.PAYROLL ? C.PAYROLL[0] : 60, slots: C.ROSTER_SLOTS ? C.ROSTER_SLOTS[0] : 2, count: list.length };
}
// v4.8: the Help wanted board (sim.boardView), or null outside the week.
function boardData() {
  if (typeof sim.boardView !== 'function') return null;
  try { return sim.boardView() || null; } catch (e) { return null; }
}
// X7: "crew loops" (the week's mornings; v4.8: no Hiring Day) and "week only".
function crewLoops() { const s = sim.state; return loopOf(s) === 'week' && s.phase === 'morning'; }
function weekOnly() { const s = sim.state; return loopOf(s) === 'week' && s.phase === 'morning'; }
function trainedId() { const se = sim.state.season; return se && se.trained !== undefined && se.trained !== null ? se.trained : null; }
// The look key art.crewKey reports: 'skin-hair-hairColor-face-hat-apron'.
function lookKeyOf(look) {
  const keys = PitSim.LOOK_KEYS || ['skin', 'hair', 'hairColor', 'face', 'hat', 'apron'];
  const l = copyLook(look);
  return keys.map(function (k) { return l[k]; }).join('-');
}
// Deviation 54: dresses the role's in-yard sprites in this look unless they already wear it.
function ensureCrewLook(role, look) {
  if (B3 && look) B3.setCrew(role, copyLook(look));
  // v3.6: the TILL card is art3 only (sprites.js keeps three roles).
  if (role === 'till' || role === 'pit') return look ? role + ':' + lookKeyOf(look) : '';   // v4.3: the PIT card is art3 only too
  if (!art || typeof art.setCrewLook !== 'function' || !look) return '';
  const want = role + ':' + lookKeyOf(look);
  let have = '';
  try { have = typeof art.crewKey === 'function' ? art.crewKey(role) : ''; } catch (e) { have = ''; }
  const m = crewLookMemo[role];
  if (have === want || (m && m.want === want && m.got === have && have !== '')) return have;
  let got = '';
  try { got = art.setCrewLook(role, copyLook(look)); } catch (e) { console.error(e); }
  try { if (typeof art.crewKey === 'function') got = art.crewKey(role); } catch (e) { /* keep the return */ }
  crewLookMemo[role] = { want: want, got: String(got || '') };
  return got;
}
// The sprite prefix for a role: prep_ once sprites.js has it, else the buddy's.
function roleSprite(role) {
  const k = ROLE_KIND[role] || 'buddy';
  return art.has(k + '_down') ? k : 'buddy';
}
// The card a mover works for (state.buddy, state.tender, state.prep carry cardId).
function moverCard(m) { return m && m.cardId !== undefined && m.cardId !== null ? crewCard(m.cardId) : null; }
// X13.7: at yard_open each lineup card's look goes on its role's in-yard sprites.
function dressCrew() {
  const s = sim.state;
  const movers = [['run', s.buddy], ['fire', s.tender], ['prep', s.prep || null], ['till', s.cashier || null], ['pit', s.pitCard || null]];
  for (let i = 0; i < movers.length; i++) {
    const card = moverCard(movers[i][1]);
    if (card && card.look) ensureCrewLook(movers[i][0], card.look);
  }
}

// One star at scale: 'full' | 'half' | 'empty' | 'hollow' | 'hollowHalf' (deviation 46).
function starKind(kind, scale) {
  const k = Math.max(1, scale | 0);
  if (kind === 'full' || kind === 'empty') return starEl(kind === 'full', k);
  const many = art.has('star') && art.frames('star') >= 4;
  if (kind === 'half') return many ? sprEl('star', 2, k, null) : pixCanvas(PIX.starHalf.map, PIX.starHalf.pal, k);
  if (kind === 'hollow') return many ? sprEl('star', 3, k, null) : pixCanvas(PIX.starHollow.map, PIX.starHollow.pal, k);
  // hollowHalf (review 1): one clean glyph, the whole empty star with the hollow frame's yellow
  // outline over its left five columns, so the body reads as one star and the left edge as gold.
  const l = many ? sprEl('star', 3, k, null) : pixCanvas(PIX.starHollow.map, PIX.starHollow.pal, k);
  const r = starEl(false, k);
  if (!l || !r) return l || r;
  const c = document.createElement('canvas');
  c.width = r.width; c.height = r.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const cut = Math.round(5 * r.width / 9);
  g.drawImage(r, 0, 0);
  g.drawImage(l, 0, 0, Math.round(5 * l.width / 9), l.height, 0, 0, cut, r.height);
  if (r.style && r.style.width) { c.style.width = r.style.width; c.style.height = r.style.height; }
  c.setAttribute('aria-hidden', 'true');
  c.className = 'px';
  return c;
}
// Five star slots: filled by value (full, half), then hollow up to a known potential, then empty
// when empties is set (the card sheet), else nothing (the grid cards, as the mock).
function starRow(value, potential, scale, empties) {
  const row = mk('span', { cls: 'srow', attrs: { 'aria-hidden': 'true' } });
  const v = Math.round((Number(value) || 0) * 2) / 2;
  const p = typeof potential === 'number' ? Math.round(potential * 2) / 2 : null;
  for (let i = 0; i < 5; i++) {
    let k = null;
    if (v - i >= 1) k = 'full';
    else if (v - i >= 0.5) k = 'half';
    else if (p !== null && p - i >= 1) k = 'hollow';
    else if (p !== null && p - i >= 0.5) k = 'hollowHalf';
    else if (empties) k = 'empty';
    if (!k) continue;
    const c = starKind(k, scale);
    if (c) { c.setAttribute('data-star', k); row.appendChild(c); }
  }
  return row;
}
function moodEl(mood, scale) {
  const f = 2 - clampMood(mood);
  return sprEl('mood', f, scale, MOOD_PIX[f]);
}
// The portrait bust (X12.2 art.portrait), or the role's in-yard down frame before sprites.js has it.
function portraitEl(look, role, scale) {
  let c = null;
  if (B3) {
    try { c = bustEl(B3.portrait(copyLook(look), 'crew', role), scale); } catch (e) { console.error(e); c = null; }
  }
  if (!c && art && typeof art.portrait === 'function') {
    try { c = art.portrait(copyLook(look), role, { scale: scale, dpr: dpr() }); } catch (e) { c = null; }
  }
  if (!c) {
    if (look) ensureCrewLook(role, look);
    c = sprEl(roleSprite(role) + '_down', 0, scale, null);
  }
  if (c) { c.setAttribute('aria-hidden', 'true'); c.classList.add('bust'); }
  return c;
}
// v3.4: an art3 bust (32 render px) as a crisp canvas at the v2 portrait's CSS size (16 px x scale).
function bustEl(src, scale) {
  if (!src) return null;
  const d = dpr(), css = Math.max(1, 16 * (scale || 2));
  const k = Math.max(1, Math.round(css * d / src.width));
  const c = document.createElement('canvas');
  c.width = src.width * k; c.height = src.height * k;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  c.style.width = (c.width / d) + 'px'; c.style.height = (c.height / d) + 'px';
  c.style.imageRendering = 'pixelated';
  return c;
}

// The role badge: white UI letters on an ink box (X13.4).
function roleBadge(role, cls) {
  const b = mk('span', { cls: 'rbadge' + (cls ? ' ' + cls : '') });
  uiPut(b, roleWord(role), 2, '#ffffff', null, roleWord(role));
  return b;
}
function miniStar(i) {
  const c = TITLE_STAR_COLS[i];
  return pixCanvas(TITLE_STAR, { a: c[0], b: c[1] }, 2);
}
// A 10 segment meter (XP), role meter with the given label; with words, the label shows beside it.
function segMeter(id, value, max, label, cls, words) {
  const m = mk('div', { id: id, cls: 'xpbar' + (cls ? ' ' + cls : ''), attrs: { role: 'meter', 'aria-valuenow': String(value | 0), 'aria-valuemin': '0', 'aria-valuemax': String(max | 0), 'aria-label': label } });
  const bar = mk('span', { cls: 'segs xp', attrs: { 'aria-hidden': 'true' } });
  const on = max > 0 ? Math.floor(10 * Math.max(0, Math.min(1, value / max))) : 0;
  for (let k = 0; k < 10; k++) bar.appendChild(mk('span', { cls: 'seg' + (k < on ? ' on' : '') }));
  m.appendChild(bar);
  if (words) m.appendChild(mk('span', { cls: 'xpt', attrs: { 'aria-hidden': 'true' }, text: label }));
  return m;
}
// Focuses the element with this id when it is usable, else the fallback element.
function focusOr(id, fallback) {
  const f = id ? document.getElementById(id) : null;
  if (f && !f.disabled && !f.hidden && typeof f.focus === 'function') { f.focus(); return; }
  if (fallback && typeof fallback.focus === 'function') fallback.focus();
}

// ---------------------------------------------------------------- tutorial helpers (v2.1)

function tutRunning() {
  const t = sim ? sim.state.tutorial : null;
  return !!(t && t.done === false);
}
function tutStep() {
  if (!sim || typeof sim.tutorialStep !== 'function') return null;
  return sim.tutorialStep() || null;
}
// The owned station a tutorial target names, or null (a DOM id or no target).
function targetStation(target) {
  if (typeof target !== 'string' || !target) return null;
  const st = MAP.station(target);
  return st && st.draw && owned(st) ? st : null;
}
// Greedy wrap on spaces, each line at most BANNER_TEXT_W wide in the pixel font ([T 2.6]).
function wrapBanner(text) {
  const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? cur + ' ' + words[i] : words[i];
    if (!cur || art.textWidth(next) <= BANNER_TEXT_W) cur = next;
    else { lines.push(cur); cur = words[i]; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, BANNER_MAX_LINES);
}
// The banner as render pass 8 draws it now: service only, while the tutorial runs.
function bannerNow() {
  if (!sim || sim.state.phase !== 'service') return null;
  const t = tutStep();
  if (!t) return null;
  return { lines: wrapBanner(t.text), target: t.target === undefined ? null : t.target };
}
function cookerWarns(ck) {
  if (!ck || !ck.pieces) return false;
  for (let i = 0; i < ck.pieces.length; i++) {
    const p = ck.pieces[i];
    if (p.state === 'done' && p.warn === true) return true;
  }
  return false;
}
// Left of the chimney vent (round 1), so the dark warning puffs rise clear of the bubble.
function warnBubblePos(st) { const d = drawOf(st); return { x: d.x - 2, y: d.y - 11 }; }

// tut-pulse on the DOM target, and on #act when the target station is in reach and usable ([T 2.6]).
function syncPulse(verb) {
  const want = [];
  const t = tutStep();
  if (t && t.target) {
    const st = targetStation(t.target);
    if (st) {
      if (sim.state.phase === 'service' && sim.reach() === t.target) {
        const v = verb || sim.verbAt();
        if (v && v.enabled) want.push(el.act);
      }
    } else if (!MAP.station(t.target)) {
      const e = document.getElementById(t.target);
      if (e) want.push(e);
    }
  }
  for (let i = 0; i < pulsed.length; i++) if (want.indexOf(pulsed[i]) === -1) pulsed[i].classList.remove('tut-pulse');
  for (let i = 0; i < want.length; i++) if (!want[i].classList.contains('tut-pulse')) want[i].classList.add('tut-pulse');
  pulsed = want;
}

// ---------------------------------------------------------------- boot

function boot() {
  for (let i = 0; i < SHELL_IDS.length; i++) {
    const e = document.getElementById(SHELL_IDS[i]);
    if (e) el[SHELL_IDS[i]] = e;
  }
  const missing = SHELL_IDS.filter(function (id) { return !el[id]; });
  if (missing.length) {
    console.error('pit-sim: the shell is missing #' + missing.join(', #'));
    if (el.status) el.status.textContent = 'The page shell is missing ' + missing[0] + '.';
    return;
  }
  nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  if (!PitSim.art || typeof PitSim.art.build !== 'function' || typeof PitSim.createSim !== 'function') {
    el.status.textContent = 'Game files did not load.';
    console.error('pit-sim: sprites.js or sim.js did not attach to PitSim');
    return;
  }
  art = PitSim.art;
  B3 = PitSim.bridge3 && PitSim.bridge3.boot() ? PitSim.bridge3 : null;
  if (B3 && B3.setIso) B3.setIso(true);
  try {
    art.build();
  } catch (e) {
    el.status.textContent = String((e && e.message) || e);
    console.error(e);
    return;
  }
  C = PitSim.C; FX = C.FX; MAP = PitSim.MAP; MEATS = PitSim.MEATS; MEAT_IDS = PitSim.MEAT_IDS;
  CATALOG = PitSim.CATALOG; STRINGS = PitSim.STRINGS;
  COLOR = Object.assign({}, FALLBACK_COLOR, art.COLOR || {});
  TILE = MAP.TILE || 16;
  VW = MAP.W * TILE; VH = MAP.H * TILE;
  for (let i = 0; i < MAP.seats.length; i++) SEAT_BY_ID[MAP.seats[i].id] = MAP.seats[i];
  const table = MAP.station('table');
  extTile = null;
  for (let i = 0; i < table.tiles.length; i++) if (table.tiles[i].gear === 'bigtable') extTile = table.tiles[i];

  const saved = readSave();
  const seed = readSeed();
  sim = PitSim.createSim(saved, seed);
  crng = mulberry32((sim.seed >>> 0) ^ 0x9E3779B9);
  birdNext = birdGap();
  dogReset(2);
  applyLook(lookNow());

  setupMedia();
  buildStatic();
  setupCanvas();
  setupInput();
  buildArrangeBar();
  testerSetup();   // v4.7: only with window.PitSimTester
  showLoop();
  pump();
  if (saveOff) noteSaveOff();
  if (migrated) {
    noticeUntil = nowMs + FX.NOTICE_S * 1000;
    announce(U(noticeKey));
    writeSave();
  }
  exposeGame();
  setupMusic();
  observe();
  rafId = requestAnimationFrame(frame);
}

// Background music (music.js): the mute button in the header, the saved flag, and what to play.
let musicOn = false;   // Joel 2026-10-19: music starts off until the real tracks are in
function musicApi() { return PitSim.music && typeof PitSim.music.update === 'function' ? PitSim.music : null; }
function syncMuteBtn() {
  const b = document.getElementById('mute');
  if (!b) return;
  b.setAttribute('aria-pressed', musicOn ? 'false' : 'true');
  b.setAttribute('aria-label', musicOn ? 'Sound on' : 'Sound off');
}
function setupMusic() {
  const M = musicApi();
  try { if (M) M.init({ muted: !musicOn }); } catch (e) { /* music is optional */ }
  syncMuteBtn();
  const b = document.getElementById('mute');
  if (b) b.addEventListener('click', function () {
    musicOn = !musicOn;
    try { if (M) M.setMuted(!musicOn); } catch (e) { /* ignore */ }
    syncMuteBtn();
    if (!musicOn) sfxStopLoops();
    writeSave();
  });
}
let musicSig = '';
function syncMusic(s) {
  const M = musicApi();
  if (!M) return;
  const se = inSeason(s) ? s.season : null;
  const week = se ? se.week | 0 : 1;
  const comp = !!se && week >= (C.SEASON_WEEKS || 7);
  const cook = s.phase === 'service';
  let waiting = 0;
  if (cook && Array.isArray(s.customers)) for (const c of s.customers) if (c.mode === 'waiting' || c.mode === 'arriving') waiting++;
  const day = se ? se.day | 0 : 0;
  const sig = day + ':' + week + ':' + comp + ':' + cook + ':' + waiting;
  if (sig === musicSig) return;
  musicSig = sig;
  try { M.update({ day, week, comp, cook, waiting }); } catch (e) { /* ignore */ }
}

// v4.2 pit sounds (music.js PitSim.sfx). The one speaker button runs music and sounds together: off
// by default, the first real click turns both on. Sounds play only in a live cook (service, not
// paused, no panel up). The fire loop follows the hottest lit cooker (silent when every one is cold,
// wood cookers share it), the crowd loop the guests in the yard. One shots come from what changed
// since the last frame: a new piece on a grate (sizzle), a piece off a grate (pull), a slice starting
// (knife); the register's ding and the burn warning ride their sim events. The buffers live in
// music.js and are built once per context, so nothing is decoded per sound.
const SFX_LOOP_STEP = 0.05;   // loop levels move in steps, so a level change is a rare call
let sfxLoopSig = '';
let sfxSeen = null;           // { pieces: Set of piece ids on grates, slicing: bool } from the last frame
function sfxApi() { return PitSim.sfx && typeof PitSim.sfx.play === 'function' ? PitSim.sfx : null; }
function sfxLive(s) {
  return musicOn && s.phase === 'service' && !s.paused && currentPanel === null && !(typeof document !== 'undefined' && document.hidden);
}
function sfxOne(name) {
  const X = sfxApi();
  if (!X || !sfxLive(sim.state)) return;
  try { X.play(name); } catch (e) { /* sound is optional */ }
}
function sfxStopLoops() {
  const X = sfxApi();
  if (sfxLoopSig === 'off') return;
  sfxLoopSig = 'off';
  try { if (X) X.stopAll(); } catch (e) { /* ignore */ }
}
function syncSfx(s) {
  const X = sfxApi();
  if (!X) return;
  const live = sfxLive(s);
  // What is on the grates and the board now, kept every frame so a sound never fires for old news.
  const pieces = new Set();
  let added = false, removed = false;
  if (s.phase === 'service') {
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (st.type !== 'cooker' || !s.stations[st.id]) continue;
      const pcs = s.stations[st.id].pieces || [];
      for (let j = 0; j < pcs.length; j++) pieces.add(pcs[j].id);
    }
  }
  const slicing = s.phase === 'service' && !!(s.stations.board && s.stations.board.slicing);
  if (sfxSeen && s.phase === 'service') {
    pieces.forEach(function (id) { if (!sfxSeen.pieces.has(id)) added = true; });
    sfxSeen.pieces.forEach(function (id) { if (!pieces.has(id)) removed = true; });
  }
  const sliceStart = !!sfxSeen && slicing && !sfxSeen.slicing;
  sfxSeen = { pieces: pieces, slicing: slicing };
  if (!live) { sfxStopLoops(); return; }
  try {
    if (added) X.play('sizzle');
    if (removed) X.play('pull');
    if (sliceStart) X.play('knife');
  } catch (e) { /* sound is optional */ }
  let hot = 0;
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (st.type !== 'cooker' || !owned(st) || !s.stations[st.id]) continue;
    const f = Number(s.stations[st.id].fire) || 0;
    if (f >= C.COLD_UNDER && f > hot) hot = f;
  }
  const near = hot > 0 ? Math.round(Math.min(1, 0.35 + 0.65 * hot / (C.FIRE_MAX || 100)) / SFX_LOOP_STEP) * SFX_LOOP_STEP : 0;
  let guests = 0;
  for (let i = 0; i < s.customers.length; i++) if (s.customers[i].mode !== 'passing') guests++;
  const sig = near.toFixed(2) + ':' + guests;
  if (sig === sfxLoopSig) return;
  sfxLoopSig = sig;
  try {
    X.play('fire', { near: near });
    X.play('crowd', { waiting: guests });
  } catch (e) { /* ignore */ }
}

function readSave() {
  migrated = false;
  let raw = null;
  try { raw = localStorage.getItem(PitSim.SAVE_KEY); } catch (e) { saveOff = true; return null; }
  if (!raw) return null;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { return null; }
  // Music: one boolean in the save, on unless it is exactly false.
  musicOn = !!(parsed && typeof parsed === 'object' && parsed.music === true);
  // W13.3, X11.3: any valid save with a raw v from 1 to one under C.SAVE_VERSION shows the notice once
  // (ui.noticeCrew when the migrated crew is not empty, else ui.notice); a current save loads silently.
  const cur = typeof C.SAVE_VERSION === 'number' ? C.SAVE_VERSION : 5;
  const old = !!(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Number.isInteger(parsed.v) && parsed.v >= 1 && parsed.v < cur);
  let valid = null;
  try { valid = PitSim.validateSave(parsed); } catch (e) { valid = null; }
  migrated = old && valid !== null;
  // D9: a raw v of 5 (v3.1) shows ui.notice once, whatever the crew holds.
  noticeKey = migrated && parsed.v < 5 && valid && Array.isArray(valid.crew) && valid.crew.length > 0 && STRINGS.ui.noticeCrew ? 'noticeCrew' : 'notice';
  return valid;
}

function lookNow() {
  try { return typeof sim.look === 'function' ? sim.look() : copyLook(null); } catch (e) { return copyLook(null); }
}

function readSeed() {
  try {
    const q = new URLSearchParams(location.search).get('seed');
    if (q === null || q === '') return undefined;
    const n = Number(q);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  } catch (e) { return undefined; }
}

function exposeGame() {
  PitSim.game = {
    // v3.9: arrange mode state for the harness (read only).
    arrange: function () { return arr ? { draft: JSON.parse(JSON.stringify(arr.draft)), lift: arr.lift, turn: arr.turn === true, aim: arr.aim ? { x: arr.aim.x, y: arr.aim.y, ok: arr.aim.ok, reason: arr.aim.reason, tiles: arr.aim.tiles } : null, msg: (document.getElementById('arr-msg') || {}).textContent || '' } : null; },
    // v3.6: the client x, y a tap on tile (tx, ty) acts on, after panning it into view (spec F).
    tileToClient: tileToClient,
    playerClient: playerClient,
    camera: {
      // z and cssPerRp: CSS px per rp; device: device px per rp.
    get: function () { const o = camOrigin(); return { mode: cam.mode, x0: o[0], y0: o[1], vw: cam.vw, vh: cam.vh, z: cssPerRp(), cssPerRp: cssPerRp(), device: cam.z, follow: cam.follow, home: homeBox() }; },
      set: function (mode) { camSet(mode); try { render(); } catch (e) { fail(e); } return cam.mode; },
      centerOn: function (tx, ty, instant) { const c = tileRp(tx, ty); cam.ease = null; cam.deskFit = false; camCenter(c[0], c[1]); },
      reveal: function (tx, ty) { camReveal(tx, ty); },
      // v4.1 dev: one follow step of dt seconds (the harness advances without frames).
      followStep: function (dt) { camFollow(dt || 1); camFollow(dt || 1); try { render(); } catch (e) { fail(e); } return camOrigin(); },
      pan: function (dx, dy) { camPan(dx, dy); },
      home: function () { camHome(); },
      follow: function (on) { cam.follow = on !== false; }
    },
    get previewLook() { return previewLook; },
    tileRp: tileRp,
    saleShown: function () { return saleShown(); },   // v3.4: the "+" marks show only with Shop or Gear open
    version: VERSION,
    sim: sim,
    el: el,
    advance: advance,
    get reduced() { return reduced; },
    get saveOff() { return saveOff; },
    dog: dog,
    fxLog: fxLog,
    captureFrame: captureFrame,
    get banner() { return bannerNow(); },
    get clockText() { return sim.state.phase === 'service' ? clockStr(sim.state) : null; },   // v3.8: the clock box, OVERTIME past the hard end
    get rail() { return railNow(); },
    get railBoxes() { return railBoxes ? JSON.parse(JSON.stringify(railBoxes)) : null; },
    get badgeLog() { return badgeLog.slice(); },
    get orderBubbles() { return orderBubbles.slice(); },
    get eatCues() { return JSON.parse(JSON.stringify(eatCues)); },   // v4.6: the eaters' steam puffs (world rp)
    get registerBoxes() { return registerBoxes(); },
    get drawLog() { return drawLog.slice(); },
    // Joel 2026-10-23: the desktop action box and its parts (owned stations, line spots, owned seats,
    // the sign) in client CSS px, the canvas rect, and the ids of parts not wholly inside the canvas.
    frameBoxes: function () {
      const r = el.cv.getBoundingClientRect(), o = camOrigin(), k = cssPerRp();
      const cl = function (b) { return { x0: Math.round(r.left + (b.x0 - o[0]) * k), x1: Math.round(r.left + (b.x1 - o[0]) * k), y0: Math.round(r.top + (b.y0 - o[1]) * k), y1: Math.round(r.top + (b.y1 - o[1]) * k) }; };
      const inside = function (c) { return c.x0 >= r.left - 1 && c.x1 <= r.right + 1 && c.y0 >= r.top - 1 && c.y1 <= r.bottom + 1; };
      const parts = deskParts().map(function (p) { return { id: p.id, kind: p.kind, c: cl(p.b) }; });
      const f = deskFrame();
      return { cv: { x0: Math.round(r.left), x1: Math.round(r.right), y0: Math.round(r.top), y1: Math.round(r.bottom) }, box: f ? cl(f) : null, k: cam.z, fit: cam.deskFit === true, parts: parts, out: parts.filter(function (p) { return !inside(p.c); }).map(function (p) { return p.id; }) };
    },
    get counterBoxes() { return counterBoxes(); },
    // v4.5: the taps as the game resolved them, today's host seating, and a guest's body on screen
    // (client px: the middle of the box drawn last frame, f up from its foot, default 0.6).
    get tapLog() { return tapLog.slice(); },
    get host() { const h = hostNow(); return { tables: h.tables.slice(), seats: h.seats.slice() }; },
    // The point nearest that one which a tap there resolves to this guest (another guest's chip
    // may cover part of the body), with 2 rp of the same answer around it when it can.
    guestClient: function (id, f) {
      const b = custBoxes.get(id);
      if (!b) return null;
      const w = clientToWorld(0, 0), k = f === undefined ? 0.6 : f;
      const X0 = (b.x0 + b.x1) / 2, Y0 = b.y1 - (b.y1 - b.y0) * k;
      const is = function (x, y) { const h = hitWorld(x, y); return h.guest === id; };
      let best = null, bd = Infinity;
      for (const margin of [2, 0]) {
        for (let y = Math.floor(b.y0); y < b.y1; y++) for (let x = Math.floor(b.x0); x < b.x1; x++) {
          const d = (x - X0) * (x - X0) + (y - Y0) * (y - Y0);
          if (d >= bd || !is(x + 0.5, y + 0.5)) continue;
          if (margin && !(is(x + 0.5 - margin, y + 0.5) && is(x + 0.5 + margin, y + 0.5) && is(x + 0.5, y + 0.5 - margin) && is(x + 0.5, y + 0.5 + margin))) continue;
          bd = d; best = [x + 0.5, y + 0.5];
        }
        if (best) break;
      }
      if (!best) return null;
      return { x: w.r.left + (best[0] - w.o[0]) * w.k, y: w.r.top + (best[1] - w.o[1]) * w.k, X: best[0], Y: best[1] };
    },
    get people() { return peopleBoxes.slice(); },
    get kitchenBox() { return kitchenBox(); },
    get sign() { return signInfo(); },
    get panel() { return howtoOpen ? 'howto' : currentPanel; },
    // X13.8: the crew movers in the yard with art.crewKey(role); v4.8: the board's open applicants.
    get crew() { return crewNow(); },
    get board() { const b = boardData(); return b ? b.list.length : null; },
    // v3.3: the competition rail, the shelf and the FIRE feed puffs on screen.
    get comp() { return compView(sim.state); },
    get compRail() { const v = compView(sim.state); return v ? compRailStrs(v, sim.state) : null; },
    get trophies() { return trophiesOf(sim.state).length; },
    get feedPuffs() { return feedPuffs.length; },
    refresh: function () { pump(); showLoop(); updateDom(); return currentPanel; }
  };
}

function crewNow() {
  const s = sim.state;
  const one = function (m, role) {
    if (!m) return null;
    let key = '';
    try { key = art && typeof art.crewKey === 'function' ? art.crewKey(role) : ''; } catch (e) { key = ''; }
    return { id: m.cardId !== undefined ? m.cardId : null, key: key };
  };
  return { run: one(s.buddy, 'run'), fire: one(s.tender, 'fire'), prep: one(s.prep || null, 'prep'), till: s.cashier ? { id: s.cashier.cardId !== undefined ? s.cashier.cardId : null, key: 'till' } : null,
    pit: s.pitCard ? { id: s.pitCard.cardId !== undefined ? s.pitCard.cardId : null, key: 'pit', cooker: s.pitCard.cooker } : null };
}

// Steps the sim, pumps events once, then refreshes the DOM and draws one frame (D14).
function advance(seconds) {
  const n = Math.max(0, Math.round((Number(seconds) || 0) / C.TICK_SECONDS));
  for (let i = 0; i < n; i++) sim.tick();
  pump();
  observe();
  updateDom();
  try { render(); } catch (e) { fail(e); }
}

// Renders the current state once without moving any timer and returns what it drew.
function captureFrame() {
  recs = [];
  capturing = true;
  try { render(); } finally { capturing = false; }
  return recs;
}

function setupMedia() {
  mqReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  mqDesktop = window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;
  reduced = !!(mqReduced && mqReduced.matches);
  const onR = function () {
    reduced = !!(mqReduced && mqReduced.matches);
    if (reduced) {
      puffs.length = 0; sparkles.length = 0; squashAt = -1; shakeUntil = 0; birdUntil = -1;
      dogReset(2);
    }
  };
  const onD = function () { resize(); syncPanels(); };
  listenMq(mqReduced, onR);
  listenMq(mqDesktop, onD);
}
function listenMq(mq, fn) {
  if (!mq) return;
  if (mq.addEventListener) mq.addEventListener('change', fn);
  else if (mq.addListener) mq.addListener(fn);
}

// ---------------------------------------------------------------- canvas



// Nudge the canvas so its top left corner lands on a whole device pixel.
function snapCanvas(dpr) {
  const st = el.cv.style;
  st.position = 'relative';
  st.left = '0px';
  st.top = '0px';
  const r = el.cv.getBoundingClientRect();
  const fix = function (v) {
    const d = Math.round((Math.round(v * dpr) / dpr - v) * 10000) / 10000;
    return Math.abs(d) < 0.0001 ? 0 : d;
  };
  st.left = fix(r.left) + 'px';
  st.top = fix(r.top) + 'px';
}

// ---------------------------------------------------------------- frame loop

function frame(now) {
  if (stopped) return;
  rafId = requestAnimationFrame(frame);
  if (last === null) last = now;
  let dt = (now - last) / 1000;
  last = now;
  nowMs = now;
  if (!(dt >= 0)) dt = 0;
  if (dt > C.MAX_FRAME_DT) dt = C.MAX_FRAME_DT;

  let s = sim.state;
  if (held.size && !s.paused && ((!currentPanel && !arr) || besideYard())) {
    held.forEach(function (d) { sim.move(d, true); });
  }
  sim.step(dt);
  pump();
  observe();
  camFollow(dt);
  s = sim.state;
  const frozen = s.paused || currentPanel !== null || s.phase !== 'service';
  if (!frozen) {
    tAnim += dt;
    updateFx(dt);
  }
  // The creator preview's puffs rise (deviation 38); still under reduced motion.
  if (currentPanel === 'creator' && !reduced) {
    crAnim += dt;
    if (crAnimAt < 0 || crAnim - crAnimAt >= 0.2) { crAnimAt = crAnim; drawCreatorScene(); }
  }
  try {
    render();
  } catch (e) {
    fail(e);
    return;
  }
  updateDom();
}

function fail(e) {
  stopped = true;
  cancelAnimationFrame(rafId);
  console.error(e);
  el.status.textContent = 'Drawing failed: ' + String((e && e.message) || e);
}

// ---------------------------------------------------------------- events

// v4.1 the gear ladder: what the main cooker is called now (a cabinet smoker, a stick burner, a trailer rig).
function cookerSpoken(id) {
  const st = MAP.station(id);
  if (id === 'kettle1' && st && (st.tier | 0) > 0 && st.spoken) return st.spoken;
  return STRINGS.cooker[id] || '';
}
function brisketOk(s) { return typeof PitSim.canBrisket === 'function' ? PitSim.canBrisket(s.gear) : s.gear.drum === true; }
function pitTierOf(s) { return typeof PitSim.pitTier === 'function' ? PitSim.pitTier(s.gear) : 0; }
// v4.1: "Crew slots 2 of 3" for the Gear sheet and the crew sheet's board.
function crewSlotsLine(id) {
  const p = payrollNow();
  if (!p || !STRINGS.ui.crewSlots) return null;
  const line = mk('p', { id: id, cls: 'crew-slots', text: U('crewSlots', { n: sim.state.crew.length, s: p.slots }) });
  if (Array.isArray(rowSink)) rowSink.push(function () { const q = payrollNow(); if (q) line.textContent = U('crewSlots', { n: sim.state.crew.length, s: q.slots }); });
  return line;
}

function pump() {
  const evs = sim.drainEvents();
  for (let i = 0; i < evs.length; i++) onEvent(evs[i]);
}

function onEvent(ev) {
  const L = ev.meat && MEATS[ev.meat] ? MEATS[ev.meat].label : '';
  const K = ev.cooker ? cookerSpoken(ev.cooker) : '';
  switch (ev.type) {
    case 'yard_open': {
      const s = sim.state;
      camHome();
      const kind = ev.kind || todayKind(s);
      const secs = Math.max(0, Math.ceil(tGate(s) - s.clock));
      if (kind === 'booking' && s.today && s.today.booking && s.today.booking.comp) {
        // v3.3 integration: the competition opens with its turn-in times, not a gate.
        const b = s.today.booking;
        announce((b.label || bookingLabel(b.type)) + '. Turn-ins at ' + b.comp.times.join(', ') + ' seconds.');
      } else if (kind === 'booking' && s.today && s.today.booking) {
        const b = s.today.booking;
        announce(SAY('open', { label: b.label || bookingLabel(b.type), n: s.today.booked | 0, list: railList(s.today.rail, 'plateLabel'), s: secs }));
      } else if (kind !== 'tutorial' || !tutRunning()) {
        announce('Yard open. Gate opens in ' + secs + ' seconds.');
      }
      pastSoldOut = 0;
      noticeUntil = 0;   // deviation 41: the save notice belongs to the screen it opened on
      clearFx();
      dogReset(3);
      dropSheet();
      cardCtx = null;
      dressCrew();       // X13.7: each lineup card's look on its role's in-yard sprites
      closePanel();
      break;
    }
    case 'gate_soon': announce('Gate opens in 10.'); break;
    case 'gate_open': announce('Gate open.'); break;
    case 'customer_arrived': announce('New customer wants ' + L + '.'); break;
    case 'piece_done': announce(L + ' is done on ' + K + '.'); break;
    case 'piece_burnt':
      announce(L + ' burnt on ' + K + '.');
      if (!reduced) {
        shakeUntil = nowMs + FX.SHAKE_MS;
        burntBurst(ev.cooker);
      }
      break;
    case 'served': onServed(ev, L); break;
    case 'rung': onRung(ev); break;
    case 'seat_taken': break;
    case 'to_go': announce('No free seat. They took it to go.'); break;
    case 'overtime': announce('Overtime. The gate is closed. Finish the plates people paid for.'); break;
    case 'boxed': announce('Out of time. Their plate went in a box to go.'); break;
    case 'seat_done': onSeatDone(ev); break;
    case 'walk_out': {
      announce(ev.refund > 0 ? 'A customer walked out. Refunded ' + ev.refund + '.' : 'A customer walked out.');
      markX.set(ev.id, tAnim + FX.WALKOUT_MARK_S);
      const c = custById(ev.id);
      if (c) log('mark', Math.round(c.px) + 18, Math.round(c.py) - 20);
      break;
    }
    case 'walk_past':
      if (ev.reason === 'soldout') pastSoldOut += 1;
      announce(ev.reason === 'soldout' ? 'Someone looked in. Nothing left to sell.' : 'Someone walked past. The line is full.');
      break;
    case 'fire_low': announce('Fire low on ' + K + '.'); break;
    case 'fire_out': announce('Fire out on ' + K + '.'); break;
    case 'last_call':
      if (compView(sim.state)) break;   // v3.3 integration: the competition has no customers
      announce('Last call. No more customers today.');
      lastCallUntil = nowMs + 3000;
      break;
    case 'day_over':
      sfxStopLoops();
      announce(todayKind(sim.state) === 'booking' ? SAY('reportOpen') : 'Day over. Opening the till.');
      moneyMore = false;
      openTill();
      break;
    case 'purchase':
      announce('Bought ' + ev.label + '.');
      if (currentPanel === 'clipboard') rebuildClipboardKeepFocus();
      break;
    case 'hire':
      announce(ev.hired ? 'Hired ' + ev.label + '.' : 'Let ' + ev.label + ' go.');
      refreshClipboard();
      break;
    // v3.0 (W14).
    case 'offers_ready': break;
    case 'booking_picked': {
      const se = sim.state.season;
      const o = se && se.booking;
      if (o && o.type !== 'yard') {
        announce(SAY('picked', { label: o.label || bookingLabel(o.type), n: o.headcount | 0, fee: o.pay | 0 }));
      } else {
        announce(SAY('pickedYard'));
      }
      break;
    }
    case 'deposit': announce(SAY('deposit', { d: ev.amount | 0 })); break;
    case 'guests_missed':
      announce((ev.n | 0) === 1 ? SAY('missedOne') : SAY('missed', { n: ev.n | 0 }));
      break;
    case 'client_stars':
      announce((ev.stars | 0) === 1 ? SAY('starsOne') : SAY('stars', { n: ev.stars | 0 }));
      break;
    case 'spoiled': break;
    case 'week_start': announce(SAY('week', { w: ev.week | 0, when: weekWhen(ev.week | 0) })); break;
    case 'season_end': announce(SAY('seasonEnd', { y: ev.year | 0 })); break;
    case 'season_start': break;
    case 'turnin_judged': announce(UX('turnIn', { label: L, n: ev.score | 0 })); break;
    case 'turnin_missed': announce(SX('comp', 'missed', { meat: L.toLowerCase() }, 'missed')); break;
    case 'comp_results': announce(SX('comp', 'place', { p: ordinal(ev.place | 0), n: 10 }, 'compPlace')); break;
    case 'fire_fed': simFeeds = true; if (ev.cooker) feedPuff(ev.cooker); break;
    case 'pit_fed': case 'pit_lit': if (ev.cooker) feedPuff(ev.cooker); break;   // v4.3: the PIT card's bag or split puffs too
    case 'player_set': applyLook(lookNow()); break;
    case 'tutorial_refill':
      if (ev.kind === 'meat') announce(SAY('refillMeat', { label: ev.meat && MEATS[ev.meat] ? MEATS[ev.meat].label : '' }));
      else announce(SAY('refillCharcoal'));
      break;
    case 'sell':
      announce('Sold ' + ev.label + ' for ' + ev.price + '.');
      if (currentPanel === 'broke') buildBroke();
      break;
    case 'coming_next':
      announce('You can afford the driveway pop-up. It is the next rung and is not built yet.');
      break;
    case 'broke':
      announce('Broke. Sell gear or start over.');
      openBroke();
      break;
    case 'save_wanted': writeSave(); break;
    case 'save_clear': clearSave(); break;
    case 'blocked': blockedUntil = nowMs + 1500; break;
    case 'tutorial_step':
      if (ev.id !== lastSpokenStep) {
        lastSpokenStep = ev.id;
        if (ev.text) announce(String(ev.text));
      }
      break;
    case 'tutorial_done': lastSpokenStep = null; break;
    // v3.1 (X9): crew cards.
    case 'crew_hired': announce(SAY('hired', { name: ev.name || '' })); break;
    case 'crew_let_go': announce(SAY('letGo', { name: ev.name || '' })); break;
    case 'trained': announce(SAY('trained', { name: ev.name || '', xp: ev.xp | 0 })); break;
    case 'level_ready': announce(SAY('levelReady', { name: ev.name || '' })); break;
    case 'pit_level': announce(STRINGS.pit && STRINGS.pit.levelUp && (ev.pending | 0) > 0 ? fill(STRINGS.pit.levelUp, { n: ev.level | 0 }) : 'Pitmaster level ' + (ev.level | 0) + '.'); break;
    case 'pit_skill': break;
    case 'level_up': {
      if ((ev.skill | 0) === -1) { announce(SAY('levelMood', { name: ev.name || '' })); break; }
      const c = crewCard(ev.id);
      const sk = c ? skillName(c.role, ev.skill | 0) : '';
      announce(SAY('levelUp', { name: ev.name || '', skill: sk.toLowerCase() }));
      break;
    }
    case 'raise': announce(SAY('raise', { name: ev.name || '', w: ev.wage | 0 })); break;
    case 'left_for_prep': announce(SAY('leftFor', { name: ev.name || '', label: L.toLowerCase() })); break;
    case 'crew_notice': announce(SAY('notice', { name: ev.name || '' })); break;
    case 'crew_left': announce(SAY('left', { name: ev.name || '' })); break;
    case 'bring_set': case 'crew_mood': case 'slice_done': break;
    // v3.2 Days (D7): a quick day's sentence, then its result card; the next morning; the overnight smoke.
    case 'day_done': {
      const dd = STRINGS.say && STRINGS.say.dayDone ? STRINGS.say.dayDone[ev.kind] : '';
      if (dd) announce(dd);
      openDayCard();
      break;
    }
    case 'day_start': announce(SAY('dayStart', { day: dayNameOf(ev.day | 0) })); break;
    case 'overnight_on': announce(SAY('overnight', { meat: ev.meat && MEATS[ev.meat] ? MEATS[ev.meat].label : '' })); break;
    case 'burn_warning': {
      sfxOne('burnwarn');   // once a piece: the sim sets pc.warn the first time
      const W = STRINGS.burnWarn && STRINGS.burnWarn[ev.meat];
      announce(W || ('The ' + (L ? L.toLowerCase() : 'meat') + ' is about to burn.'));
      if (ev.station) puffT[ev.station] = 0;
      break;
    }
    default: break;
  }
}

function onServed(ev, L) {
  if (ev.booked === true) {
    announce(ev.tip > 0 ? SAY('servedBooked', { L: L, tip: ev.tip }) : SAY('servedBookedNoTip', { L: L }));
  } else {
    announce(ev.tip > 0 ? 'Served ' + L + ', ' + ev.tip + ' tip.' : 'Served ' + L + ', no tip.');
  }
  const x = Math.round(Number(ev.x) || 0), y = Math.round(Number(ev.y) || 0);
  // v3.7: the price rises at the register (onRung); the tip rises at the table when the plate lands.
  if (ev.tip > 0) {
    const tipStr = '+' + ev.tip + ' TIP';
    addNum('tip', tipStr, numX(x, tipStr, false), Math.max(1, y - 18), 'white', false);
  }
  if (!reduced) {
    for (let i = 0; i < SPARKLE_OFFS.length; i++) {
      const sx = x + SPARKLE_OFFS[i][0], sy = y + SPARKLE_OFFS[i][1];
      sparkles.push({ x: sx, y: sy, at: tAnim + i * FX.SPARKLE_STAGGER_S });
      log('sparkle', sx, sy);
    }
    if (sparkles.length > 24) sparkles.splice(0, sparkles.length - 24);
    const c = custById(ev.id);
    if (c) log('hop', Math.round(c.px), Math.round(c.py) - 10);
  }
}

// v3.6: a guest paid at the register: the ding, then the cash and the tip rise over the register.
function onRung(ev) {
  if (ev.by === 'late') announce(ev.tip > 0 ? 'A guest paid on the way out, ' + ev.tip + ' tip.' : 'A guest paid on the way out.');
  sfxOne('ding');
  const x = Math.round(Number(ev.x) || 0), y = Math.round(Number(ev.y) || 0);
  const cashStr = '+' + ev.price;
  const nx = x + 1, ny = y - 18;
  const cu = null;
  if (ev.booked === true) {
    // Deviation 29: a booked plate has no price, so only the tip rises, from the cash spot.
    if (ev.tip > 0) {
      const tipStr = '+' + ev.tip + ' TIP';
      addNum('tip', tipStr, numX(cu ? Math.round(cu.px) : nx, tipStr, false), Math.max(1, ny), 'white', false);
    }
  } else {
    addNum('cash', cashStr, numX(nx, cashStr, true), Math.max(1, ny), 'yellow', true);
  }
  if (ev.tip > 0 && ev.booked !== true) {
    const tipStr = '+' + ev.tip + ' TIP';
    const tx = cu ? Math.round(cu.px) : nx;
    addNum('tip', tipStr, numX(tx, tipStr, false), Math.max(1, ny + FX.TIP_GAP_PX), 'white', false);
  }
}

function onSeatDone(ev) {
  if (ev.atClose) return;
  announce('A seated customer tipped ' + ev.bonus + ' more.');
  const x = Math.round(Number(ev.x) || 0), y = Math.round(Number(ev.y) || 0);
  let k = 0;
  for (let i = 0; i < hearts.length; i++) {
    const h = hearts[i];
    if (tAnim - h.at < STAGGER_WINDOW_S && Math.abs(h.x - x) <= 12 && Math.abs(h.y - (y - 24)) <= 8) k++;
  }
  hearts.push({ x: x, y: y - 24, at: tAnim + Math.min(STAGGER_MAX, k) * STAGGER_S });
  if (hearts.length > 8) hearts.shift();
  log('heart', x, y - 24);
  const str = '+' + ev.bonus + ' TIP';
  addNum('seatTip', str, numX(x - 4, str, false), Math.max(1, y - 34), 'pink', false);
}

// Clamp a number's text x so the text (and its coin) stays inside the canvas with its outline.
// Review 1: a tip keeps 6 px clear of the right fence posts.
function numX(x, str, coin) {
  const w = art.textWidth(str);
  return Math.max(coin ? 10 : 1, Math.min(VW - w - (coin ? 1 : 6), x));
}

// Numbers that would overlap one still fresh start STAGGER_S later per such number (round 2).
// Review 1: a tip (or a seat tip) landing within 12 px across and 8 px up or down of a fresh one of
// the same kind adds into it ("+4 TIP") and restarts it, instead of rising through it; a tip that
// overlaps any other fresh number also sits 9 px higher per number it overlaps.
function addNum(kind, str, x, y, color, coin) {
  if (kind === 'tip' || kind === 'seatTip') {
    const m = /^\+(\d+)/.exec(str);
    for (let i = nums.length - 1; m && i >= 0; i--) {
      const n = nums[i];
      if (n.kind !== kind || tAnim - n.at >= FX.NUMBER_FADE_AT || Math.abs(n.x - x) > 12 || Math.abs(n.y - y) > 8) continue;
      const had = /^\+(\d+)/.exec(n.str);
      if (!had) continue;
      n.str = '+' + (Number(had[1]) + Number(m[1])) + ' TIP';
      n.x = numX(n.x, n.str, n.coin);
      n.at = Math.max(n.at, tAnim);
      log(kind, n.x, n.y);
      return;
    }
  }
  // v3.5: the overlap test runs on the projected screen boxes. A number's shift is fixed from its
  // rest spot when it is added; while its box overlaps any live number's box (where that one is
  // drawn now), it moves up one 9 px row, so every live number gets its own row.
  const sh = moverShift(x - 4, y + CASH_ABOVE_PX);
  const live = [];
  let fresh = 0;
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i], age = tAnim - n.at;
    if (age >= FX.NUMBER_S) continue;
    if (age < STAGGER_WINDOW_S) fresh++;
    live.push(numBox(n.str, n.x, n.y - numRise(Math.max(0, age)), n.color, n.coin, numShift(n)));
  }
  const hit = function (b) {
    for (let i = 0; i < live.length; i++) {
      const r = live[i];
      if (r.x0 < b.x1 && b.x0 < r.x1 && r.y0 < b.y1 && b.y0 < r.y1) return true;
    }
    return false;
  };
  // Up a row at a time while the box stays on the canvas, then down; the first clear row wins.
  const rows = [];
  for (let r = 0; r < 12; r++) if (r === 0 || y - r * 9 + sh.dy >= 1) rows.push(r);
  for (let r = 1; r < 6; r++) rows.push(-r);
  let k = 0;
  for (let i = 0; i < rows.length; i++) { if (!hit(numBox(str, x, y - rows[i] * 9, color, coin, sh))) { k = rows[i]; break; } }
  const kk = Math.min(STAGGER_MAX, Math.abs(k), fresh);
  const yy = y - k * 9;
  nums.push({ kind: kind, str: str, x: x, y: yy, color: color, coin: coin, at: tAnim + kk * STAGGER_S, sh: sh });
  if (nums.length > 16) nums.shift();
  log(kind, x, yy);
}

function log(kind, x, y) {
  const s = sim.state;
  fxLog.push({ kind: kind, x: Math.round(x), y: Math.round(y), day: s.day, at: s.clock });
  if (fxLog.length > FX_LOG_MAX) fxLog.splice(0, fxLog.length - FX_LOG_MAX);
}

function announce(msg) {
  const prev = liveRecent.get(msg);
  if (prev !== undefined && nowMs - prev < 5000) return;
  if (liveQueue.indexOf(msg) !== -1) return;
  liveQueue.push(msg);
  liveRecent.set(msg, nowMs);
  if (liveQueue.length > 8) liveQueue.shift();
}

function flushLive() {
  if (!liveQueue.length) return;
  if (nowMs - liveLastAt < 1000) return;
  const msg = liveQueue.shift();
  liveLastAt = nowMs;
  liveRecent.set(msg, nowMs);
  el.live.textContent = msg;
  if (liveRecent.size > 64) {
    liveRecent.forEach(function (t, k) { if (nowMs - t > 5000) liveRecent.delete(k); });
  }
}

function writeSave() {
  try {
    const o = sim.serialize();
    if (o && typeof o === 'object') o.music = musicOn;
    localStorage.setItem(PitSim.SAVE_KEY, JSON.stringify(o));
  } catch (e) {
    noteSaveOff();
  }
}
function clearSave() {
  try { localStorage.removeItem(PitSim.SAVE_KEY); } catch (e) { noteSaveOff(); }
}
function noteSaveOff() {
  saveOff = true;
  if (saveOffNoted) return;
  saveOffNoted = true;
  saveOffUntil = nowMs + 4000;
  announce('Saving is off in this browser.');
}

// ---------------------------------------------------------------- panels

function openPanel(name, focusId) {
  howtoOpen = false; howtoFrom = null;
  armedBuy = null;
  if (name === 'pause') buildPauseBody();
  if (name === 'week' || name === 'sheet' || name === 'creator' || name === 'season-end' || name === 'till' || name === 'card' || name === 'daycard') dropClipboard();
  for (let i = 0; i < PANEL_IDS.length; i++) el[PANEL_IDS[i]].hidden = PANEL_IDS[i] !== name;
  currentPanel = name;
  syncPanels();
  setInert(true);
  const f = focusId ? document.getElementById(focusId) : el[name + '-h'];
  if (f && typeof f.focus === 'function') f.focus();
}

function closePanel() {
  howtoOpen = false; howtoFrom = null;
  for (let i = 0; i < PANEL_IDS.length; i++) el[PANEL_IDS[i]].hidden = true;
  const was = currentPanel;
  currentPanel = null;
  syncPanels();
  setInert(false);
  if (was) focusBack();
}

function focusBack() {
  if (!el.act.disabled) el.act.focus();
  else el.cv.focus();
}

// v3.4: the yard beside an open Shop or Gear sheet (two column layout) takes taps on its "+" marks.
function saleTaps() { return saleShown() && !!(mqDesktop && mqDesktop.matches); }
function setInert(on) {
  if (!('inert' in HTMLElement.prototype)) return;
  el.stage.inert = on && !saleTaps();
  // Joel 2026-10-20: the music button stays live while a panel is open (the whole header was inert,
  // so on the desktop hub a real click on it did nothing); the rest of the header is inert.
  el.hdr.inert = false;
  for (const ch of el.hdr.children) ch.inert = on && ch.id !== 'mute';
  el.foot.inert = on;
}

// v3.4 playtest: the side column shows only while something is open, so the Controls card no
// longer sits beside the yard through service; the Controls button opens it.
function wantHowto() { return howtoOpen; }

function syncPanels() {
  const showHow = wantHowto();
  if (el.howto.hidden !== !showHow) el.howto.hidden = !showHow;
  if (howtoClose && howtoClose.hidden !== !howtoOpen) howtoClose.hidden = !howtoOpen;
  const hidePanels = !currentPanel && !showHow;
  if (el.panels.hidden !== hidePanels) {
    el.panels.hidden = hidePanels;
    // v3.4: the side column opens and closes beside the yard, which takes the room it leaves.
    if (mqDesktop && mqDesktop.matches && vctx) resize();
  }
  lastHow = showHow;
}

// The Controls card in place of the open panel (phones never see the desktop side column).
function openHowto(openerId) {
  if (howtoOpen) return;
  howtoOpener = typeof openerId === 'string' ? openerId : null;
  howtoOpen = true;
  howtoFrom = currentPanel;
  if (howtoFrom) el[howtoFrom].hidden = true;
  syncPanels();
  el['howto-h'].focus();
}

function closeHowto() {
  if (!howtoOpen) return;
  howtoOpen = false;
  const back = howtoFrom;
  howtoFrom = null;
  const restore = back && currentPanel === back;
  if (restore) el[back].hidden = false;
  syncPanels();
  if (restore) {
    const b = document.getElementById(howtoOpener || 'howto-btn');
    if (b && !b.disabled) b.focus(); else el[back + '-h'].focus();
  }
  howtoOpener = null;
}

// W17.1: the panel for the loop the sim is on.
function showLoop() {
  const s = sim.state;
  const loop = loopOf(s);
  if (loop === 'creator') { openCreator(false); return; }
  if (loop === 'seasonEnd' || loop === 'offseason') { openSeasonEnd(); return; }
  if (loop === 'week') { if (s.broke) openBroke(); else if (s.phase === 'evening' && dayCardNow()) openDayCard(); else openWeek(); return; }
  if (loop === 'report' || (loop === 'tutorial' && s.phase === 'evening')) { openTill(); return; }
  if (s.phase === 'morning') { if (s.broke) openBroke(); else openClipboard(); return; }
  closePanel();
}

// Empties the tutorial clipboard so its v2 row ids never sit beside the hub's (deviation 30).
function dropClipboard() {
  if (!clip) return;
  clear(el['clip-top']); clear(el.shop); clear(el.hire); clear(el['clip-foot']);
  clip = null;
}

// Rebuilds a panel's content and puts focus back on the same control when it is still usable.
function rebuildKeepFocus(build, panel) {
  const a = document.activeElement;
  const id = a && a.id ? a.id : null;
  build();
  let f = id ? document.getElementById(id) : null;
  if (!f || f.disabled || f.hidden || !el[panel].contains(f) || (f.tagName !== 'BUTTON' && f.tagName !== 'INPUT')) f = el[panel + '-h'];
  if (f && typeof f.focus === 'function' && currentPanel === panel) f.focus();
}

// After any control on a season screen: pump, then refresh the screen that is open.
function afterAct() {
  pump();
  if (currentPanel === 'week') rebuildKeepFocus(buildWeek, 'week');
  else if (currentPanel === 'sheet') refreshSheet();
  else if (currentPanel === 'clipboard') refreshClipboard();
  else if (currentPanel === 'card') { rebuildUnderCard(); rebuildKeepFocus(buildCard, 'card'); }
  updateDom();
}

function togglePause() {
  const s = sim.state;
  if (s.phase !== 'service') return;
  if (s.paused) {
    sim.setPaused(false);
    closePanel();
  } else {
    sim.setPaused(true);
    openPanel('pause');
  }
  updateDom();
}

function resumeFromPause() {
  if (sim.state.paused) sim.setPaused(false);
  closePanel();
  updateDom();
}

function openConfirm(from) {
  returnPanel = from;
  openPanel('newgame', 'confirm-no');
}
function confirmNo() {
  const back = returnPanel;
  returnPanel = null;
  if (back && back !== 'newgame') openPanel(back);
  else closePanel();
}
function confirmYes() {
  held.clear();
  clearFx();
  fxLog.length = 0;
  returnPanel = null;
  lastSpokenStep = null;
  crFromPause = false;
  migrated = false;
  dropSheet();
  cardCtx = null; crewMsg = ''; moneyMore = false;
  lookCache.clear(); nameCache.clear();
  sim.reset();
  sim.setPaused(false);
  applyLook(lookNow());
  dogReset(2);
  pump();
  showLoop();
  pump();
}

// ---------------------------------------------------------------- static DOM

function buildStatic() {
  clear(el.chips);
  // W17.6: the charcoal chip first, an inventory readout (not a button).
  const cc = mk('span', { id: 'chip-charcoal', cls: 'chip inv', attrs: { role: 'img', 'aria-label': 'Charcoal, 0 bags' } });
  const pileIc = sprEl('pile', 0, 1, null);
  if (pileIc) cc.appendChild(pileIc);
  const ccn = mk('span', { text: '0', attrs: { 'aria-hidden': 'true' } });
  cc.appendChild(ccn);
  el.chips.appendChild(cc);
  chipEls.charcoal = { b: cc, cnt: ccn };
  lastChips.charcoal = '';
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const id = MEAT_IDS[i];
    const b = mk('button', { id: 'chip-' + id, cls: 'chip', type: 'button' });
    const ic = iconCanvas('icon_' + id);
    if (ic) { ic.style.marginRight = '0'; b.appendChild(ic); }
    const cnt = mk('span', { text: '0' });
    b.appendChild(cnt);
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', MEATS[id].label + ', 0 in stock');
    b.addEventListener('click', function () { sim.selectMeat(id); pump(); });
    el.chips.appendChild(b);
    chipEls[id] = { b: b, cnt: cnt };
    chipSig[id] = '';
  }

  el['pause-h'].textContent = 'Paused';
  buildPauseBody();

  el['howto-h'].textContent = 'Controls';
  el['howto-h'].setAttribute('tabindex', '-1');
  clear(el['howto-body']);
  const dl = mk('dl', { cls: 'dl' });
  for (let i = 0; i < KEY_HELP.length; i++) {
    dl.appendChild(mk('dt', { text: KEY_HELP[i][0] }));
    dl.appendChild(mk('dd', { text: KEY_HELP[i][1] }));
  }
  el['howto-body'].appendChild(dl);
  howtoClose = btn('howto-close', 'Back', 'alt', closeHowto);
  howtoClose.hidden = true;
  el['howto-body'].appendChild(howtoClose);

  el['newgame-h'].textContent = 'Start over? This wipes the save.';
  clear(el['newgame-body']);
  el['newgame-body'].appendChild(btn('confirm-no', 'Keep playing', 'primary', confirmNo));
  el['newgame-body'].appendChild(btn('confirm-yes', 'Start over', 'alt', confirmYes));
}

// Pause panel, in order: Keep playing, Controls, Skip tutorial (while it runs), New game ([T 2.6]).
function buildPauseBody() {
  const b = el['pause-body'];
  clear(b);
  b.appendChild(btn('resume', 'Keep playing', 'primary', resumeFromPause));
  b.appendChild(btn('pause-controls', 'Controls', 'alt', function () { openHowto('pause-controls'); }));
  // W17.6: the creator, reopened from the pause panel ([S 19.2] change later).
  b.appendChild(btn('pause-look', U('pauseLook'), 'alt', function () { openCreator(true); }));
  if (tutRunning()) b.appendChild(btn('pause-skip', 'Skip tutorial', 'alt', onPauseSkip));
  b.appendChild(btn('pause-new', 'New game', 'alt', function () { openConfirm('pause'); }));
  if (TESTER) b.appendChild(btn('pause-tester', 'Tester', 'alt', function () { openTester('pause'); }));   // v4.7, preview only
}

// ---------------------------------------------------------------- v4.7 the tester panel (preview only)

// Joel 2026-10-21: "There also needs to be a way for me to test the advanced levels as well." The
// panel exists only when window.PitSimTester === true: the private preview packager sets that flag in
// a script before the game's; games/pit-sim/index.html (the website copy) never does. Entry: a Tester
// button at the bottom of the Pause panel, and (Pause only opens in service, from the keyboard) a
// Tester tools link on the week hub. Every change goes through sim.testerApply between days.
const TESTER = typeof window !== 'undefined' && window.PitSimTester === true;
let testerFrom = null, testerMsg = '', testerRole = 'pit', testerStars = 4;
const TESTER_CASH = [100, 500, 2000, 10000];
const TESTER_REP = [10, 40, 70, 100];
const TESTER_ROLES = ['run', 'fire', 'prep', 'till', 'pit'];
const TESTER_LABEL = { cooler: 'Cooler', bigtable: 'Big table', tray: 'Tray', canopy: 'Canopy', lights: 'String lights', kettle2: 'Kettle 2',
  drum: 'Drum', cabinet: 'Cabinet', offset: 'Stick burner', trailer: 'Trailer' };
function testerSetup() {
  if (!TESTER || el.tester) return;
  const sec = mk('section', { id: 'tester', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tester-h' } });
  sec.hidden = true;
  sec.appendChild(mk('h2', { id: 'tester-h', text: 'Tester tools', attrs: { tabindex: '-1' } }));
  sec.appendChild(mk('div', { id: 'tester-body' }));
  el.panels.appendChild(sec);
  el.tester = sec; el['tester-h'] = sec.firstChild; el['tester-body'] = sec.lastChild;
  PANEL_IDS.push('tester');
  const css = mk('style', { id: 'tester-css' });
  css.textContent = '#tester .tst-note { color: var(--y); font-size: 13px; }'
    + ' #tester .tst-msg { min-height: 20px; font-size: 14px; }'
    + ' #tester h3 { margin: 10px 0 4px; }'
    + ' #tester .tst-row { display: flex; flex-wrap: wrap; gap: 6px; }'
    + ' #panels #tester .tst-row button { flex: 1 1 0; width: auto; min-width: 40px; min-height: 44px; margin-top: 0; padding: 0 6px; }'
    + ' #tester .tst-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }'
    + ' #panels #tester .tst-grid button { width: 100%; min-height: 44px; margin-top: 0; padding: 0 6px; }'
    + ' #tester button[aria-pressed="true"] { border-color: var(--y); background: #4a3a1c; color: #fff4dc; }'
    + ' #tester .tst-now { font-size: 13px; color: var(--m); }';
  document.head.appendChild(css);
}
function testerBtn(id, text, on, pressed) {
  const b = btn(id, text, 'alt', on);
  if (pressed !== undefined) b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  return b;
}
function openTester(from) {
  if (!TESTER) return;
  testerSetup();
  testerFrom = from || null;
  testerMsg = '';
  buildTester();
  openPanel('tester', 'tester-h');
}
function closeTester() {
  const from = testerFrom;
  testerFrom = null;
  pump();
  if (from === 'pause') { openPanel('pause', 'pause-tester'); updateDom(); return; }
  showLoop();
  pump();
  updateDom();
}
// One change through the sim; the screen behind it rebuilds when the panel closes.
function testerDo(op) {
  const r = sim.testerApply(op);
  if (r && r.ok) {
    held.clear();
    clearFx();
    dropSheet();
    cardCtx = null; crewMsg = ''; moneyMore = false;
    lookCache.clear(); nameCache.clear();
    migrated = false;
    applyLook(lookNow());
    dogReset(2);
  }
  pump();
  testerMsg = r ? (r.message || (r.ok ? 'Done.' : 'That did not work.')) : '';
  rebuildKeepFocus(buildTester, 'tester');
  updateDom();
}
function buildTester() {
  const b = el['tester-body'];
  if (!b) return;
  clear(b);
  const v = sim.testerView();
  b.appendChild(mk('p', { cls: 'tst-note', text: 'Tester tool, for trying the later weeks and gear. It rewrites this save.' }));
  b.appendChild(mk('p', { id: 'tester-msg', cls: 'tst-msg', attrs: { 'aria-live': 'polite' }, text: v.open ? testerMsg : v.reason }));
  const off = !v.open;
  const row = function (kids) { const r = mk('div', { cls: 'tst-row' }, kids); return r; };
  const dis = function (e) { if (off) e.disabled = true; return e; };
  b.appendChild(h3('Week'));
  const wk = [];
  for (let i = 1; i <= v.weeks; i++) (function (n) { wk.push(dis(testerBtn('tester-week-' + n, String(n), function () { testerDo({ week: n }); }, v.week === n))); })(i);
  b.appendChild(row(wk));
  b.appendChild(mk('p', { cls: 'tst-now', text: 'Week ' + v.weeks + ' is the competition.' }));
  b.appendChild(h3('Cash'));
  b.appendChild(row(TESTER_CASH.map(function (c) { return dis(testerBtn('tester-cash-' + c, fmt(c), function () { testerDo({ cash: c }); }, v.cash === c)); })));
  b.appendChild(h3('Word of mouth'));
  b.appendChild(row(TESTER_REP.map(function (r) { return dis(testerBtn('tester-rep-' + r, String(r), function () { testerDo({ rep: r }); }, v.rep === r)); })));
  b.appendChild(mk('p', { cls: 'tst-now', text: 'Now ' + v.rep + ' of 100.' }));
  b.appendChild(h3('Gear'));
  const gg = mk('div', { cls: 'tst-grid' });
  Object.keys(TESTER_LABEL).forEach(function (g) {
    const on = v.gear[g] === true;
    gg.appendChild(dis(testerBtn('tester-gear-' + g, TESTER_LABEL[g], function () { const o = {}; o[g] = !on; testerDo({ gear: o }); }, on)));
  });
  b.appendChild(gg);
  b.appendChild(mk('p', { cls: 'tst-now', text: 'A rung brings the ones under it: the trailer needs the stick burner, which needs the cabinet.' }));
  b.appendChild(h3('Crew card'));
  b.appendChild(row(TESTER_ROLES.map(function (r) { return dis(testerBtn('tester-role-' + r, r.toUpperCase(), function () { testerRole = r; rebuildKeepFocus(buildTester, 'tester'); }, testerRole === r)); })));
  const st = [];
  for (let i = 1; i <= 5; i++) (function (n) { st.push(dis(testerBtn('tester-stars-' + n, n + '★', function () { testerStars = n; rebuildKeepFocus(buildTester, 'tester'); }, testerStars === n))); })(i);
  const sr = row(st);
  sr.style.marginTop = '6px';
  b.appendChild(sr);
  const add = dis(btn('tester-crew-add', 'Add ' + testerRole.toUpperCase() + ' ' + testerStars + '★', 'alt', function () { testerDo({ crew: { role: testerRole, stars: testerStars } }); }));
  // Joel 2026-10-23: Add is off, with the plain reason under it, when the sim would refuse the card
  // (a PIT card below the cabinet smoker, or every crew slot taken).
  const pitTierMin = typeof C.PIT_TIER === 'number' ? C.PIT_TIER : 1;
  const addWhy = testerRole === 'pit' && (v.tier | 0) < pitTierMin ? 'PIT needs the cabinet smoker. Turn on Cabinet under Gear first.'
    : (v.crew.length >= v.slots ? 'All ' + v.slots + ' crew slots are taken. More gear opens more slots.' : '');
  if (addWhy) add.disabled = true;
  b.appendChild(add);
  if (addWhy && !off) b.appendChild(mk('p', { id: 'tester-crew-why', cls: 'tst-now', text: addWhy }));
  const slotsT = STRINGS.ui.crewSlots ? U('crewSlots', { n: v.crew.length, s: v.slots }) : 'Crew slots ' + v.crew.length + ' of ' + v.slots;
  b.appendChild(mk('p', { id: 'tester-crew-now', cls: 'tst-now', text: slotsT + (v.crew.length ? ': ' + v.crew.map(function (c) { return c.name + ' ' + c.role.toUpperCase() + ' ' + c.stars + '★'; }).join(', ') : '.') }));
  b.appendChild(h3('Stock'));
  b.appendChild(dis(btn('tester-fill', 'Fill meat, charcoal and wood', 'alt', function () { testerDo({ fill: true }); })));
  b.appendChild(h3('Next booking'));
  b.appendChild(row(v.bookings.map(function (k) { return dis(testerBtn('tester-book-' + k.id, k.label, function () { testerDo({ booking: k.id }); }, v.booking === k.id)); })));
  b.appendChild(h3('Season'));
  b.appendChild(dis(btn('tester-reset', 'Reset season', 'alt', function () { testerDo({ reset: true }); })));
  b.appendChild(btn('tester-back', 'Back', 'primary', closeTester));
}

function onPauseSkip() {
  if (typeof sim.skipTutorial === 'function') sim.skipTutorial();
  pump();
  buildPauseBody();
  const r = document.getElementById('resume');
  if (r && currentPanel === 'pause') r.focus();
  updateDom();
}

function onClipSkip() {
  if (typeof sim.skipTutorial === 'function') sim.skipTutorial();
  pump();
  // W6: skipping on the morning goes straight to the creator ([S 19.2]).
  if (loopOf(sim.state) === 'tutorial' && sim.state.phase === 'morning') rebuildClipboardKeepFocus();
  else showLoop();
  updateDom();
}

// ---------------------------------------------------------------- clipboard

function openClipboard() {
  buildClipboard();
  if (currentPanel !== 'clipboard') openPanel('clipboard');
}

function rebuildClipboardKeepFocus() {
  const a = document.activeElement;
  const id = a && a.id ? a.id : null;
  buildClipboard();
  let f = id ? document.getElementById(id) : null;
  if (!f || f.disabled || f.tagName !== 'BUTTON') f = (!el.clipboard.hidden && clip && !clip.open.disabled) ? clip.open : el['clipboard-h'];
  if (f && typeof f.focus === 'function') f.focus();
}

function seatsLine() {
  return 'Seats ' + sim.seatCount() + '. Charm ' + sim.charm() + '. Each seated customer tips ' + sim.seatBonus() + ' more.';
}

function buildClipboard() {
  const s = sim.state;
  // Q-7: the tutorial morning wears the hub's look (screen-3-week) and keeps to what the practice
  // day uses: the meat and charcoal rows. The goal line, gear, decor and hires wait for week 1.
  const tut = tutRunning();
  el.clipboard.classList.toggle('hub', tut);
  el.clipboard.classList.toggle('clip-hub', tut);
  const ch = el['clipboard-h'];
  clear(ch);
  if (tut) uiPut(ch, ('Day ' + s.day).toUpperCase(), 3, UI.white, { bold: true, shadow: UI.ink }, 'Morning, day ' + s.day);
  else ch.textContent = 'Morning';
  clear(el['clip-top']); clear(el.shop); clear(el.hire); clear(el['clip-foot']);
  el.shop.className = tut ? 'card3 sheet-card clip-shop' : '';
  clip = { rows: [], headText: null, seats: null, cart: null, open: null, why: null };
  rowSink = clip.rows;

  // Header lines.
  clip.headText = document.createTextNode(headLine(s));
  const head = mk('p', null, [clip.headText, ' ', mk('span', { cls: 'stars', text: stars(s.rep), attrs: { 'aria-hidden': 'true' } })]);
  el['clip-top'].appendChild(head);
  if (tut) el['clip-top'].appendChild(mk('p', { id: 'clip-practice', text: U('practice') }));
  const ts = tutStep();
  if (ts && ts.id === 'open') {
    el['clip-top'].appendChild(mk('p', { id: 'tut-clip', cls: 'card', text: ts.text }));
  }
  if (tutRunning()) el['clip-top'].appendChild(btn('tut-skip', 'Skip tutorial', 'alt', onClipSkip));
  if (s.day === 1 && !tutRunning()) {
    el['clip-top'].appendChild(mk('p', { cls: 'muted', text: 'Tap the charcoal pile, then tap the kettle to light it. A second bag keeps the fire good through the first cook. Tap the cooler for meat and tap the kettle to put it on. When the box around it turns green, pull it and slice it at the board. Plates go on the table.' }));
  }
  if (s.day >= C.RAIN_FROM_DAY) {
    const w = s.rain
      ? (s.gear.canopy ? 'Rain today. The canopy is up.' : 'Rain today. Fewer people come out unless the canopy is up.')
      : 'Clear today.';
    el['clip-top'].appendChild(mk('p', { text: w }));
  }
  if (tut) {
    // Q-7: no goal line on the practice day.
  } else if (s.comingNext) {
    const card = mk('div', { id: 'goal', cls: 'card' }, [
      mk('p', { text: 'Coming next: the driveway pop-up' }),
      mk('p', { text: 'Price ' + C.DRIVEWAY_PRICE + '. The backyard stays open as long as you like.' }),
      btn('goal-keep', 'Keep running the backyard', 'alt', function () {
        sim.dismissComingNext();
        pump();
        buildClipboard();
        el['clipboard-h'].focus();
      })
    ]);
    el['clip-top'].appendChild(card);
  } else {
    const g = sim.goal();
    el['clip-top'].appendChild(mk('p', { id: 'goal', text: g ? 'Next goal: ' + g.label + ', ' + g.price + '.' : '' }));
  }
  clip.seats = mk('p', { id: 'seats', text: seatsLine() });
  el['clip-top'].appendChild(clip.seats);
  if (typeof sim.expectedCrowd === 'function') {
    el['clip-top'].appendChild(mk('p', { id: 'crowd', text: 'Expect about ' + sim.expectedCrowd() + ' people today. One plate each.' }));
  }
  if (s.day >= 2 && s.yesterday) {
    const y = s.yesterday;
    el['clip-top'].appendChild(mk('p', { text: 'Yesterday: ' + y.served + ' served, ' + y.walkouts + ' walked out, ' + y.past + ' walked past.' }));
  }
  const inStock = meatList(s.stock);
  if (inStock) el['clip-top'].appendChild(mk('p', { text: 'In the cooler: ' + inStock + '.' }));

  // Shop.
  el.shop.appendChild(h3('Meat'));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'meat') el.shop.appendChild(cartRow(CATALOG[i]));
  el.shop.appendChild(mk('p', { cls: 'muted', text: 'Game numbers. Not real prices and not a cooking guide.' }));
  el.shop.appendChild(h3('Charcoal'));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'fuel') el.shop.appendChild(cartRow(CATALOG[i]));
  if (!tut) {
    el.shop.appendChild(h3('Gear'));
    for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'gear') el.shop.appendChild(ownRow(CATALOG[i]));
    for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'goal') el.shop.appendChild(goalRow(CATALOG[i]));
    el.shop.appendChild(h3('Decor'));
    el.shop.appendChild(mk('p', { cls: 'muted', text: 'Charm adds to the tip each seated customer leaves, up to 3 more, and lets word of mouth climb a little faster.' }));
    for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'decor') el.shop.appendChild(ownRow(CATALOG[i]));
    // X4.1: the v2 hire rows are gone (crew cards replace them) and #hire stays empty.
    el.shop.appendChild(mk('div', { cls: 'row' }, [
      mk('span', { cls: 'name', text: 'Daily costs: ice and trash bags, ' + C.DAILY_COSTS + '.' })
    ]));
  }

  // Foot.
  clip.cart = mk('p', { id: 'cart' });
  if (tut) {
    // Q-7: Open the yard as the hub's chunky primary, its words in the UI font.
    clip.open = mk('button', { id: 'open', cls: 'primary big', type: 'button', on: onOpen });
    uiPut(clip.open, 'OPEN THE YARD', 2, UI.white, { bold: true, shadow: '#8a3a14' }, 'Open the yard');
  } else {
    clip.open = btn('open', 'Open the yard', 'primary', onOpen);
  }
  clip.why = mk('p', { id: 'open-why', cls: 'muted' });
  el['clip-foot'].appendChild(clip.cart);
  el['clip-foot'].appendChild(clip.open);
  el['clip-foot'].appendChild(clip.why);
  const how = btn('howto-btn', 'Controls', 'alt', function () { openHowto('howto-btn'); });
  const fresh = btn('clip-new', 'New game', 'alt', function () { openConfirm('clipboard'); });
  how.style.flex = '1 1 0';
  fresh.style.flex = '1 1 0';
  el['clip-foot'].appendChild(mk('div', { cls: 'row' }, [how, fresh]));
  refreshClipboard();
}

function headLine(s) {
  return 'Day ' + s.day + '. Cash ' + s.cash + '. Word of mouth ' + s.rep + '.';
}

function refreshClipboard() {
  if (!clip) return;
  const s = sim.state;
  clip.headText.nodeValue = headLine(s);
  const seats = seatsLine();
  if (clip.seats.textContent !== seats) clip.seats.textContent = seats;
  for (let i = 0; i < clip.rows.length; i++) clip.rows[i]();
  const total = sim.cartTotal();
  clip.cart.textContent = 'Total ' + total + '. Cash after ' + (s.cash - total) + '.';
  const co = sim.canOpen();
  clip.open.disabled = !co.ok;
  clip.why.textContent = co.ok ? '' : co.reason;
  syncPulse(null);
}

function nameCell(item, withIcon) {
  // Q-2: the charcoal row carries the pile sprite (there is no charcoal icon), as the HUD chip does.
  const icon = !withIcon ? null : (item.kind === 'fuel' ? pileIcon(item.id === 'wood' ? 'woodpile' : 'pile') : iconCanvas('icon_' + item.id));
  return mk('span', { cls: 'name' }, [icon, item.label, mk('span', { cls: 'effect', text: item.effect })]);
}
function pileIcon(name) {
  const c = sprEl(name || 'pile', 0, 1, null);
  if (c) { c.style.marginRight = '6px'; c.style.verticalAlign = 'middle'; }
  return c;
}

function lockedBy(item, s) {
  const n = item.needs;
  if (!n) return false;
  if (n.gear && s.gear[n.gear] !== true && !(Array.isArray(n.orGear) && n.orGear.some(function (g) { return s.gear[g] === true; }))) return true;
  if (n.decor && s.decor[n.decor] !== true) return true;
  if (typeof n.rep === 'number' && s.rep < n.rep) return true;
  // W22.12: in loop 'week' the buddy has no day gate (deviation 36).
  if (n.day && loopOf(s) !== 'week' && s.day < n.day) return true;
  return false;
}

// Cash a cart line may still spend: the deposit of the picked booking counts in the week (W5.2).
function cartRoom(s) {
  const se = s.season;
  // v3.4: the morning shop for a Yard day or Rest spends cash only (the deposit comes with the event).
  const dep = loopOf(s) === 'week' && se && se.booking && !(sheetFrom === 'morning' && currentPanel === 'sheet' && shopKind !== 'event') ? se.booking.deposit | 0 : 0;
  return s.cash + dep - sim.cartTotal();
}
// D4.2: in the week a meat or charcoal unit costs its price times today's C.DAY_PRICE, rounded; gear
// and decor stay at list price, and the tutorial clipboard is not a week.
function unitPrice(item, s) {
  const se = s.season;
  if (loopOf(s) !== 'week' || !se || !Array.isArray(C.DAY_PRICE) || (item.kind !== 'meat' && item.kind !== 'fuel')) return item.price;
  const m = C.DAY_PRICE[se.day | 0];
  return typeof m === 'number' ? Math.round(item.price * m) : item.price;
}
function meatRoomNow() { return typeof sim.meatRoom === 'function' ? sim.meatRoom() : Infinity; }

// A meat or charcoal stepper. With extras (the week's shop sheet) it also shows have-{id} and after-{id},
// a coin before the price and a dark box around the count (P-16), and on the charcoal row a +5 button.
// Q-2: with a booking's rail, a meat row also says how many of its plates the pile covers.
function cartRow(item, extras, rail) {
  const isMeat = item.kind === 'meat';
  const price = mk('span', { cls: 'price' });
  let priceNum = null, priceCoin = null;
  if (extras) {
    priceCoin = coinEl(2);
    priceNum = mk('span', { cls: 'pn' });
    if (priceCoin) price.appendChild(priceCoin);
    price.appendChild(priceNum);
  }
  const press = function (d) {
    return function () {
      const r = sim.buy(item.id, d);
      sheetMsg = r && r.ok === false && r.message ? String(r.message) : '';
      afterAct();
    };
  };
  const dec = btn('dec-' + item.id, '-', 'alt', press(-1));
  dec.setAttribute('aria-label', 'Fewer ' + item.label);
  const qty = mk('span', { id: 'qty-' + item.id, text: '0' });
  const inc = btn('inc-' + item.id, '+', 'alt', press(1));
  inc.setAttribute('aria-label', 'More ' + item.label);
  // P-16: twenty bags in four taps instead of sixteen (the sim clamps by cash and the pile's cap).
  const inc5 = extras && !isMeat ? btn('inc5-' + item.id, U('inc5'), 'alt', press(5)) : null;
  if (inc5) inc5.setAttribute('aria-label', U('inc5Aria'));
  const step = mk('span', { cls: 'step' + (inc5 ? ' step5' : '') }, [dec, qty, inc, inc5]);
  const name = nameCell(item, isMeat || item.kind === 'fuel');
  let have = null, after = null, covers = null;
  const want = isMeat && rail ? rail[item.id] | 0 : 0;
  if (extras) {
    have = mk('span', { id: 'have-' + item.id, cls: 'have' });
    after = mk('span', { id: 'after-' + item.id, cls: 'have' });
    if (want > 0) covers = mk('span', { id: 'covers-' + item.id, cls: 'have covers' });
    name.appendChild(mk('span', { cls: 'haves' }, [have, after, covers]));
  }
  // v3.4 review: in the morning shop for a Yard day, a meat the booked event needs says so ("Sat needs 2").
  const bn = extras && isMeat && sheetFrom === 'morning' && shopKind !== 'event' && typeof sim.bookingNeeds === 'function' ? sim.bookingNeeds() : null;
  const nu = bn && bn.units[item.id] > 0 ? bn.units[item.id] : 0;
  if (nu > 0) {
    const d = String(bn.dayShort || '');
    const tag = mk('span', { id: 'need-' + item.id, cls: 'needtag', text: d.charAt(0) + d.slice(1).toLowerCase() + ' needs ' + nu });
    name.insertBefore(tag, name.querySelector('.effect'));
  }
  const row = mk('div', { cls: 'row' }, [name, price, step]);
  rowSink.push(function () {
    const s = sim.state;
    const isWood = item.id === 'wood';   // v4.1: wood splits for the stick burner and the trailer
    const q = isMeat ? (s.cart.meat[item.id] | 0) : (isWood ? s.cart.wood | 0 : s.cart.charcoal | 0);
    const owned = isMeat ? (s.stock[item.id] | 0) : (isWood ? s.wood | 0 : s.charcoal | 0);
    const locked = lockedBy(item, s);
    const remaining = cartRoom(s);
    const up = unitPrice(item, s);
    const cap = isMeat ? q + owned >= C.STEPPER_MAX || meatRoomNow() <= 0
      : q + owned >= (isWood ? C.WOOD_MAX : (typeof C.CHARCOAL_MAX === 'number' ? C.CHARCOAL_MAX : C.STEPPER_MAX));
    if (priceNum) {
      priceNum.textContent = locked ? item.needsText : String(up);
      if (priceCoin) priceCoin.hidden = locked;
    } else {
      price.textContent = locked ? item.needsText : String(up);
    }
    price.classList.toggle('muted', locked || remaining < up);
    price.style.whiteSpace = locked ? 'normal' : '';
    qty.textContent = String(q);
    dec.disabled = locked || q <= 0;
    inc.disabled = locked || cap || remaining < up;
    if (inc5) inc5.disabled = inc.disabled;
    step.hidden = locked;
    if (have) {
      have.textContent = U('youHave', { n: owned });
      after.textContent = isMeat ? U('afterUnits', { n: owned + q }) : (isWood ? U('afterSplits', { n: owned + q }) : U('afterBags', { n: owned + q }));
      have.hidden = locked;
      after.hidden = locked;
    }
    if (covers) {
      const p = (owned + q) * MEATS[item.id].plates;
      covers.textContent = U('covers', { p: Math.min(p, want), r: want });
      covers.classList.toggle('short', p < want);
    }
  });
  return row;
}

// A gear or decor row: bought at once, one of each, Owned once bought.
function ownRow(item) {
  const isDecor = item.kind === 'decor';
  const price = mk('span', { cls: 'price' });
  const name = nameCell(item, false);
  const eff = name.querySelector('.effect');
  // v4.1: a ladder row also says what it does for the crew.
  if (item.tier > 0 && Array.isArray(C.TIER_SLOTS) && Array.isArray(C.TIER_PAYROLL) && STRINGS.ui.tierSlots) {
    name.appendChild(mk('span', { id: 'slots-' + item.id, cls: 'effect tierslots', text: U('tierSlots', { a: C.TIER_SLOTS[item.tier - 1], b: C.TIER_SLOTS[item.tier], p: C.TIER_PAYROLL[item.tier - 1], q: C.TIER_PAYROLL[item.tier] }) }));
  }
  const row = mk('div', { cls: 'row', attrs: { 'data-item': item.id } }, [name, price]);
  let ctl = null, ctlOwned = null, ctlArmed = null;
  rowSink.push(function () {
    const s = sim.state;
    const isOwned = (isDecor ? s.decor : s.gear)[item.id] === true;
    const locked = lockedBy(item, s);
    // R-1: the sim's own rule (sim.js R-1), so a buy the sim allows is never a dead button.
    const chk = typeof sim.canBuy === 'function' ? sim.canBuy(item.id) : null;
    const canPay = chk ? chk.ok : s.cash - sim.cartTotal() >= item.price;
    const after = chk ? chk.left : s.cash - sim.cartTotal() - item.price;
    const reserve = typeof C.GEAR_RESERVE === 'number' ? C.GEAR_RESERVE : 0;
    const bk = s.loop === 'week' && s.season ? s.season.booking : null;
    const booked = !!(bk && bk.type !== 'yard');
    // v3.5: the String lights row names the time it adds to every cook ("serve after dark").
    const pitRow = item.id === 'lights' && STRINGS.pit && typeof STRINGS.pit.lightsRow === 'string' ? fill(STRINGS.pit.lightsRow, { n: C.LIGHTS_SECONDS | 0 }) : '';
    const baseEff = pitRow && String(item.effect || '').indexOf(pitRow) < 0 ? (item.effect ? item.effect + ' ' : '') + pitRow : item.effect;
    const effText = (!isOwned && !locked && canPay && !booked && after < reserve)
      ? baseEff + ' Leaves ' + after + '. A day of meat and charcoal is about ' + reserve + '.'
      : baseEff;
    if (eff && eff.textContent !== effText) eff.textContent = effText;
    price.textContent = (locked && !isOwned) ? item.needsText : String(item.price);
    price.classList.toggle('muted', isOwned || locked || !canPay);
    price.style.whiteSpace = (locked && !isOwned) ? 'normal' : '';
    // Feedback audit item 22: Buy spends at once, so the first tap only arms the row ("Buy for N?")
    // with Confirm and Back, as the morning shop does. Only Confirm calls sim.buy.
    if (isOwned || locked || !canPay) { if (armedBuy === item.id) armedBuy = null; }
    const armed = !isOwned && armedBuy === item.id;
    if (ctl === null || ctlOwned !== isOwned || ctlArmed !== armed) {
      const hadFocus = !!(ctl && ctl.contains(document.activeElement));
      if (ctl) row.removeChild(ctl);
      if (isOwned) {
        ctl = mk('span', { id: 'buy-' + item.id, cls: 'muted', text: 'Owned' });
      } else if (armed) {
        const ok = btn('buy-' + item.id + '-ok', 'Confirm', 'primary', function () { armedBuy = null; sim.buy(item.id, 1); afterAct(); });
        ok.setAttribute('aria-label', 'Confirm: buy ' + item.label + ' for ' + item.price);
        const no = btn('buy-' + item.id + '-back', 'Back', 'alt', function () { armedBuy = null; afterAct(); const b = document.getElementById('buy-' + item.id); if (b) b.focus(); });
        no.setAttribute('aria-label', 'Back, do not buy ' + item.label);
        ctl = mk('span', { cls: 'buy-arm', attrs: { role: 'group', 'aria-label': 'Buy ' + item.label + ' for ' + item.price + '?' } },
          [mk('span', { cls: 'buy-ask', text: 'Buy for ' + item.price + '?' }), no, ok]);
      } else {
        ctl = btn('buy-' + item.id, 'Buy', 'primary', function () { armedBuy = item.id; afterAct(); const o = document.getElementById('buy-' + item.id + '-ok'); if (o) o.focus(); });
        ctl.setAttribute('aria-label', 'Buy ' + item.label);
      }
      ctlOwned = isOwned; ctlArmed = armed;
      row.appendChild(ctl);
      if (hadFocus && !isOwned) { const f = armed ? ctl.querySelector('.primary') : ctl; if (f) f.focus(); }
    }
    if (!isOwned && !armed) ctl.disabled = locked || !canPay;
  });
  return row;
}

function goalRow(item) {
  const price = mk('span', { cls: 'price muted', text: String(item.price) });
  const name = nameCell(item, false);
  const row = mk('div', { cls: 'row' }, [name, price]);
  rowSink.push(function () {
    const s = sim.state;
    const locked = lockedBy(item, s);
    const eff = name.querySelector('.effect');
    if (eff) eff.textContent = item.effect + (locked && item.needsText ? ' ' + item.needsText : '');
    price.textContent = String(item.price);
  });
  return row;
}

function onOpen() {
  const r = sim.openGate();
  pump();
  if (!r.ok && clip) clip.why.textContent = r.message || sim.canOpen().reason;
}

// ---------------------------------------------------------------- till and the report (W17.4)

function openTill(focusId) {
  tillFit = 0;
  buildTill();
  if (currentPanel !== 'till') openPanel('till', focusId);
  else if (focusId) focusOr(focusId, el['till-h']);
  fitTill();
}

// X13.6, deviation 52: while the report is taller than two screens, rfit1 to rfit3 apply in order.
function fitTill() {
  const w = el.till;
  if (!w || w.hidden || el.panels.hidden) return;
  const t = sim.state.till;
  if (!t || (t.kind !== 'booking' && t.kind !== 'yard')) return;
  const a = document.activeElement;
  const id = a && a.id && w.contains(a) ? a.id : null;
  const lim = 2 * (window.innerHeight || 812);
  let lvl = 0;
  if (tillFit !== 0) { tillFit = 0; buildTill(); }
  while (w.scrollHeight > lim && lvl < 3) { lvl++; tillFit = lvl; buildTill(); }
  if (id) { const f = document.getElementById(id); if (f && f !== document.activeElement) f.focus(); }
}

// Signed money for the till. Zero prints as 0 with no sign (round 2 finding).
function plus(n) { return n > 0 ? '+' + n : '0'; }
function minus(n) { return n > 0 ? '-' + n : '0'; }

function tillRow(label, detail, amount, cls) {
  const name = mk('span', { cls: 'name' }, [label, detail ? mk('span', { cls: 'effect', text: detail }) : null]);
  const price = mk('span', { cls: 'price', text: amount });
  return mk('div', { cls: 'row' + (cls ? ' ' + cls : '') }, [name, price]);
}

// A report row: the amount green when it adds, red when it takes.
function repRow(label, detail, amount, cls) {
  const r = tillRow(label, detail, amount, cls);
  const a = String(amount);
  const p = r.querySelector('.price');
  if (/^\+/.test(a)) p.classList.add('up');
  else if (/^-/.test(a)) p.classList.add('down');
  return r;
}

// A cream framed box with its title set into the top border (screen-4-report).
function repBox(id, title, cls, titleIcon) {
  const box = mk('section', { id: id, cls: 'rbox' + (cls ? ' ' + cls : '') });
  if (title) {
    const t = mk('h3', { id: id + '-t', cls: 'rt' });
    if (titleIcon) t.appendChild(titleIcon);
    uiPut(t, title, 2, UI.gold);
    box.appendChild(t);
    box.setAttribute('aria-labelledby', id + '-t');
  }
  return box;
}

function nextLabel() {
  const s = sim.state;
  if (loopOf(s) === 'tutorial') return U('cont');
  // v3.2 playtest: a cook day before Sunday ends the day, not the week.
  const se = s.season;
  if (se && Array.isArray(se.dayLog) && typeof se.day === 'number' && se.day < (C.WEEK_DAYS || 7) - 1) return U('nextDay');
  const done = s.season && s.season.results ? s.season.results.length : 0;
  return done >= (C.SEASON_WEEKS || 7) ? U('seeSeason') : U('nextWeek');
}
function nextButton() {
  const label = nextLabel();
  const b = mk('button', { id: 'next', cls: 'primary big', type: 'button', on: onNext });
  uiPut(b, label.toUpperCase(), 3, UI.creamL, { bold: true, shadow: UI.orangeLo }, label);
  return b;
}
function tillNewButton() { return btn('till-new', 'New game', 'alt', function () { openConfirm('till'); }); }

function buildTill() {
  const s = sim.state;
  const t = s.till;
  const body = el['till-body'];
  const head = el['till-h'];
  clear(body);
  clear(head);
  head.className = '';
  el.till.classList.remove('booking', 'yardday');
  for (let k = 1; k <= 3; k++) el.till.classList.toggle('rfit' + k, tillFit >= k);
  const oldTop = document.getElementById('rep-top');
  if (oldTop && oldTop.parentNode) oldTop.parentNode.removeChild(oldTop);
  if (!t) {
    head.textContent = 'Till';
    body.appendChild(nextButton());
    body.appendChild(tillNewButton());
    return;
  }
  const kind = t.kind || 'tutorial';
  if (kind === 'comp' || (kind === 'booking' && t.comp)) buildCompReport(t, head, body);   // deviation 72, [S 19.9]
  else if (kind === 'booking') buildBookingReport(t, head, body);
  else if (kind === 'yard') buildYardReport(t, head, body);
  else buildTutorialTill(t, head, body);
  // v3.5: the pitmaster XP this cook earned, and a level up (its Long Day pick waits on the week hub).
  if ((t.pitXp | 0) > 0 && STRINGS.pit) {
    let line = fill(STRINGS.pit.gain || '+{n} pitmaster XP', { n: t.pitXp | 0 });
    if (t.pitLevel && t.pitLevel.to) line += '. ' + fill(STRINGS.pit.levelUp || 'Level {n}!', { n: t.pitLevel.to | 0 });
    body.insertBefore(mk('p', { id: 'rep-pit', cls: 'muted rep-pit', text: line }), body.firstChild);
  }
}

// W22.24: the header row above the title: week, pit name and cash.
function repTop(t) {
  const s = sim.state;
  const top = mk('div', { id: 'rep-top' });
  // Q-8: the week and the cash in the UI font, as the pit name beside them.
  // v3.2 playtest: the header names the day the report closes ("Week 1, Mon").
  const di = typeof t.dayIdx === 'number' ? t.dayIdx : (s.season && Array.isArray(s.season.dayLog) ? s.season.day : null);
  const dw = typeof di === 'number' && dayNameOf(di) ? ', ' + dayNameOf(di).slice(0, 3) : '';
  top.appendChild(uiPut(mk('span', { cls: 'rw' }), U('hudWeek', { w: t.week || (s.season ? s.season.week : 1) }) + dw, 2, UI.cream));
  const pit = mk('span', { cls: 'rp' });
  uiPut(pit, pitName(s).toUpperCase(), 2, UI.creamDim, null, pitName(s));
  top.appendChild(pit);
  const cash = mk('span', { cls: 'rc' });
  const coin = coinEl(2);
  if (coin) cash.appendChild(coin);
  cash.appendChild(uiPut(mk('span', { cls: 'rcv' }), fmt(typeof t.cashAfter === 'number' ? t.cashAfter : s.cash), 2, UI.gold, { bold: true }));
  top.appendChild(cash);
  return top;
}

// Deviation 32 with playtest round 1 (P-10): the title band is #till-h itself, a dusk sky over a lawn
// about 150 px tall like screen-4-report: the event label in cream over a large gold DONE, and a row
// of v2 guests, the buddy and the event icon standing on the grass. The words stay one .sr span with
// the W15 title, so #till-h reads "{label}: done". R-9: at 1 or 2 stars (low) the word is cream and
// only the event icon stands on the grass.
function heroHead(head, t, title, low) {
  head.className = 'hero' + (low ? ' low' : '');
  const type = t.kind === 'yard' ? 'yard' : (t.booking && t.booking.type) || (t.type) || bookingType(t);
  const tt = mk('span', { cls: 'ht' });
  const room = Math.min(480, (document.documentElement.clientWidth || 375) - 16) - 32;
  const cut = title.lastIndexOf(': ');
  const lead = cut > 0 ? title.slice(0, cut + 1) : '';
  const word = cut > 0 ? title.slice(cut + 2) : title;
  const top = lead ? uiCanvas(lead.toUpperCase(), 2, UI.creamL, { shadow: UI.K }) : null;
  let big = null;
  for (let sc = tillFit >= 1 ? 4 : 6; sc >= 3 && !big; sc--) {
    const c = uiCanvas(word.toUpperCase(), sc, low ? UI.creamL : UI.gold, { bold: true, shadow: UI.K });
    if (c && parseFloat(c.style.width) <= room) big = c;
  }
  if ((lead ? top : true) && big && (!top || parseFloat(top.style.width) <= room)) {
    if (top) { top.classList.add('ht-lead'); tt.appendChild(top); }
    big.classList.add('ht-word');
    tt.appendChild(big);
    tt.appendChild(mk('span', { cls: 'sr', text: title }));
  } else {
    uiPut(tt, title, 2, low ? UI.creamL : UI.gold, { bold: true, shadow: UI.K });
  }
  head.appendChild(tt);
  const crowd = mk('span', { cls: 'hero-row', attrs: { 'aria-hidden': 'true' } });
  // X13.7 and Overseer item 46: the buddy on the grass is the RUN card that worked, in its own look;
  // with no RUN card at the event, nobody stands there.
  const runner = runWorked(t);
  if (runner && runner.look) ensureCrewLook('run', runner.look);
  const cast = low ? [['ev_' + type, 0]] : [['cust0_down', 0], ['cust1_down', 0], ['ev_' + type, 0], ['cust2_down', 0]];
  if (!low && runner) cast.push(['buddy_down', 0]);
  for (let i = 0; i < cast.length; i++) {
    const c = sprEl(cast[i][0], cast[i][1], tillFit >= 1 ? 2 : 3, null);   // X13.6 step 1: a 96 px hero
    if (c) { if (cast[i][0] === 'ev_' + type) c.classList.add('hero-ic'); crowd.appendChild(c); }
  }
  head.appendChild(crowd);
}
// The booking type of a till (its label maps back to a BookingId).
function bookingType(t) {
  const b = STRINGS.booking || {};
  for (const k in b) if (b[k] === t.label) return k;
  return 'yard';
}

function coolerLines(parent, t) {
  const s = sim.state;
  const after = t.coolerAfter || s.stock;
  const list = railList(after, 'label');
  parent.appendChild(mk('p', { id: 'rep-cooler', text: list ? U('cooler', { list: list }) : U('coolerNothing') }));
  const bags = typeof t.charcoalAfter === 'number' ? t.charcoalAfter : s.charcoal;
  parent.appendChild(mk('p', { id: 'rep-charcoal', text: U1(bags, 'charcoalLeftOne', 'charcoalLeft') }));
  const n = sumCounts(t.spoiled);
  const cap = typeof t.coolerCap === 'number' ? t.coolerCap : (typeof sim.coolerCap === 'function' ? sim.coolerCap() : 0);
  const none = t.spoilReason === 'nocooler' || (t.spoilReason !== 'full' && cap === 0);
  const sp = mk('p', { id: 'rep-spoil', cls: 'bad', text: n > 0 ? (none ? U('spoilNone', { n: n }) : U('spoilFull', { cap: cap, n: n })) : '' });
  sp.hidden = n === 0;
  parent.appendChild(sp);
}

// P-10: the word of mouth box shows the change, the new number and what it was, so the narrow column
// no longer wraps a sentence; the W15 line rides along as the box's .sr text.
function fansBox(t, booking) {
  // The narrow box takes its title inside, a few words a line (the mock's one word "Fans" fit the border).
  const box = mk('section', { id: 'rep-fans', cls: 'rbox fans', attrs: { 'aria-labelledby': 'rep-fans-t' } });
  const title = U('fansH');
  const th = mk('h3', { id: 'rep-fans-t', cls: 'rt-in' });
  const words = title.split(' ');
  let line = '';
  const lines = [];
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i];
    if (line && next.length > 7) { lines.push(line); line = words[i]; } else line = next;
  }
  if (line) lines.push(line);
  let drawn = true;
  for (let i = 0; i < lines.length; i++) {
    const c = uiCanvas(lines[i], 2, UI.gold);
    if (!c) { drawn = false; break; }
    th.appendChild(c);
  }
  if (drawn) th.appendChild(mk('span', { cls: 'sr', text: title }));
  else { clear(th); uiPut(th, title, 2, UI.gold); }
  box.appendChild(th);
  const d = t.repDelta | 0;
  const heart = sprEl('heart', 0, 4, null);
  if (heart) { heart.classList.add('fan-heart'); box.appendChild(heart); }
  const big = mk('p', { cls: 'fan-d ' + (d >= 0 ? 'up' : 'down') });
  uiPut(big, signed(d), 4, d >= 0 ? UI.green : UI.red, { shadow: '#0d0a08' });
  box.appendChild(big);
  const now = mk('p', { cls: 'fan-now', attrs: { 'aria-hidden': 'true' } });
  uiPut(now, String(t.repEnd | 0), 3, UI.creamL, { shadow: '#0d0a08' });
  box.appendChild(now);
  box.appendChild(mk('p', { cls: 'fan-was', attrs: { 'aria-hidden': 'true' }, text: U('fansWas', { a: t.repStart | 0 }) }));
  box.appendChild(mk('p', { cls: 'fan-line sr', text: U('fansLine', { a: t.repStart, b: t.repEnd }) }));
  const why = booking ? U1(t.stars | 0, 'fansReasonOne', 'fansReason', { d: signed(d) }) : U('fansServes');
  box.appendChild(mk('p', { cls: 'fan-why', text: why }));
  return box;
}

function buildBookingReport(t, head, body) {
  const s = sim.state;
  const stars = Math.max(1, Math.min(5, t.stars | 0));
  el.till.classList.add('booking');
  el.till.insertBefore(repTop(t), head);
  heroHead(head, t, U(stars <= 2 ? 'reportHLow' : 'reportH', { label: t.label }), stars <= 2);
  body.appendChild(mk('p', { id: 'rep-meta' }, [
    mk('span', { text: U('host', { name: t.host || '' }) }),
    mk('span', { text: STRINGS.venue && STRINGS.venue.backyard ? STRINGS.venue.backyard : 'Backyard' })
  ]));

  // Score and stars (no letter grade, W21 item 22).
  const score = repBox('rep-score', null, 'gold');
  score.setAttribute('data-stars', String(stars));
  const num = mk('div', { cls: 'score-num' });
  num.appendChild(mk('span', { cls: 'score-l', text: U('score') }));
  const sn = mk('span', { cls: 'score-v' });
  uiPut(sn, String(t.score | 0), 4, UI.creamL, { shadow: UI.K });
  num.appendChild(sn);
  score.appendChild(num);
  const right = mk('div', { cls: 'score-r' });
  const row = mk('p', { cls: 'stars-row', attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < 5; i++) {
    const st = starEl(i < stars, 2);
    if (st) { st.setAttribute('data-on', i < stars ? '1' : '0'); row.appendChild(st); }
  }
  right.appendChild(row);
  right.appendChild(mk('p', { cls: 'of5', text: U('of5', { n: stars }) }));
  score.appendChild(right);
  body.appendChild(score);

  // The three parts of [S 5.4], titled like the mock (P-10).
  const parts = repBox('rep-parts', U('howWent'), 'parts');
  const P = t.parts || { fed: 0, wait: 0, quality: 0 };
  const defs = [['fed', 'partFed', C.SCORE_FED || 60, 'fed'], ['wait', 'partWait', C.SCORE_WAIT || 20, 'wait'], ['quality', 'partQuality', C.SCORE_QUALITY || 20, 'qual']];
  for (let i = 0; i < defs.length; i++) {
    const p = Math.max(0, P[defs[i][0]] | 0), max = defs[i][2];
    const r = mk('div', { id: 'rep-' + defs[i][0], cls: 'part' });
    r.appendChild(mk('span', { cls: 'pl', text: U(defs[i][1]) }));
    const bar = mk('span', { cls: 'segs ' + defs[i][3], attrs: { 'aria-hidden': 'true' } });
    const on = Math.round(10 * Math.min(1, p / max));
    for (let k = 0; k < 10; k++) bar.appendChild(mk('span', { cls: 'seg' + (k < on ? ' on' : '') }));
    r.appendChild(bar);
    r.appendChild(mk('span', { cls: 'pv', text: U('partOf', { p: p, max: max }) }));
    parts.appendChild(r);
  }
  body.appendChild(parts);

  // W22.8: fed + walked out + missed is the headcount. P-1 and P-2: why guests missed, and cold plates.
  const w = (t.walkouts | 0) + (t.close | 0);
  let res = U('result', { f: t.fed | 0, b: t.booked | 0, w: w, s: t.avgWait | 0 });
  if ((t.missed | 0) > 0) res += ' ' + U(t.soldOutMiss ? 'missedOutLine' : 'missedLine', { n: t.missed | 0 });
  // Q-3: the fix already for sale, when the line held three.
  if ((t.missed | 0) > 0 && !t.soldOutMiss && s.gear.bigtable !== true) res += ' ' + U('missedTable');
  if ((t.cold | 0) > 0) res += ' ' + U1(t.cold | 0, 'coldLineOne', 'coldLine');
  body.appendChild(mk('p', { id: 'rep-result', text: res }));

  // Money, with word of mouth beside it. X13.6 (carry-forward 4): the compact table shows, with every
  // v3.0 row one tap away under rep-money-more in rep-money-detail.
  const mf = mk('div', { cls: 'money-fans' });
  const money = repBox('rep-money', U('money'), 'money', coinEl(2));
  compactBookingRows(money, t, stars);
  money.appendChild(moneyMoreButton());
  mf.appendChild(money);
  mf.appendChild(fansBox(t, true));
  body.appendChild(mf);
  const detail = repBox('rep-money-detail', null, 'money detail');
  detail.hidden = !moneyMore;
  fullBookingRows(detail, t, stars);
  body.appendChild(detail);

  // X13.6: the crew box right after the money and word of mouth boxes ([S 8] item 4).
  const crew = crewBox(t);
  if (crew) body.appendChild(crew);

  // What the host said (R-11: beside a framed guest head), then the word of mouth third (X13.6).
  const host = repBox('rep-host', U('hostH'), 'host');
  const says = STRINGS.hostSays && STRINGS.hostSays[stars - 1] ? STRINGS.hostSays[stars - 1] : '';
  host.appendChild(hostQuote(t, fill(says, { name: profileName(s) })));
  const third = typeof t.third === 'number' ? t.third : 0;
  const ht = mk('p', { id: 'rep-host-third', cls: 'host3', text: third > 0 && STRINGS.hostThird ? fill(STRINGS.hostThird[third] || '', { name: profileName(s) }) : '' });
  ht.hidden = !(third > 0);
  host.appendChild(ht);
  const tl = thirdLine(t);
  if (tl) host.appendChild(tl);
  body.appendChild(host);

  const inv = repBox('rep-inv', U('inventory'), 'plain');
  coolerLines(inv, t);
  body.appendChild(inv);
  body.appendChild(nextButton());
}

// X13.6: the third the event moved word of mouth into, or null when it stayed.
function thirdLine(t) {
  if (typeof t.third !== 'number' || typeof t.thirdTo !== 'number' || t.thirdTo === t.third) return null;
  const edges = C.THIRD_EDGES || [34, 67];
  const up = t.thirdTo > t.third;
  const text = up ? UA('thirdUp', t.thirdTo) : U('thirdDown', { edge: edges[Math.max(0, Math.min(1, t.thirdTo))] });
  return mk('p', { id: 'rep-third', cls: 'third ' + (up ? 'up' : 'down'), text: text });
}

// The Show every row control (aria-expanded) over rep-money-detail; it toggles in place.
function moneyMoreButton() {
  const b = btn('rep-money-more', moneyMore ? U('moneyLess') : U('moneyMore'), 'alt', function () {
    moneyMore = !moneyMore;
    const d = document.getElementById('rep-money-detail');
    if (d) d.hidden = !moneyMore;
    b.textContent = moneyMore ? U('moneyLess') : U('moneyMore');
    b.setAttribute('aria-expanded', moneyMore ? 'true' : 'false');
  });
  b.classList.add('more');
  b.setAttribute('aria-expanded', moneyMore ? 'true' : 'false');
  b.setAttribute('aria-controls', 'rep-money-detail');
  return b;
}

// Week start for the ledger rows: the till's cashStart, else the season's week cash.
function ledgerStart(t) {
  const se = sim.state.season || {};
  return typeof t.cashStart === 'number' ? t.cashStart : (typeof se.weekCash === 'number' ? se.weekCash : null);
}
function crewSpentOf(t) { return Math.max(0, t.crewSpent | 0); }
function crewPaidRow(t) {
  return repRow(U('rowCrewPaid'), Array.isArray(t.crewPaid) ? t.crewPaid.join(', ') : '', minus(crewSpentOf(t)));
}
// The stock the cook kept (dir 1, the money is in the pile and cooler) or drew on, so the column adds up.
function stockRow(t, start, gear) {
  const stock = (t.cashAfter | 0) - start - (t.net | 0) + gear + crewSpentOf(t);
  if (stock < 0) return tillRow(U('rowKept'), stockMoved(t, 1), minus(-stock), 'info');
  if (stock > 0) return tillRow(U('rowDrawn'), stockMoved(t, -1), plus(stock), 'info');
  return null;
}
function takeRow(t, label, detail) {
  const take = repRow(label, detail, signed(t.net | 0), 'net');
  // Q-3: Take today in the UI font at 3x, gold on its band (the words stay as the .sr text).
  const tp = take.querySelector('.price');
  if (tp) { clear(tp); uiPut(tp, signed(t.net | 0), 3, UI.gold, { shadow: '#0d0a08' }); }
  return take;
}

// X13.6 carry-forward 4: Fee (detail the deposit), Tips and bonus, Costs, Take today, then Gear bought,
// Signing and send-off and the stock row when they are not 0, and Cash. Week start + Take + Gear +
// Signing and send-off + the stock row = Cash. Review 1: the crew's wages come out of Costs onto their
// own row with the names (so bringing the crew shows its price), and Costs carries no detail line.
function compactBookingRows(box, t, stars) {
  const feeAt = Math.round((t.fee | 0) * (C.PAY_BASE + C.PAY_PER_STAR * stars));
  box.appendChild(repRow(U1(stars, 'rowFeeOne', 'rowFee'), U('deposit', { d: t.deposit | 0 }), plus(feeAt)));
  const extras = (t.tips | 0) + (t.seatTips | 0) + (t.addon ? t.menuBonus | 0 : 0);
  box.appendChild(repRow(U('rowExtras'), '', plus(extras)));
  const costs = (t.foodCost | 0) + (t.rawWaste | 0) + (t.bags | 0) * C.CHARCOAL_PRICE + woodCost(t) + (t.spoilCost | 0) + dailyOf(t);
  box.appendChild(repRow(U('rowCosts'), '', minus(costs)));
  if ((t.wages | 0) > 0) box.appendChild(repRow(U('rowWages'), t.wageNames && t.wageNames.length ? t.wageNames.join(', ') : '', minus(t.wages | 0)));
  box.appendChild(takeRow(t, U('rowTake'), ''));
  const start = ledgerStart(t);
  const gear = t.gearSpent | 0;
  if (gear > 0) box.appendChild(repRow(U('rowGear'), (t.gearBought || []).join(', '), minus(gear)));
  if (crewSpentOf(t) > 0) box.appendChild(crewPaidRow(t));
  if (start !== null) { const sr = stockRow(t, start, gear); if (sr) box.appendChild(sr); }
  box.appendChild(repRow(U('rowCash'), start !== null ? U('cashFrom', { a: fmt(start) }) : '', fmt(t.cashAfter)));
}

// Every v3.0 row (W17.4 with P-10, R-4 and Q-3), for rep-money-detail.
function fullBookingRows(money, t, stars) {
  const feeAt = Math.round((t.fee | 0) * (C.PAY_BASE + C.PAY_PER_STAR * stars));
  const seated = t.seated | 0;
  const food = (t.foodCost | 0) + (t.rawWaste | 0);
  money.appendChild(repRow(U1(stars, 'rowFeeOne', 'rowFee'), '', plus(feeAt)));
  money.appendChild(repRow(U('rowDeposit'), '', String(t.deposit | 0), 'info'));
  money.appendChild(repRow(U('rowTips'), '', plus(t.tips | 0)));
  if (t.addon) money.appendChild(repRow(U('rowMenuBonus'), MEATS[t.addon] ? MEATS[t.addon].label : '', plus(t.menuBonus | 0)));
  if ((t.seatTips | 0) > 0 || seated > 0) money.appendChild(repRow(U('rowSeatTips'), seated + ' sat down', plus(t.seatTips | 0)));
  money.appendChild(repRow(U('rowFood'), '', minus(food)));
  money.appendChild(repRow(U('rowCharcoal'), plural(t.bags | 0, 'bag', 'bags'), minus((t.bags | 0) * C.CHARCOAL_PRICE)));
  if ((t.splits | 0) > 0) money.appendChild(repRow(U('rowWood'), plural(t.splits | 0, 'split', 'splits'), minus(woodCost(t))));
  if ((t.wages | 0) > 0) money.appendChild(repRow(U('rowWages'), t.wageNames && t.wageNames.length ? t.wageNames.join(', ') : '', minus(t.wages | 0)));
  money.appendChild(repRow(U('rowDaily'), 'ice and trash bags', minus(dailyOf(t))));
  if ((t.spoilCost | 0) > 0) money.appendChild(repRow(U('rowSpoiled'), meatList(t.spoiled), minus(t.spoilCost | 0)));
  if ((t.wasteCost | 0) > 0) {
    const thrown = [];
    if ((t.wastePlates | 0) > 0) thrown.push(plural(t.wastePlates | 0, 'plate', 'plates'));
    if ((t.wasteBurnt | 0) > 0) thrown.push((t.wasteBurnt | 0) + ' burnt');
    money.appendChild(repRow(U('rowThrown'), (thrown.length ? thrown.join(' and ') + ', ' : '') + U('counted'), String(t.wasteCost | 0), 'info'));
  }
  if ((t.grateCost | 0) > 0) money.appendChild(repRow(U('rowGrate'), meatList(t.grateLeft) + ', ' + U('counted'), String(t.grateCost | 0), 'info'));
  if ((t.burnt | 0) > 0) money.appendChild(repRow(U('rowBurnt'), plural(t.burnt | 0, 'piece', 'pieces'), ''));
  money.appendChild(takeRow(t, U('rowTake'), U('takeDetail')));
  // R-4: week start + Take - gear + what the cook kept or drew on = Cash. Q-3: the stock row is an
  // information row (the money is in the pile and cooler, or was paid in an earlier week), its amount
  // signed so the column still adds up. Deviation 50: Signing and send-off joins when it is not 0.
  const start = ledgerStart(t);
  const gear = t.gearSpent | 0;
  if (gear > 0) money.appendChild(repRow(U('rowGear'), (t.gearBought || []).join(', '), minus(gear)));
  if (crewSpentOf(t) > 0) money.appendChild(crewPaidRow(t));
  if (start !== null) { const sr = stockRow(t, start, gear); if (sr) money.appendChild(sr); }
  money.appendChild(repRow(U('rowCash'), start !== null ? U('cashFrom', { a: fmt(start) }) : '', fmt(t.cashAfter)));
}

// The report's crew box (X13.6): a row per lineup card with its portrait, name, mood, XP, the till
// row's line and Level up while a level is banked; resting cards share one line; notices and leavers.
function crewBox(t) {
  const rows = Array.isArray(t.crew) ? t.crew : [];
  const left = Array.isArray(t.left) ? t.left : [];
  if (!rows.length && !left.length) return null;
  const box = repBox('rep-crew', U('crewH'), 'crewbox');
  // The title's id leaves the rep-crew-{id} pattern to the rows.
  const bt = box.querySelector('h3');
  if (bt) { bt.id = 'crew-box-t'; box.setAttribute('aria-labelledby', 'crew-box-t'); }
  const need = C.LEVEL_XP || 200;
  const rested = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.worked) { rested.push(r.name); continue; }
    const role = roleOf(r.role);
    const live = crewCard(r.id);
    const look = live && live.look ? live.look : (lookCache.get(r.id) || null);
    const row = mk('div', { id: 'rep-crew-' + r.id, cls: 'rc-row r-' + role });
    const pic = mk('span', { cls: 'rc-pic', attrs: { 'aria-hidden': 'true' } });
    const bust = portraitEl(look, role, 1);
    if (bust) pic.appendChild(bust);
    row.appendChild(pic);
    // Review 1: the name, the face and the XP meter on one line; the till row's sentence; then the
    // mood words, the wage and a gold Level up chip on one short line.
    const main = mk('div', { cls: 'rc-main' });
    const top = mk('div', { cls: 'rc-top' });
    top.appendChild(roleBadge(role, 'sm'));
    top.appendChild(mk('span', { cls: 'rc-name', text: r.name }));
    const face = mk('span', { cls: 'rc-face', attrs: { role: 'img', 'aria-label': U('moodAria', { name: r.name, mood: moodWord(r.moodTo) }), 'data-mood': String(clampMood(r.moodTo)) } });
    const mc = moodEl(r.moodTo, 2);
    if (mc) face.appendChild(mc);
    top.appendChild(face);
    const xp = live ? live.xp | 0 : r.xp | 0;
    const xr = mk('div', { cls: 'rc-xp' });
    xr.appendChild(segMeter('rep-crew-' + r.id + '-xp', xp, need, U('xp', { x: xp, max: need })));
    xr.appendChild(mk('span', { cls: 'rc-xpt', attrs: { 'aria-hidden': 'true' }, text: U('xp', { x: xp, max: need }) }));
    top.appendChild(xr);
    main.appendChild(top);
    main.appendChild(mk('p', { id: 'rep-crew-' + r.id + '-line', cls: 'rc-line', text: r.line || '' }));
    const sub = mk('div', { cls: 'rc-sub' });
    const moved = clampMood(r.moodFrom) !== clampMood(r.moodTo);
    sub.appendChild(mk('span', { cls: 'rc-mood' + (moved ? (clampMood(r.moodTo) > clampMood(r.moodFrom) ? ' up' : ' down') : ''), text: moved ? U('moodWas', { mood: moodWord(r.moodTo), was: moodWord(r.moodFrom) }) : moodWord(r.moodTo) }));
    const wage = live ? live.wage | 0 : 0;
    if (wage > 0) sub.appendChild(mk('span', { cls: 'rc-wage', text: U('wageRow', { w: wage }) }));
    const banked = live ? live.banked | 0 : 0;
    if (banked > 0) {
      const lv = pixBtn('rep-crew-' + r.id + '-level', U('levelUp'), 'alt lvl', function () {
        openCard({ mode: 'level', key: r.id, from: 'till', opener: 'rep-crew-' + r.id + '-level' });
      }, 22, { color: '#FFD23F', shadow: '#0d0a08' });
      sub.appendChild(lv);
    }
    main.appendChild(sub);
    row.appendChild(main);
    box.appendChild(row);
  }
  if (rested.length) box.appendChild(mk('p', { id: 'rep-rested', cls: 'rc-rest', text: U('rested', { list: andList(rested) }) }));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.notice && crewCard(r.id)) box.appendChild(mk('p', { id: 'rep-notice-' + r.id, cls: 'bad', text: U('noticeLine', { name: r.name }) }));
  }
  if (left.length) box.appendChild(mk('p', { id: 'rep-left', cls: 'bad', text: left.map(function (x) { return U('leftLine', { name: x.name }); }).join(' ') }));
  return box;
}

// The RUN row that worked this event ({ id, look }), or null (Overseer item 46). A till with no crew
// rows (a v3.0 sim) keeps the v3.0 buddy.
function runWorked(t) {
  if (!t || !Array.isArray(t.crew)) return { id: null, look: null };
  for (let i = 0; i < t.crew.length; i++) {
    const r = t.crew[i];
    if (r && r.worked && r.role === 'run') {
      const c = crewCard(r.id);
      return { id: r.id, look: c && c.look ? c.look : (lookCache.get(r.id) || null) };
    }
  }
  return null;
}

// Q-3: what the pile and cooler gained (dir 1) or gave up (dir -1) over the cook, as "15 bags, 2 Sausage".
function stockMoved(t, dir) {
  const parts = [];
  if (typeof t.charcoalStart === 'number' && typeof t.charcoalAfter === 'number') {
    const d = (t.charcoalAfter - t.charcoalStart) * dir;
    if (d > 0) parts.push(plural(d, 'bag', 'bags'));
  }
  if (typeof t.woodStart === 'number' && typeof t.woodAfter === 'number') {   // v4.1
    const d = (t.woodAfter - t.woodStart) * dir;
    if (d > 0) parts.push(plural(d, 'split', 'splits'));
  }
  const a = t.coolerAfter || {}, b = t.stockStart || null;
  if (b) {
    const moved = {};
    for (let i = 0; i < MEAT_IDS.length; i++) {
      const m = MEAT_IDS[i];
      const d = ((a[m] | 0) - (b[m] | 0)) * dir;
      if (d > 0) moved[m] = d;
    }
    const ml = meatList(moved);
    if (ml) parts.push(ml);
  }
  return parts.join(', ');
}

// R-11: the host's words in a bubble beside a framed v2 guest head (screen-4-report's portrait).
function hostQuote(t, words) {
  const row = mk('div', { cls: 'host-row' });
  const av = mk('span', { cls: 'host-av', attrs: { 'aria-hidden': 'true' } });
  const names = STRINGS.names || [];
  const i = Math.max(0, names.indexOf(t.host || ''));
  const head = sprEl('cust' + (i % 4) + '_down', 0, 2, null);
  if (head) av.appendChild(head);
  row.appendChild(av);
  row.appendChild(mk('p', { cls: 'bubble', text: words }));
  return row;
}

function buildYardReport(t, head, body) {
  el.till.classList.add('yardday');
  el.till.insertBefore(repTop(t), head);
  heroHead(head, t, U('reportH', { label: bookingLabel('yard') }));
  const mf = mk('div', { cls: 'money-fans' });
  const money = repBox('rep-money', U('money'), 'money', coinEl(2));
  const start = ledgerStart(t);
  const cashDetail = start !== null ? U('cashFrom', { a: fmt(start) }) : '';
  // X13.6: Served, Tips and bonus, Take today, Gear bought and Signing and send-off when they apply,
  // Paid at the shop and Cash; every v2.1 row under Show every row (deviation 50).
  // v4.0 economy: the take comes after the meat, charcoal, spoilage and daily costs the cook used and
  // the wages (half on a weekday Yard day), as on a booking; the stock row makes the column reach Cash.
  money.appendChild(repRow('Served', plural(t.served | 0, 'plate', 'plates'), plus(t.revenue | 0)));
  money.appendChild(repRow(U('rowExtras'), '', plus((t.tips | 0) + (t.seatTips | 0))));
  money.appendChild(repRow(U('rowCosts'), U('costsDetail'), minus(yardCosts(t))));
  if ((t.wages | 0) > 0) money.appendChild(repRow(U('rowWages'), wagesDetail(t), minus(t.wages | 0)));
  money.appendChild(takeRow(t, U('rowTake'), U('yardTake')));
  const gear = t.gearSpent | 0;
  if (gear > 0) money.appendChild(repRow(U('rowGear'), (t.gearBought || []).join(', '), minus(gear)));
  if (crewSpentOf(t) > 0) money.appendChild(crewPaidRow(t));
  if (start !== null) { const sr = stockRow(t, start, gear); if (sr) money.appendChild(sr); }
  money.appendChild(repRow(U('rowCash'), cashDetail, fmt(t.cashAfter)));
  money.appendChild(moneyMoreButton());
  mf.appendChild(money);
  mf.appendChild(fansBox(t, false));
  body.appendChild(mf);
  const detail = repBox('rep-money-detail', null, 'money detail');
  detail.hidden = !moneyMore;
  tutorialRows(detail, t, cashDetail);
  body.appendChild(detail);
  const tl = thirdLine(t);
  if (tl) body.appendChild(tl);
  const crew = crewBox(t);
  if (crew) body.appendChild(crew);
  const inv = repBox('rep-inv', U('inventory'), 'plain');
  coolerLines(inv, t);
  body.appendChild(inv);
  body.appendChild(nextButton());
  const people = repBox('rep-people', 'People', 'plain');
  people.appendChild(mk('p', { text: peopleLine(t) }));
  body.appendChild(people);
}

// v4.0 economy: what a Yard day's cook used, besides wages: meat cooked or thrown out raw, charcoal
// burnt, tonight's spoilage and the daily costs.
// v4.4: the day's daily costs (a weekday Yard day is a half shift: C.YARD_DAY_COSTS).
function dailyOf(t) { return t && typeof t.daily === 'number' ? t.daily : C.DAILY_COSTS; }

function yardCosts(t) {
  return (t.foodCost | 0) + (t.rawWaste | 0) + (t.bags | 0) * C.CHARCOAL_PRICE + woodCost(t) + (t.spoilCost | 0) + dailyOf(t);
}
// v4.1: the wood splits a cook burnt, at the list price.
function woodCost(t) { return (t.splits | 0) * (C.WOOD_PRICE | 0); }
function wagesDetail(t) {
  const names = t.wageNames && t.wageNames.length ? t.wageNames.join(', ') : '';
  return t.halfShift ? (names ? names + ', ' : '') + U('halfShift') : names;
}

// The v2.1 till rows (the tutorial day and the Yard day). R-4: the food, charcoal, spoiled, thrown
// out and grate rows are information (the shop took that money before the gate), and Gear bought and
// Paid at the shop sit above Cash, so cash at the start + Take - gear - shop = Cash.
function tutorialRows(box, t, cashDetail) {
  if (t.kind === 'yard') { yardDetailRows(box, t, cashDetail); return; }
  const wages = t.wageNames && t.wageNames.length ? t.wageNames.join(', ') : 'none';
  const spoiled = meatList(t.spoiled) || 'nothing';
  const grate = meatList(t.grateLeft) || 'nothing';
  const seated = t.seated | 0;
  box.appendChild(repRow('Served', plural(t.served, 'plate', 'plates'), plus(t.revenue)));
  box.appendChild(repRow('Tips', '', plus(t.tips)));
  box.appendChild(repRow('Seat tips', seated + ' sat down', plus(t.seatTips | 0)));
  box.appendChild(repRow('Food cost (what you cooked)', '', String(t.foodCost | 0), 'info'));
  box.appendChild(repRow('Charcoal used', plural(t.bags, 'bag', 'bags'), String((t.bags | 0) * C.CHARCOAL_PRICE), 'info'));
  box.appendChild(repRow('Wages', wages, minus(t.wages)));
  box.appendChild(repRow('Daily costs', 'ice and trash bags', minus(dailyOf(t))));
  box.appendChild(repRow('Spoiled overnight', spoiled, String(t.spoilCost | 0), 'info'));
  box.appendChild(repRow('Thrown out', plural(t.wastePlates, 'plate', 'plates') + ', ' + t.wasteBurnt + ' burnt', String(t.wasteCost | 0), 'info'));
  box.appendChild(repRow('Left on the grate', grate, String(t.grateCost | 0), 'info'));
  box.appendChild(repRow('Burnt today', plural(t.burnt || 0, 'piece', 'pieces') + ', costed in the two rows above', ''));
  box.appendChild(repRow('Take today', 'sales and tips after wages and daily costs', signed(t.net), 'net'));
  const gear = t.gearSpent | 0;
  if (gear > 0) box.appendChild(repRow(U('rowGear'), (t.gearBought || []).join(', '), minus(gear)));
  if (crewSpentOf(t) > 0) box.appendChild(crewPaidRow(t));
  if (typeof t.cashStart === 'number') box.appendChild(repRow(U('rowShop'), '', minus(t.cashStart + (t.net | 0) - gear - crewSpentOf(t) - (t.cashAfter | 0))));
  box.appendChild(repRow('Cash', cashDetail || '', fmt(t.cashAfter)));
}

// v4.0 economy: every Yard day row under Show every row. The cook's costs count against the take,
// and the stock row (bought for later, or bought earlier) makes the column reach Cash.
function yardDetailRows(box, t, cashDetail) {
  const seated = t.seated | 0;
  box.appendChild(repRow('Served', plural(t.served, 'plate', 'plates'), plus(t.revenue)));
  box.appendChild(repRow('Tips', '', plus(t.tips)));
  box.appendChild(repRow('Seat tips', seated + ' sat down', plus(t.seatTips | 0)));
  box.appendChild(repRow(U('rowFood'), '', minus((t.foodCost | 0) + (t.rawWaste | 0))));
  box.appendChild(repRow(U('rowCharcoal'), plural(t.bags | 0, 'bag', 'bags'), minus((t.bags | 0) * C.CHARCOAL_PRICE)));
  if ((t.splits | 0) > 0) box.appendChild(repRow(U('rowWood'), plural(t.splits | 0, 'split', 'splits'), minus(woodCost(t))));
  if ((t.wages | 0) > 0) box.appendChild(repRow(U('rowWages'), wagesDetail(t), minus(t.wages | 0)));
  box.appendChild(repRow(U('rowDaily'), 'ice and trash bags', minus(dailyOf(t))));
  if ((t.spoilCost | 0) > 0) box.appendChild(repRow(U('rowSpoiled'), meatList(t.spoiled), minus(t.spoilCost | 0)));
  if ((t.wasteCost | 0) > 0) box.appendChild(repRow('Thrown out', plural(t.wastePlates, 'plate', 'plates') + ', ' + (t.wasteBurnt | 0) + ' burnt, ' + U('counted'), String(t.wasteCost | 0), 'info'));
  if ((t.grateCost | 0) > 0) box.appendChild(repRow('Left on the grate', (meatList(t.grateLeft) || 'nothing') + ', ' + U('counted'), String(t.grateCost | 0), 'info'));
  box.appendChild(repRow(U('rowTake'), U('yardTake'), signed(t.net), 'net'));
  const start = ledgerStart(t);
  const gear = t.gearSpent | 0;
  if (gear > 0) box.appendChild(repRow(U('rowGear'), (t.gearBought || []).join(', '), minus(gear)));
  if (crewSpentOf(t) > 0) box.appendChild(crewPaidRow(t));
  if (start !== null) { const sr = stockRow(t, start, gear); if (sr) box.appendChild(sr); }
  box.appendChild(repRow(U('rowCash'), cashDetail || '', fmt(t.cashAfter)));
}

function peopleLine(t) {
  const soldOut = Math.max(0, Math.min(t.past, pastSoldOut));
  const seated = t.seated | 0;
  return 'Came to the gate ' + t.customers + '. Served ' + t.served + '. Sat down ' + seated +
    '. Took it to go ' + (t.togo | 0) + '. Walked out ' + t.walkouts +
    '. Walked past (line full) ' + (t.past - soldOut) + '.' + (soldOut > 0 ? ' Looked in, sold out ' + soldOut + '.' : '') +
    ' Left at close ' + t.close + '.';
}

// The tutorial day keeps every v2.1 row and paragraph and gains the cooler lines (W17.4).
function buildTutorialTill(t, head, body) {
  head.textContent = 'Day ' + t.day + ' till';
  const rows = mk('div', { cls: 'rbox plain tut-rows' });
  tutorialRows(rows, t);
  body.appendChild(rows);
  body.appendChild(mk('p', { cls: 'muted', text: 'Food, charcoal and spoilage were paid at the shop. They are listed so you can see where the money went.' }));
  // Review 1 (sim.js floorAfterTutorial): the practice day never costs the season.
  if (loopOf(sim.state) === 'tutorial') body.appendChild(mk('p', { id: 'tut-floor', cls: 'gold', text: U('tutorialFloor', { c: fmt(Math.max(sim.state.cash | 0, C.START_CASH | 0)) }) }));
  const inv = mk('div', { cls: 'rbox plain' });
  coolerLines(inv, t);
  body.appendChild(inv);
  body.appendChild(nextButton());
  body.appendChild(h3('People'));
  body.appendChild(mk('p', { text: peopleLine(t) }));
  body.appendChild(h3('Word of mouth'));
  body.appendChild(mk('p', { text: 'Word of mouth ' + t.repStart + ' to ' + t.repEnd }));
  const happy = t.happy | 0, togoQuick = t.togoQuick | 0, ok = t.ok | 0, walkouts = t.walkouts | 0;
  const capped = t.repCapped ? ', capped at ' + signed(t.repMax) + ' / ' + C.REP_DAY_MIN + ' for the day' : '';
  body.appendChild(mk('p', {
    text: '+' + (happy * C.REP_QUICK) + ' from ' + plural(happy, 'quick serve', 'quick serves') + ' at a seat, +' +
      (togoQuick * C.REP_TOGO_QUICK) + ' from ' + plural(togoQuick, 'quick serve', 'quick serves') + ' to go, +' +
      (ok * C.REP_OK) + ' from ' + plural(ok, 'other serve', 'other serves') + ', -' +
      (walkouts * Math.abs(C.REP_WALKOUT)) + ' from ' + plural(walkouts, 'walk-out', 'walk-outs') + capped
  }));
  body.appendChild(tillNewButton());
}

// W5.1 finishReport(): the tutorial till leads to the creator; a report to the next week or the season end.
function onNext() {
  if (sim.state.phase !== 'evening') return;
  sim.finishReport();
  clearFx();
  dogReset(2);
  pump();
  showLoop();
  pump();
  updateDom();
}

// ---------------------------------------------------------------- broke card

function openBroke() {
  buildBroke();
  if (currentPanel !== 'broke') openPanel('broke');
}

// The Broke test of [spec 11], on state fields only, used as a fallback for
// showing Keep going in case the sim leaves state.broke for continueFromBroke.
function brokeTest(s) {
  let units = 0;
  for (let i = 0; i < MEAT_IDS.length; i++) units += s.stock[MEAT_IDS[i]] | 0;
  const bag = C.CHARCOAL_PRICE;
  const unit = MEATS.sausage ? MEATS.sausage.unit : 4;
  return (s.charcoal === 0 && s.cash < bag) || (units === 0 && s.cash < unit + (s.charcoal === 0 ? bag : 0));
}

function buildBroke() {
  const s = sim.state;
  const body = el['broke-body'];
  el['broke-h'].textContent = 'Broke';
  clear(body);
  body.appendChild(mk('p', { text: "You can't buy meat and charcoal for today." }));
  body.appendChild(mk('p', { text: 'Sell gear back at half price, or start over.' }));
  body.appendChild(mk('p', { cls: 'muted', text: 'Cash ' + s.cash + '.' }));
  let any = false;
  const kinds = ['gear', 'decor'];
  for (let k = 0; k < kinds.length; k++) {
    const kind = kinds[k];
    const ownedSet = kind === 'gear' ? s.gear : s.decor;
    for (let i = 0; i < CATALOG.length; i++) {
      const item = CATALOG[i];
      if (item.kind !== kind || ownedSet[item.id] !== true) continue;
      any = true;
      const price = Math.floor(item.price * C.SELL_BACK);
      body.appendChild(mk('div', { cls: 'row' }, [
        mk('span', { cls: 'name', text: item.label }),
        btn('sell-' + item.id, 'Sell for ' + price, 'alt', (function (id) {
          return function () {
            sim.sell(id);
            pump();
            buildBroke();
            const kp = document.getElementById('broke-keep');
            if (kp) kp.focus(); else el['broke-h'].focus();
          };
        })(item.id))
      ]));
    }
  }
  if (!any) body.appendChild(mk('p', { cls: 'muted', text: 'Nothing left to sell.' }));
  if (!s.broke || !brokeTest(s)) {
    body.appendChild(btn('broke-keep', 'Keep going', 'primary', function () {
      sim.continueFromBroke();
      pump();
      if (!sim.state.broke) showLoop();
    }));
  }
  body.appendChild(btn('broke-over', 'Start over', 'alt', function () { openConfirm('broke'); }));
}

// ---------------------------------------------------------------- the week hub (W17.2)

function openWeek() {
  dropSheet();
  buildWeekAt(weekFit);
  if (currentPanel !== 'week') openPanel('week');
  fitWeek();
}

// W22.25: the hub fits two screens; while it is taller, the shrink steps apply in order (deviation 40).
let weekFit = 0, weekFitSig = '';
function buildWeek() {
  buildWeekAt(weekFit);
  fitWeek();
}
// What changes the hub's height; the fit runs again only when this changes (one build a tap otherwise).
function weekSig(s) {
  const se = s.season || {};
  const inv = typeof sim.inventory === 'function' ? sim.inventory() : null;
  let meats = 0;
  if (inv && inv.meat) for (let i = 0; i < MEAT_IDS.length; i++) if ((inv.meat[MEAT_IDS[i]] | 0) > 0) meats++;
  const o = se.booking;
  const rail = o && o.type !== 'yard' && typeof sim.railFor === 'function' ? sim.railFor(o, se.addon || null) : null;
  const rl = rail ? MEAT_IDS.filter(function (m) { return (rail[m] | 0) > 0; }).length : 0;
  const ng = typeof sim.nextGear === 'function' ? sim.nextGear() : null;   // v4.4
  const nextGear = ng ? ng.id : '';
  const g = sim.goal();
  const cl = typeof sim.canLoadUp === 'function' ? sim.canLoadUp() : { ok: false, reason: '' };
  return [(se.offers || []).map(function (x) { return x.id + (x.needs ? '!' : ''); }).join(','), o ? (o.type === 'yard' ? 'y' : 'b') : '', rl, meats,
    inv ? (inv.over > 0 || (inv.cap === 0 && inv.units > 0)) : '', inv ? inv.wood > 0 : '', nextGear, g ? g.id : '',
    !!s.comingNext, s.day >= C.RAIN_FROM_DAY, cl.ok ? '' : cl.reason, window.innerHeight, document.documentElement.clientWidth,
    rail ? !!mixHint(rail) : '', se.week | 0, !!s.gear.bigtable,   // R-7, R-3, Q-4: the hint line and the finale news lines
    typeof sim.fanThird === 'function' ? sim.fanThird() : 0,     // X13.6: #third-line and the notice lines
    crewList().filter(function (c) { return c.notice; }).map(function (c) { return c.id; }).join('.'),
    daySig(s), hubTab, planOpen, restartArm, hubSig(), planSig()].join('|');
}
function fitWeek() {
  const w = el.week;
  if (!w || w.hidden || el.panels.hidden) return;
  const sig = weekSig(sim.state);
  if (sig === weekFitSig) return;
  const a = document.activeElement;
  const id = a && a.id && w.contains(a) ? a.id : null;
  // Joel 2026-10-20: on desktop the side panel fits the window itself (no scrolling), so the shrink
  // steps run until #week fits one window height, not two.
  const desk = !!(mqDesktop && mqDesktop.matches);
  const lim = desk ? (window.innerHeight || 820) - 12 : 2 * (window.innerHeight || 812);
  let lvl = 0;
  if (weekFit !== 0) buildWeekAt(0);
  // D8.2 with the v3.2 playtest: steps 6 and 7 (index.html) come first; step 8 swaps each plain day
  // hint for its one line dayHintShort; step 9 hides the plain hints. A greyed option's reason or a
  // spoil warning (.why) never hides. Step 5 is now a no-op. Step 9 stays only when it makes the hub
  // fit: hiding the hints of a hub that is over either way would leave bare buttons for nothing.
  while (w.scrollHeight > lim && lvl < 8) { lvl++; buildWeekAt(lvl); }
  if (w.scrollHeight > lim) {
    buildWeekAt(9);
    if (w.scrollHeight > lim) buildWeekAt(8); else lvl = 9;
  }
  if (id) { const f = document.getElementById(id); if (f && f !== document.activeElement) f.focus(); }
  weekFit = lvl;
  weekFitSig = sig;
}

// One line of an offer or the next event card: an aria-hidden icon and its words.
function iconLine(icon, text, cls) {
  const p = mk('p', { cls: 'oline' + (cls ? ' ' + cls : '') });
  if (icon) p.appendChild(icon);
  p.appendChild(document.createTextNode(text));
  return p;
}
function peopleIcon() { return pixCanvas(PIX.people.map, PIX.people.pal, 2); }
function pinIcon() { return pixCanvas(PIX.pin.map, PIX.pin.pal, 2); }
// ui.pay as "Pay", the coin, then the number large: textContent stays "Pay {fee}" (deviation 28).
function payInto(parent, fee) {
  const parts = (STRINGS.ui.pay || 'Pay {fee}').split('{fee}');
  parent.appendChild(document.createTextNode(parts[0]));
  const coin = coinEl(2);
  if (coin) parent.appendChild(coin);
  parent.appendChild(mk('b', { cls: 'fee', text: String(fee) }));
  if (parts[1]) parent.appendChild(document.createTextNode(parts[1]));
  return parent;
}
// The largest integer scale (at most 4) at which a sprite fits the box.
function fitScale(name, maxW, maxH) {
  const sz = size(name);
  return Math.max(1, Math.min(4, Math.floor(maxW / sz[0]), Math.floor(maxH / sz[1])));
}

function buildWeekAt(level) {
  const s = sim.state;
  for (let k = 1; k <= 9; k++) el.week.classList.toggle('fit' + k, level >= k);
  const se = s.season || { year: 1, week: 1, offers: [], booking: null, addon: null, results: [] };
  const w = se.week || 1;
  const yr = se.year || 1;
  const pit = pitName(s);
  const top = el['week-top'], body = el['week-body'], foot = el['week-foot'];
  clear(top); clear(body); clear(foot);
  // R-6: from season 2 the heading and the season label carry the season number.
  el['week-h'].textContent = pit + ', ' + (yr > 1 ? U('weekOfYear', { y: yr, w: w }) : U('weekOf', { w: w }));

  // Header: the pit sign, then Week N of 9 with the season label and the pips (screen-3-week).
  const head = mk('div', { cls: 'wk-row' });
  const sign = mk('div', { id: 'week-sign', cls: 'sign' });
  signWords(sign, pit, 0.55, el.week);
  head.appendChild(sign);
  const lab = mk('div', { cls: 'wk-lab' });
  lab.appendChild(uiPut(mk('p', { id: 'week-label' }), U('weekOf', { w: w }).toUpperCase(), 2, UI.white, { bold: true, shadow: UI.navyD }, U('weekOf', { w: w })));
  lab.appendChild(mk('p', { id: 'week-when', text: yr > 1 ? U('seasonWhen', { y: yr, when: weekWhen(w) }) : weekWhen(w) }));
  // Q-5: no pip bar; the season strip below carries the weeks (screen-1-season has no pips).
  head.appendChild(lab);
  top.appendChild(head);

  // Pills: cash and word of mouth with the thirds bar (Q-5: the UI font, as screen-3-week).
  const pills = mk('div', { cls: 'pills' });
  pills.appendChild(mk('div', { id: 'week-cash', cls: 'pill' }, [coinEl(2), pillLabel(U('cash')), pillValue(fmt(s.cash))]));
  const third = typeof sim.fanThird === 'function' ? sim.fanThird() : 0;
  const thirdName = STRINGS.thirdName ? STRINGS.thirdName[third] : '';
  const thirds = mk('div', { id: 'week-thirds', attrs: { role: 'img', 'aria-label': U('fansAria', { n: s.rep, third: thirdName }) } });
  for (let i = 0; i < 3; i++) thirds.appendChild(mk('span', { cls: 'seg' + (i === third ? ' on' : '') }));
  pills.appendChild(mk('div', { id: 'week-fans', cls: 'pill' }, [sprEl('heart', 0, 2, null), pillLabel(U('fans')), pillValue(String(s.rep)), thirds]));
  top.appendChild(pills);
  // X13.6 carry-forward 2: the third word of mouth is in and what it brings, one line under the pills.
  // v3.4 review: cut under the Start button hub (the Word of mouth pill carries it in its label).
  const startHub = !!(dayView(s) && typeof sim.recommendDay === 'function' && sim.recommendDay());
  if (!startHub) {
    const tl = mk('p', { id: 'third-line', cls: 'muted t' + third, text: UA('thirdNow', third) });
    tl.hidden = !tl.textContent;
    top.appendChild(tl);
  }

  // The season strip (v3.4: on the Season tab).
  const strip = mk('ol', { id: 'season-strip', attrs: { 'aria-label': U('stripAria', { y: se.year || 1 }) } });
  const n = C.SEASON_WEEKS || 7;
  for (let i = 1; i <= n; i++) strip.appendChild(stripTile(se, i, n));

  // v3.4 playtest ("too many options", "not clear how to start a day"): the day strip, the broke
  // rescue when cash cannot cover today, then ONE big Start button with the game's pick and a small
  // Change plan link for the other choice. Everything else sits below it on three tabs.
  const dv = dayView(s);
  const goEls = goControls(s, se, dv);
  const rv = dv && typeof sim.recommendDay === 'function' ? sim.recommendDay() : null;
  const pv = planViewOf(s);
  if (dv) body.appendChild(dayStrip(se));
  if (pv) {
    // v3.5: Monday's week planner takes the Start button's place (Start week, Skip to the weekend).
    body.appendChild(plannerCard(pv));
    body.appendChild(pitCard());
    goEls[0].hidden = true;
  } else if (rv) {
    body.appendChild(startCard(se, rv));
    body.appendChild(pitCard());
    const rq = rescueCard(s);   // v3.4 review: under the one Start button, plain buttons only
    if (rq) body.appendChild(rq);
    goEls[0].hidden = true;   // the Start button loads up on the booked day
  } else if (dv) {
    body.appendChild(dayChoice(se, dv, goEls));
  }
  const hubOn = !!(rv || pv);
  const tabs = hubTabs(hubOn);
  if (hubOn) body.appendChild(tabs.bar);

  // The phone rings: this week's offers.
  const offers = mk('section', { id: 'offers', attrs: { 'aria-labelledby': 'offers-h' } });
  const oh = mk('div', { cls: 'offers-head' });
  oh.appendChild(uiPut(mk('h3', { id: 'offers-h' }), U('thisWeek').toUpperCase(), 3, UI.white, { bold: true, shadow: UI.ink }, U('thisWeek')));
  // v3.4 review: with the Start button, the Yard day card goes (a weekday choice now) and a picked
  // booking folds to one line ("Birthday Sat, pay 120") with the other offers behind See offers.
  const list = rv ? (se.offers || []).filter(function (o) { return o.type !== 'yard'; }) : (se.offers || []);
  const pickedId = se.booking ? se.booking.id : null;
  const pickedO = rv && se.booking && se.booking.type !== 'yard' ? se.booking : null;
  if (offersWeek !== (se.week | 0)) { offersOpen = false; offersWeek = se.week | 0; }
  const gridOpen = !pickedO || offersOpen;
  if (list.length > 1 && !se.loadin && gridOpen) oh.appendChild(mk('span', { cls: 'pick-one', text: U('pickOne') }));   // R-8; not once Load-in locked it
  offers.appendChild(oh);
  if (pickedO) {
    const d = STRINGS.dayShort && typeof pickedO.day === 'number' ? String(STRINGS.dayShort[pickedO.day]) : '';
    const day = d ? ' ' + d.charAt(0) + d.slice(1).toLowerCase() : '';
    const money = pickedO.comp ? fill((STRINGS.comp && STRINGS.comp.entry) || 'Entry {n}', { n: pickedO.comp.entry | 0 }).toLowerCase() : 'pay ' + (pickedO.pay | 0);
    const line = mk('div', { cls: 'offer-line' });
    line.appendChild(mk('p', { id: 'offer-line', text: pickedO.label + day + ', ' + money }));
    const more = mk('button', { id: 'offers-more', cls: 'linkish', type: 'button', text: offersOpen ? 'Hide offers' : 'See offers' });
    more.setAttribute('aria-expanded', offersOpen ? 'true' : 'false');
    more.setAttribute('aria-controls', 'offer-grid');
    more.addEventListener('click', function () { offersOpen = !offersOpen; rebuildKeepFocus(buildWeek, 'week'); });
    line.appendChild(more);
    offers.appendChild(line);
  }
  const grid = mk('div', { id: 'offer-grid', cls: 'offer-grid' });
  grid.hidden = !gridOpen;
  for (let i = 0; i < list.length; i++) grid.appendChild(offerCard(list[i], pickedId, level, i));
  offers.appendChild(grid);
  const tWeek = tabs.panel('week'), tPit = tabs.panel('pit'), tSeason = tabs.panel('season');
  tWeek.appendChild(offers);

  // Next event and Load up and go.
  tWeek.appendChild(nextCard(s, se, !rv && dv && dv.goHere ? null : goEls));
  const arrTip = typeof sim.canArrange === 'function' && sim.canArrange() ? arrangeTip(se) : null;
  if (arrTip) tWeek.appendChild(arrTip);

  // The 2 by 2 grid of sheets.
  tPit.appendChild(hubGrid(s, se));
  // v3.9: Arrange yard, between days only.
  if (typeof sim.canArrange === 'function' && sim.canArrange()) tPit.appendChild(mk('div', { cls: 'foot-row' }, [btn('pit-arrange', 'Arrange yard', 'alt', enterArrange)]));
  if (TESTER) tPit.appendChild(mk('div', { cls: 'foot-row' }, [btn('pit-tester', 'Tester tools', 'alt', function () { openTester('hub'); })]));   // v4.7, preview only
  const shelf = trophyShelf(s, 'hub-shelf', false);   // deviation 77
  if (shelf) tPit.appendChild(shelf);

  // Inventory and Pit news.
  tPit.appendChild(invCard(s));
  tSeason.appendChild(strip);
  const mc = moneyCard();   // v4.4 the money log
  if (mc) tSeason.appendChild(mc);
  tSeason.appendChild(newsCard(s));
  if (hubOn) { body.appendChild(tWeek); body.appendChild(tPit); body.appendChild(tSeason); }
  else { body.insertBefore(strip, body.firstChild); body.appendChild(tWeek); body.appendChild(tPit); body.appendChild(tSeason); }

  // Controls, New game.
  const how = btn('week-controls', U('controls'), 'alt', function () { openHowto('week-controls'); });
  const fresh = btn('week-new', U('newGame'), 'alt', function () { openConfirm('week'); });
  foot.appendChild(mk('div', { cls: 'foot-row' }, [how, fresh]));
}

// P-13: the pit name on a board sign in bold UI letters at 3x, or 2x when 3x would not fit the share
// of the panel the sign gets (the hub row gives it a little over half, the season end card all of it).
function signWords(sign, pit, share, host) {
  // The panel's content width: the section when it is laid out, else the 320 px desktop column or the phone width.
  const vw = document.documentElement.clientWidth || 375;
  const panel = host && host.clientWidth > 0 ? host.clientWidth - 24 : (vw >= 900 ? 296 : Math.min(480, vw) - 24);
  const room = Math.floor(panel * share) - 32;
  // Joel 2026-10-20: the hub's pit sign is the compact 2x one on desktop, so the side panel fits the window.
  const desk = host === el.week && !!(mqDesktop && mqDesktop.matches);
  const big = fitSign(pit, room, desk ? [2] : [3, 2], UI.signText, { bold: true, shadow: UI.woodX });
  if (big) {
    sign.appendChild(big);
    sign.appendChild(mk('span', { cls: 'sr', text: pit }));
  } else {
    uiPut(sign, pit.toUpperCase(), 2, UI.signText, { bold: true, shadow: UI.woodX }, pit);
  }
  return sign;
}

// A pit name sized to fit `room` CSS px: one line at each scale in `scales`, then two lines at the
// smallest scale split at the space that best balances them, then one line at 1x. Returns a canvas,
// a span holding two stacked canvases, or null when the UI font is unavailable. Long names such as
// "Holy Smokes BBQ Co" (Joel, 2026-10-19) land on two lines instead of running off the board.
function fitSign(text, room, scales, color, opts) {
  const s = String(text).toUpperCase();
  const w = function (c) { return c ? parseFloat(c.style.width) : Infinity; };
  let last = null;
  for (let i = 0; i < scales.length; i++) {
    const c = uiCanvas(s, scales[i], color, opts);
    if (!c) return null;
    last = c;
    if (w(c) <= room) return c;
  }
  const sc = scales[scales.length - 1];
  let best = null;
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] !== ' ') continue;
    const a = s.slice(0, i).trim(), b = s.slice(i + 1).trim();
    if (!a || !b) continue;
    const ca = uiCanvas(a, sc, color, opts), cb = uiCanvas(b, sc, color, opts);
    const m = Math.max(w(ca), w(cb));
    if (!best || m < best.m) best = { ca: ca, cb: cb, m: m };
  }
  if (best && best.m <= room) {
    const box = mk('span', { cls: 'sign2' });
    box.style.display = 'inline-flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.gap = Math.max(2, sc * 2) + 'px';
    box.appendChild(best.ca);
    box.appendChild(best.cb);
    return box;
  }
  const one = uiCanvas(s, 1, color, opts);
  return one && w(one) <= room ? one : last;
}

// Q-5: words in groups of at most `max` characters, a group a line (the pill labels, the fans box).
function wordLines(words, max) {
  const parts = String(words).split(' ');
  const lines = [];
  let line = '';
  for (let i = 0; i < parts.length; i++) {
    const next = line ? line + ' ' + parts[i] : parts[i];
    if (line && next.length > max) { lines.push(line); line = parts[i]; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
// Q-5: a pill's label in the UI font at 2x, a short group of words a line; plain words without uiText.
function pillLabel(words) {
  const sp = mk('span', { cls: 'pl' });
  const lines = wordLines(words, 7);
  const cs = [];
  for (let i = 0; i < lines.length; i++) { const c = uiCanvas(lines[i], 2, '#a9c6ff'); if (!c) { cs.length = 0; break; } cs.push(c); }
  if (!cs.length) { sp.textContent = words; return sp; }
  sp.classList.add('ui');
  for (let i = 0; i < cs.length; i++) sp.appendChild(cs[i]);
  sp.appendChild(mk('span', { cls: 'sr', text: words }));
  return sp;
}
// Q-5: a pill's value in the UI font at 2x, bold with an ink shadow.
function pillValue(str) {
  return uiPut(mk('span', { cls: 'pv' }), str, 2, UI.white, { bold: true, shadow: UI.ink });
}

function stripTile(se, i, n) {
  const res = se.results || [];
  const li = mk('li', { id: 'wk-' + i });
  const inner = mk('div', { cls: 'tin', attrs: { 'aria-hidden': 'true' } });
  const numEl = function (color) { return uiPut(mk('span', { cls: 'tn' }), String(i), 2, color, { shadow: UI.ink }); };
  if (i <= res.length) {
    const r = res[i - 1] || { type: 'yard', stars: 0 };
    li.className = 'wk done' + (i === n ? ' fin' : '');
    li.setAttribute('aria-label', U('wkDone', { w: i, label: bookingLabel(r.type), stars: starsWord(r.type === 'yard' ? 0 : r.stars | 0) }));
    inner.appendChild(numEl(UI.white));
    const badge = mk('span', { cls: 'badge' });
    const ck = checkEl(2);
    if (ck) badge.appendChild(ck);
    inner.appendChild(badge);
    if (r.type !== 'yard') {
      const st = mk('span', { cls: 'tstars' });
      for (let k = 0; k < 5; k++) { const e = starEl(k < (r.stars | 0), 1); if (e) st.appendChild(e); }
      inner.appendChild(st);
    } else {
      const yi = sprEl('ev_yard', 0, 1, null);
      if (yi) { yi.classList.add('tyard'); inner.appendChild(yi); }
    }
  } else if (i === se.week) {
    li.className = 'wk now' + (i === n ? ' fin' : '');
    li.setAttribute('aria-label', U('wkNow', { w: i }));
    inner.appendChild(numEl(UI.K));
    if (i === n) { const cup = sprEl('ev_finale', 0, 2, null); if (cup) inner.appendChild(cup); }
    inner.appendChild(uiPut(mk('span', { cls: 'tnow' }), U('nowTag'), 2, UI.K));
  } else if (i === n) {
    li.className = 'wk fin';
    li.setAttribute('aria-label', U('wkFinale'));
    const cup = sprEl('ev_finale', 0, 2, null);
    if (cup) inner.appendChild(cup);
    // The label one word a line, so it fits the two column tile at the mock's size.
    const lab = mk('span', { cls: 'tfin' });
    const words = weekWhen(n).split(' ');
    for (let k = 0; k < words.length; k++) lab.appendChild(uiPut(mk('span', { cls: 'tfw' }), words[k], 2, UI.gold, { shadow: UI.K }));
    inner.appendChild(lab);
  } else {
    li.className = 'wk later';
    li.setAttribute('aria-label', U('wkLater', { w: i, when: weekWhen(i) }));
    inner.appendChild(numEl(UI.blueL));
    inner.appendChild(uiPut(mk('span', { cls: 'tq' }), '?', 3, UI.blueL, { shadow: UI.ink }));
  }
  li.appendChild(inner);
  return li;
}

function offerCard(o, pickedId, level, idx) {
  const isYard = o.type === 'yard';
  const picked = o.id === pickedId;
  const row1 = isYard && level >= 2;   // W22.25 step 2: the Yard day card on one row
  const cls = 'offer card3' + (isYard ? ' yard' : '') + (row1 ? ' row1' : '') + (o.type === 'finale' ? ' wide' : '') + (picked ? ' picked' : '');
  const card = mk('article', { id: 'offer-' + o.id, cls: cls, attrs: { 'aria-labelledby': 'offer-' + o.id + '-t' } });
  const band = mk('div', { cls: 'band', attrs: { 'aria-hidden': 'true' } });
  if (!isYard && art.has('picnic') && art.has('cust0_down')) {
    band.classList.add('oscene');
    offerScene(band, o, idx | 0, o.type === 'finale', level >= 1);
  } else {
    const ev = sprEl('ev_' + o.type, 0, row1 || (level >= 1 && !isYard) ? 2 : isYard ? 3 : 4, null);
    if (ev) band.appendChild(ev);
  }
  card.appendChild(band);
  // X13.6 and Overseer item 30: SAFE BET, STRETCH or INVITE on booking cards in weeks 1 to 8, on the
  // card's top left corner over the band's fence, so the scene stays in view (deviation 53).
  const tag = offerTag(o);
  if (tag) card.appendChild(tag);
  const dtag = offerDay(o);   // D8.2: SAT or SUN on every booking card
  if (dtag) card.appendChild(dtag);
  const info = mk('div', { cls: 'oinfo' });
  info.appendChild(uiPut(mk('h4', { id: 'offer-' + o.id + '-t', cls: 'olabel' }), o.label, 2, UI.creamL, { shadow: UI.K }));
  if (!isYard && o.host) {
    const parts = (STRINGS.ui.host || 'Host {name}').split('{name}');
    info.appendChild(mk('p', { cls: 'ohost' }, [parts[0], mk('b', { text: o.host }), parts[1] || '']));
  }
  const lines = mk('div', { cls: 'olines' });
  // On one row (W22.25 step 2) the Yard day keeps every W15 line, set as wrapping inline items.
  const pad = row1 ? '' : 'pad';
  if (!o.comp) lines.appendChild(iconLine(peopleIcon(), isYard ? U('walkIns') : U('guests', { n: o.headcount | 0 }), 'ogst'));   // a competition has no guests
  if (isYard) lines.appendChild(iconLine(null, U('yourPick'), pad));
  else for (let i = 0; i < o.menu.length; i++) lines.appendChild(iconLine(sprEl('icon_' + o.menu[i], 0, 2, null), MEATS[o.menu[i]].plateLabel, 'omenu'));
  lines.appendChild(iconLine(pinIcon(), (STRINGS.venue && STRINGS.venue[o.venue]) || 'Backyard', 'ovenue'));
  const fl = mk('p', { cls: 'oline flames' });
  const fx = mk('span', { cls: 'ficons', attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < 3; i++) { const f = flameEl(i < (o.difficulty | 0), row1 ? 1 : 2); if (f) fx.appendChild(f); }
  fl.appendChild(fx);
  fl.appendChild(mk('span', { cls: 'fw d' + (o.difficulty | 0), text: STRINGS.flames ? STRINGS.flames[(o.difficulty | 0) - 1] || '' : '' }));
  lines.appendChild(fl);
  if (isYard) {
    lines.appendChild(iconLine(null, U('perPlate'), pad + ' gold'));
    lines.appendChild(iconLine(null, U('noFee'), pad));
  } else if (o.comp) {
    // A competition has no host and no pay: the entry fee, the prizes and the judges instead.
    const sc = STRINGS.comp || {};
    const pz = o.comp.prizes || [];
    lines.appendChild(iconLine(null, fill(sc.entry || 'Entry {n}', { n: o.comp.entry | 0 }), 'pad gold ocentry'));
    lines.appendChild(iconLine(null, fill(sc.prizes || 'Prizes {a}, {b} and {c}.', { a: pz[0] | 0, b: pz[1] | 0, c: pz[2] | 0 }), 'pad ocprize'));
    const jd = typeof sim.compJudges === 'function' ? sim.compJudges() : [];
    if (jd.length) lines.appendChild(iconLine(null, fill(sc.judges || 'Judges: {list}.', { list: andList(jd) }), 'pad ocjudge'));
  } else {
    lines.appendChild(payInto(mk('p', { cls: 'oline opay' }), o.pay | 0));
    lines.appendChild(iconLine(null, U('deposit', { d: o.deposit | 0 }), 'dep'));
  }
  info.appendChild(lines);
  const needs = mk('p', { id: 'offer-' + o.id + '-needs', cls: 'needs', text: o.needs || '' });
  needs.hidden = !o.needs;
  info.appendChild(needs);
  // R-3: the finale sized to the grate says what the drum smoker would make of it.
  if (o.type === 'finale' && !o.comp && sim.state.gear.drum !== true) {   // v3.3: a competition has no guests
    const big = drumFinale(sim.state);
    if (big && big.headcount > (o.headcount | 0)) info.appendChild(mk('p', { id: 'offer-finale-drum', cls: 'ohint', text: U('finaleDrum', { n: big.headcount, fee: big.pay }) }));
  }
  card.appendChild(info);
  // Joel 2026-10-20: on desktop every booking is one compact row, so its Pick button is the small one.
  card.appendChild(bookButton(o, picked, row1 || !!(mqDesktop && mqDesktop.matches)));
  const shut = picked ? '' : bookShut(o);
  if (shut) { card.classList.add('shut'); card.appendChild(mk('p', { id: 'offer-' + o.id + '-why', cls: 'ohint owhy', text: shut })); }
  return card;
}

// Q-5: an offer card's scene after screen-1-season's bands, from v2 sprites: the back fence over a
// lawn, two guests behind a picnic table with the event icon on it (more tables on the wide finale
// card), a kettle with a puff at the right, and a day tag. Drawn at 2x to the band's width; on the
// 48 px band of fit level 1 and up (short) the same scene is cropped to its middle 22 rows.
function offerScene(band, o, idx, wide, short) {
  const vw = document.documentElement.clientWidth || 375;
  const panel = el.week && el.week.clientWidth > 0 ? el.week.clientWidth - 24 : (vw >= 900 ? 296 : Math.min(480, vw) - 24);
  const cardW = wide || panel < 312 ? panel : Math.floor((panel - 10) / 2);
  const W = Math.max(48, Math.floor((cardW - 16) / 2)), H = short ? 22 : 34, dy = short ? -4 : 0;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const g = off.getContext('2d');
  g.imageSmoothingEnabled = false;
  const draw = function (name, x, y, f) { if (art.has(name)) art.draw(g, name, x, y, Math.max(0, Math.min(art.frames(name) - 1, f | 0)), false); };
  g.fillStyle = '#9ad6ff';
  g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += TILE) { draw('fence_back', x, 2 + dy, 0); draw('lawn_a', x, 18 + dy, (x / TILE) % 3 === 1 ? 1 : 0); }
  // The tables start 18 px in, clear of the day tag; the kettle stands at the right edge.
  const tables = wide ? Math.max(1, Math.min(3, Math.floor((W - 42) / 40))) : 1;
  for (let t = 0; t < tables; t++) {
    const x0 = 18 + t * 40;
    draw('cust' + ((idx + t * 2) % 4) + '_down', x0 - 1, 7 + dy, 0);
    draw('cust' + ((idx + t * 2 + 1) % 4) + '_down', x0 + 17, 7 + dy, 0);
    draw('picnic', x0, 12 + dy, 0);
  }
  draw('ev_' + o.type, 26, 8 + dy, 0);
  if (W >= 70) {   // a narrower band leaves the kettle out rather than stand it on the guests
    draw('kettle', W - 20, 8 + dy, 2);
    draw('smoke', W - 14, 1 + dy, 1);
  }
  const d = dpr();
  const k = Math.max(1, Math.floor(2 * d + 1e-6));
  const cv = document.createElement('canvas');
  cv.width = W * k; cv.height = H * k;
  cv.style.width = (W * k / d) + 'px';
  cv.style.height = (H * k / d) + 'px';
  const vg = cv.getContext('2d');
  vg.imageSmoothingEnabled = false;
  vg.drawImage(off, 0, 0, W, H, 0, 0, W * k, H * k);
  cv.setAttribute('aria-hidden', 'true');
  cv.className = 'px';
  band.appendChild(cv);
}

// The offer's tag (offer-{id}-tag): INVITE on the invite, else STRETCH or SAFE BET by tier; none on the
// finale, the Yard day or week 9 (Overseer item 30). The words are the tag's text (deviation 53).
function offerTag(o) {
  if (!o || o.type === 'yard' || o.type === 'finale') return null;
  const se = sim.state.season || {};
  if ((se.week | 0) > (C.SEASON_WEEKS || 7) - 1) return null;
  const kind = o.invite === true ? 'invite' : (o.tier === 'stretch' || (o.tier === undefined && o.needs) ? 'stretch' : 'safe');
  const key = kind === 'invite' ? 'tagInvite' : kind === 'stretch' ? 'tagStretch' : 'tagSafe';
  const words = U(key);
  if (!words) return null;
  const t = mk('span', { id: 'offer-' + o.id + '-tag', cls: 'otag ' + kind });
  uiPut(t, words, 2, TAG_COLOR[kind], null, words);
  return t;
}

// R-3: the Season finale this save would get with the second kettle and the drum, from the generator.
function drumFinale(s) { return finaleWith(s, { kettle2: true, drum: true }); }
// The Season finale this save would get with its gear plus `extra` (Q-4), from the generator.
function finaleWith(s, extra) {
  const se = s.season;
  if (!se || typeof PitSim.genOffers !== 'function') return null;
  const gear = Object.assign({}, s.gear, extra || {});
  let list = null;
  try {
    list = PitSim.genOffers({ seed: se.seed, year: se.year, week: C.SEASON_WEEKS || 7, rep: s.rep, cash: se.weekCash, gear: gear });
  } catch (e) { list = null; }
  return list && list[0] && list[0].type === 'finale' ? list[0] : null;
}

// Q-4: the two slot meat of a rail that also has a one slot meat, lower case, or ''.
function mixBig(rail) {
  let big = '', small = false;
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const m = MEAT_IDS[i];
    if (!rail || !((rail[m] | 0) > 0)) continue;
    if (MEATS[m].slots >= 2) { if (!big) big = MEATS[m].label.toLowerCase(); } else small = true;
  }
  return big && small ? big : '';
}

// R-7: one two slot meat beside the one slot meats, so the first plates are ready at the gate.
function mixHint(rail) {
  const big = [], small = [];
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const m = MEAT_IDS[i];
    if (!rail || !((rail[m] | 0) > 0)) continue;
    (MEATS[m].slots >= 2 ? big : small).push(MEATS[m].label.toLowerCase());
  }
  if (!big.length || !small.length) return '';
  return U('mixHint', { big: big[0], small: andList(small) });
}

// P-11: Pick and Picked (the commitment is Load up and go); the picked button turns gold with dark
// words and the green check badge, so it reads as a state and not as a second action.
function bookButton(o, picked, small) {
  const word = picked ? U('booked') : U('book');
  const b = mk('button', { id: 'book-' + o.id, cls: 'primary book', type: 'button', attrs: { 'aria-label': U('bookAria', { label: o.label }), 'aria-pressed': picked ? 'true' : 'false' } });
  uiPut(b, word.toUpperCase(), small ? 2 : 3, picked ? UI.K : UI.creamL, picked ? { bold: true } : { bold: true, shadow: UI.orangeLo }, word);
  if (picked) {
    const ck = checkEl(2);
    if (ck) { ck.classList.add('badge'); b.appendChild(ck); }
  }
  const shut = picked ? '' : bookShut(o);
  if (shut) { b.disabled = true; b.setAttribute('aria-describedby', 'offer-' + o.id + '-why'); }
  b.addEventListener('click', function () {
    const r = sim.bookOffer(o.id);
    if (r && !r.ok && r.message) announce(String(r.message));
    afterAct();
  });
  return b;
}

// v3.2 playtest: this week's booking has played (the day log holds the event).
function eventDone(se) { return !!(se && Array.isArray(se.dayLog) && se.dayLog.indexOf('event') !== -1 && se.booking && se.booking.type !== 'yard'); }
// v3.2 playtest: why an offer's Pick is shut (Load-in locked the week, or its day has gone by).
function bookShut(o) {
  const se = sim.state.season;
  if (!se || !Array.isArray(se.dayLog)) return '';
  if (se.loadin) return U('bookLocked');
  if ((typeof o.day === 'number' && o.day < (se.day | 0)) || se.dayLog.indexOf('event') !== -1) return U('bookPast');
  return '';
}

function nextCard(s, se, goEls) {
  const o = se.booking;
  const sec = mk('section', { id: 'next-event', cls: 'next-card', attrs: { 'aria-labelledby': 'next-h' } });
  const head = mk('div', { cls: 'next-head' });
  const nh = eventDone(se) ? U('eventDone') : U('nextEvent');
  head.appendChild(uiPut(mk('h3', { id: 'next-h' }), nh.toUpperCase(), 2, UI.gold, { bold: true, shadow: '#000000' }, nh));
  if (o) {
    const right = mk('span', { cls: 'next-pay' });
    if (o.type === 'yard') right.textContent = U('perPlate');
    else if (o.comp) right.textContent = fill((STRINGS.comp && STRINGS.comp.entry) || 'Entry {n}', { n: o.comp.entry | 0 });   // no pay at a competition
    else payInto(right, o.pay | 0);
    head.appendChild(right);
  }
  sec.appendChild(head);
  const inner = mk('div', { cls: 'next-body' });
  if (o) {
    const pic = mk('div', { cls: 'next-pic band', attrs: { 'aria-hidden': 'true' } });
    const ev = sprEl('ev_' + o.type, 0, 3, null);
    if (ev) pic.appendChild(ev);
    inner.appendChild(pic);
    const txt = mk('div', { cls: 'next-txt' });
    txt.appendChild(mk('p', { cls: 'nl', text: o.label }));
    if (o.type === 'yard') {
      txt.appendChild(iconLine(peopleIcon(), U('walkIns')));
      txt.appendChild(iconLine(null, U('yourPick'), 'pad'));
    } else {
      if (!o.comp) txt.appendChild(iconLine(peopleIcon(), U('guests', { n: o.headcount | 0 })));
      const rail = typeof sim.railFor === 'function' ? sim.railFor(o, se.addon || null) : o.rail;
      for (let i = 0; i < MEAT_IDS.length; i++) {
        const m = MEAT_IDS[i];
        if (rail && (rail[m] | 0) > 0) txt.appendChild(iconLine(sprEl('icon_' + m, 0, 2, null), MEATS[m].plateLabel));
      }
    }
    inner.appendChild(txt);
  }
  sec.appendChild(inner);
  const hint = o && o.type !== 'yard' ? mixHint(typeof sim.railFor === 'function' ? sim.railFor(o, se.addon || null) : o.rail) : '';
  if (hint) sec.appendChild(mk('p', { id: 'next-hint', text: hint }));
  const dep = o && o.comp ? fill((STRINGS.comp && STRINGS.comp.goEntry) || '', { n: o.comp.entry | 0 })
    : o && o.type !== 'yard' ? U('depositLine', { d: o.deposit | 0 }) : U('yardLine');   // a competition has no host deposit
  sec.appendChild(mk('p', { id: 'go-deposit', text: dep }));
  // Review 1: who comes along and what they cost, next to the pay (wages come off the take).
  const lineup = crewList().filter(function (c) { return c.bring; }).sort(byId);
  const wages = payrollNow().now | 0;
  sec.appendChild(mk('p', { id: 'next-crew', cls: 'ncrew', text: lineup.length
    ? U('crewNext', { names: andList(lineup.map(function (c) { return c.name; })), w: wages })
    : U('crewNone') }));
  if (goEls) { sec.appendChild(goEls[0]); sec.appendChild(goEls[1]); }
  return sec;
}

// #go and #go-why. With the day choice (D8.2) and today not the booked day, #go is hidden and #go-why
// names the booked day (ui.goNotToday); a Yard week leaves it empty, since its cook is #day-yard.
function goControls(s, se, dv) {
  const cl = typeof sim.canLoadUp === 'function' ? sim.canLoadUp() : { ok: false, reason: '' };
  const go = mk('button', { id: 'go', cls: 'primary big go', type: 'button' });
  const fl = flameEl(true, 2);
  if (fl) go.appendChild(fl);
  uiPut(go, U('loadUp').toUpperCase(), 2, UI.white, { bold: true, shadow: '#8a3a14' }, U('loadUp'));
  go.disabled = !cl.ok;
  go.addEventListener('click', onGo);
  let why = cl.ok ? '' : String(cl.reason || '');
  if (dv && !dv.goHere) {
    go.hidden = true;
    const bd = bookedDayOf(se);
    why = bd === null ? '' : eventDone(se) ? U('bookPlayed', { day: dayNameOf(bd) }) : U('goNotToday', { day: dayNameOf(bd) });
  }
  return [go, mk('p', { id: 'go-why', cls: 'muted', text: why })];
}

function onGo() {
  const r = sim.loadUp();
  pump();
  if (!r || !r.ok) {
    if (currentPanel === 'week') rebuildKeepFocus(buildWeek, 'week');
    const why = document.getElementById('go-why');
    if (why && r && r.message) why.textContent = String(r.message);
  }
  updateDom();
}

function hubTile(id, cls, title, win, l1, l2, alert) {
  const b = mk('button', { id: id, cls: 'tile ' + cls, type: 'button', attrs: { 'aria-label': title + ', ' + l1 + (l2 ? ', ' + l2 : '') + (alert ? '. ' + alert : '') } });
  const tt = mk('span', { cls: 'tt' });
  uiPut(tt, title.toUpperCase(), 2, UI.white, { bold: true, shadow: 'rgba(0, 0, 0, 0.45)' }, title);
  // X13.6: a red dot on the Crew tile while a card has given notice.
  if (alert) tt.appendChild(mk('span', { cls: 'ndot', attrs: { 'aria-hidden': 'true' } }));
  // P-14: a chevron after the title, as on screen-3-week's tiles (it opens a sheet).
  const chev = pixCanvas(PIX.arrowR.map, PIX.arrowR.pal, 2);
  if (chev) { chev.classList.add('chev'); tt.appendChild(chev); }
  b.appendChild(tt);
  b.appendChild(win);
  b.appendChild(mk('span', { cls: 'l1', text: l1 }));
  b.appendChild(mk('span', { cls: 'l2', text: l2 || '' }));
  b.addEventListener('click', function () { openSheet(cls.replace('t-', ''), id); });
  return b;
}
function tileWin(names, frames) {
  const w = mk('span', { cls: 'win', attrs: { 'aria-hidden': 'true' } });
  const each = Math.max(16, Math.floor(132 / Math.max(1, names.length)));
  for (let i = 0; i < names.length; i++) {
    if (!art.has(names[i])) continue;
    const c = sprEl(names[i], frames ? frames[i] : 0, fitScale(names[i], each, 50), null);   // R-10: 54 px windows
    if (c) w.appendChild(c);
  }
  return w;
}

function hubGrid(s, se) {
  const g = mk('div', { id: 'hub-grid' });
  // Crew (X13.6): the count against the slots, the payroll, and the crew. Review 1: as
  // screen-3-week's tile, up to three portrait busts on their role bands with a mood face in the
  // corner, the lineup first and resting cards dimmed, on a flat ink window.
  const crew = crewList();
  const pay = payrollNow();
  const roleRank = function (c) { return roleIds().indexOf(c.role); };
  const shown = crew.slice().sort(function (a, b) { return (b.bring ? 1 : 0) - (a.bring ? 1 : 0) || roleRank(a) - roleRank(b) || a.id - b.id; });
  const cw = mk('span', { cls: 'win cwin', attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < shown.length && i < 3; i++) {
    const c = shown[i];
    const cell = mk('span', { cls: 'ctw r-' + roleOf(c.role) + (c.bring ? '' : ' resting') });
    const bust = portraitEl(c.look, roleOf(c.role), 2);
    if (bust) cell.appendChild(bust);
    const face = moodEl(c.mood, 1);
    if (face) cell.appendChild(mk('span', { cls: 'ctw-mood' }, [face]));
    cw.appendChild(cell);
  }
  let noticed = null;
  for (let i = 0; i < crew.length; i++) if (crew[i].notice) { noticed = crew[i]; break; }
  g.appendChild(hubTile('card-crew', 't-crew', U('crew'), cw, U('crewLine', { n: crew.length, s: pay.slots }),
    U('crewSub', { p: pay.now, b: pay.budget }), noticed ? U('noticeLine', { name: noticed.name }) : ''));
  // Gear.
  let ownedN = 0;
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'gear' && s.gear[CATALOG[i].id] === true) ownedN++;
  const next = typeof sim.nextGear === 'function' ? sim.nextGear() : null;   // v4.4: the cooler, then the cabinet smoker
  // P-14: the window shows the cooker you own (the drum once bought, else the kettles), as the mock
  // does; the next item to buy stays in the second line.
  const mainSpr = MAP.station('kettle1') ? MAP.station('kettle1').sprite : 'kettle';
  const gearPics = pitTierOf(s) > 0 ? [mainSpr] : (s.gear.drum ? ['drum'] : (s.gear.kettle2 ? ['kettle', 'kettle'] : ['kettle']));
  g.appendChild(hubTile('card-gear', 't-gear', U('gear'), tileWin(gearPics, gearPics.map(function () { return 2; })),
    U('gearLine', { n: ownedN }), next ? U('gearNext', { label: next.label, price: next.price }) : U('gearAll')));
  // Menu.
  const o = se.booking;
  let l1, l2 = '', plates = [];
  if (!o || o.type === 'yard') {
    l1 = U('menuYard');
    for (let i = 0; i < MEAT_IDS.length; i++) if (MEAT_IDS[i] !== 'brisket' || brisketOk(s)) plates.push('plate_' + MEAT_IDS[i]);
  } else {
    const rail = typeof sim.railFor === 'function' ? sim.railFor(o, se.addon || null) : o.rail;
    const ms = MEAT_IDS.filter(function (m) { return rail && (rail[m] | 0) > 0; });
    l1 = U1(ms.length, 'menuOne', 'menuMany');
    l2 = ms.map(function (m) { return MEATS[m].plateLabel; }).join(', ');   // R-10: the plates, as the cards name them
    plates = ms.map(function (m) { return 'plate_' + m; });
  }
  g.appendChild(hubTile('card-menu', 't-menu', U('menu'), tileWin(plates), l1, l2));
  // Shop.
  let lines = 0;
  for (let i = 0; i < MEAT_IDS.length; i++) if ((s.cart.meat[MEAT_IDS[i]] | 0) > 0) lines++;
  if ((s.cart.charcoal | 0) > 0) lines++;
  if ((s.cart.wood | 0) > 0) lines++;
  g.appendChild(hubTile('card-shop', 't-shop', U('shop'), tileWin(['cooler', 'pile'], [1, 0]), U('shopLine', { t: sim.cartTotal() }), U1(lines, 'shopOne', 'shopMany')));
  return g;
}

function invCard(s) {
  const inv = typeof sim.inventory === 'function' ? sim.inventory() : { charcoal: s.charcoal, wood: 0, meat: s.stock, units: stockUnits(s), cap: 0, over: 0 };
  const sec = mk('section', { id: 'inv-card', cls: 'card3 inv', attrs: { 'aria-labelledby': 'inv-h' } });
  sec.appendChild(uiPut(mk('h3', { id: 'inv-h' }), U('inventory').toUpperCase(), 2, UI.gold, { bold: true, shadow: UI.K }, U('inventory')));
  const bags = inv.charcoal | 0;
  sec.appendChild(mk('p', { id: 'inv-charcoal', cls: 'iline' }, [sprEl('pile', bags >= 5 ? 0 : bags >= 3 ? 1 : bags >= 1 ? 2 : 3, 2, null), U1(bags, 'invCharcoalOne', 'invCharcoal')]));
  const wood = mk('p', { id: 'inv-wood', cls: 'iline', text: U('invWood', { n: inv.wood | 0 }) });
  wood.hidden = !((inv.wood | 0) > 0);
  sec.appendChild(wood);
  const units = inv.units | 0, cap = inv.cap | 0, over = inv.over | 0;
  const meats = mk('div', { cls: 'inv-meats' });
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const m = MEAT_IDS[i];
    const n = inv.meat ? inv.meat[m] | 0 : 0;
    if (n > 0) meats.appendChild(mk('p', { id: 'inv-' + m, cls: 'iline' }, [sprEl('icon_' + m, 0, 2, null), U('invMeat', { n: n, label: MEATS[m].label })]));
  }
  if (units === 0) meats.appendChild(mk('p', { id: 'inv-empty', cls: 'iline', text: U('invEmpty') }));
  sec.appendChild(meats);
  const label = U('invCooler', { u: units, cap: cap });
  const meter = mk('div', { id: 'inv-cooler', cls: 'meter', attrs: { role: 'meter', 'aria-valuenow': String(units), 'aria-valuemin': '0', 'aria-valuemax': String(cap), 'aria-label': label } });
  meter.appendChild(mk('span', { cls: 'ml', text: label }));
  // Q-5: a cell a unit of the cooler, lit as it fills (gold, orange past 80 percent, red over), like
  // the report's segmented bars, so it never reads as an empty field.
  const frac = cap > 0 ? Math.min(1, units / cap) : (units > 0 ? 1 : 0);
  const bar = mk('span', { cls: 'msegs' + (over > 0 || (cap === 0 && units > 0) ? ' over' : frac > 0.8 ? ' hi' : ''), attrs: { 'aria-hidden': 'true' } });
  bar.style.setProperty('--n', String(Math.max(1, cap)));
  const lit = Math.min(units, cap);
  for (let i = 0; i < cap; i++) bar.appendChild(mk('span', { cls: 'ms' + (i < lit ? ' on' : '') }));
  meter.appendChild(bar);
  // P-12: with no cooler there is no gauge to fill; the no-cooler line says what that means instead.
  meter.hidden = cap === 0;
  sec.appendChild(meter);
  let spoil = '';
  if (cap === 0) spoil = U('invNoCooler');
  else if (over > 0) spoil = U('invOver', { n: over });
  const sp = mk('p', { id: 'inv-spoil', cls: cap === 0 && units === 0 ? 'muted' : 'bad', text: spoil });
  sp.hidden = !spoil;
  sec.appendChild(sp);
  return sec;
}

// v4.4 (Joel 2026-10-20, "Still losing money here"): the Season tab's money log, one row a day this
// week (day, what it was, plates, what it made after costs and wages, where most of the money went),
// then the week so far and last week. The day report keeps the full breakdown.
function moneyCard() {
  const mv = typeof sim.moneyView === 'function' ? sim.moneyView() : null;
  const M = STRINGS.money;
  if (!mv || !M) return null;
  const sec = mk('section', { id: 'money', cls: 'news money', attrs: { 'aria-labelledby': 'money-h' } });
  sec.appendChild(uiPut(mk('h3', { id: 'money-h', cls: 'tab' }), M.head.toUpperCase(), 2, UI.white, { bold: true, shadow: '#8f1f1a' }, M.head));
  const body = mk('div', { cls: 'news-body' });
  body.appendChild(mk('p', { cls: 'muted', text: M.help }));
  const signed = function (n) { return (n > 0 ? '+' : (n < 0 ? '-' : '')) + Math.abs(n | 0); };
  if (!mv.rows.length) body.appendChild(mk('p', { id: 'money-none', text: M.none }));
  else {
    const ol = mk('ol', { id: 'money-rows', cls: 'money-rows' });
    for (let i = 0; i < mv.rows.length; i++) {
      const r = mv.rows[i];
      const bits = [r.dayName.slice(0, 3), r.what];
      if (r.plates > 0) bits.push(fill(M.plates, { n: r.plates }));
      const li = mk('li', { cls: r.net < 0 ? 'bad' : '' }, [
        mk('span', { cls: 'm-what', text: bits.join(', ') }),
        mk('span', { cls: 'm-net', text: signed(r.net) }),
        mk('span', { cls: 'm-big', text: r.big ? fill(M.biggest, { w: r.big }) : '' })
      ]);
      ol.appendChild(li);
    }
    body.appendChild(ol);
  }
  body.appendChild(mk('p', { id: 'money-total', cls: mv.total < 0 ? 'bad' : '', text: M.total + ': ' + signed(mv.total) }));
  if (mv.prev !== null) body.appendChild(mk('p', { id: 'money-prev', cls: 'muted', text: M.prev + ': ' + signed(mv.prev) }));
  sec.appendChild(body);
  return sec;
}

function newsCard(s) {
  const sec = mk('section', { id: 'news', cls: 'news', attrs: { 'aria-labelledby': 'news-h' } });
  sec.appendChild(uiPut(mk('h3', { id: 'news-h', cls: 'tab' }), U('news').toUpperCase(), 2, UI.white, { bold: true, shadow: '#8f1f1a' }, U('news')));
  const nb = mk('div', { cls: 'news-body' });
  let shown = 0;
  // Q-4: sim.js Q-8 keeps comingNext off while C.DRIVEWAY_BUYABLE is false (v3.3 builds the Driveway).
  if (s.comingNext) {
    shown++;
    nb.appendChild(mk('div', { id: 'goal', cls: 'card' }, [
      mk('p', { text: 'Coming next: the driveway pop-up' }),
      mk('p', { text: 'Price ' + C.DRIVEWAY_PRICE + '. The backyard stays open as long as you like.' }),
      btn('goal-keep', 'Keep running the backyard', 'alt', function () {
        sim.dismissComingNext();
        afterAct();
        if (el['week-h']) el['week-h'].focus();
      })
    ]));
  } else {
    const g = sim.goal();
    // R-10: the Gear tile already says "Next: {label}, {price}" for the first unowned gear row.
    const ng = typeof sim.nextGear === 'function' ? sim.nextGear() : null;   // v4.4: the cooler, then the cabinet smoker
    const nextGear = ng ? ng.id : null;
    const gp = mk('p', { id: 'goal', text: g ? 'Next goal: ' + g.label + ', ' + g.price + '.' : '' });
    gp.hidden = !g || g.id === nextGear;
    if (!gp.hidden) shown++;
    nb.appendChild(gp);
  }
  // X13.6: a line per card that gave notice. Review 1: and one per lineup card that is fired up.
  const crew = crewList();
  for (let i = 0; i < crew.length; i++) {
    if (!crew[i].notice) continue;
    nb.appendChild(mk('p', { id: 'news-notice-' + crew[i].id, cls: 'bad', text: U('noticeLine', { name: crew[i].name }) }));
    shown++;
  }
  for (let i = 0; i < crew.length; i++) {
    if (!(crew[i].bring && clampMood(crew[i].mood) === 2)) continue;
    nb.appendChild(mk('p', { id: 'news-fired-' + crew[i].id, cls: 'gold', text: U('firedUp', { name: crew[i].name }) }));
    shown++;
  }
  // R-3: from week 5, what the drum smoker makes of the finale while it is not owned.
  const se = s.season;
  if (se && se.week >= 5 && se.week < (C.SEASON_WEEKS || 7) && s.gear.drum !== true) {
    const big = drumFinale(s);
    if (big && !big.comp && big.headcount > 0) { nb.appendChild(mk('p', { id: 'news-finale', text: U('finaleNews', { n: big.headcount }) })); shown++; }
  }
  // Q-4: from week 5, the finale's line and the bigger table while it is not owned.
  if (se && se.week >= 5 && se.week < (C.SEASON_WEEKS || 7) && s.gear.bigtable !== true) {
    const fin = finaleWith(s, null);
    if (fin && !fin.comp && fin.headcount > 0) { nb.appendChild(mk('p', { id: 'news-table', text: U('finaleTable', { n: fin.headcount }) })); shown++; }
  }
  // Q-4: the weather only touches a Yard day, so it shows only while the Yard day is picked.
  const yardPick = !!(se && se.booking && se.booking.type === 'yard');
  if (s.day >= C.RAIN_FROM_DAY && yardPick) {
    shown++;
    // Deviation 33: rain only touches a Yard day (W22.10).
    const r = s.rain
      ? (s.gear.canopy ? 'Rain today. The canopy is up for a Yard day.' : 'Rain today. A Yard day draws fewer people unless the canopy is up.')
      : 'Clear today.';
    nb.appendChild(mk('p', { id: 'weather', cls: 'muted', text: r }));
  }
  sec.appendChild(nb);
  sec.hidden = shown === 0;
  return sec;
}

// ---------------------------------------------------------------- v3.2 days of the week (D8.2, D8.3)

function dayNameOf(i) { return STRINGS.dayName ? STRINGS.dayName[i] || '' : ''; }
function dayKindWord(k) { return STRINGS.dayKind && STRINGS.dayKind[k] ? STRINGS.dayKind[k] : ''; }
function dayCardNow() { return typeof sim.dayCardView === 'function' ? sim.dayCardView() : null; }
// The booked day (D1): the picked offer's day, or null for the Yard offer or no pick.
function bookedDayOf(se) {
  const o = se && se.booking;
  if (!o || o.type === 'yard') return null;
  if (typeof o.day === 'number') return o.day;
  const bd = C.BOOK_DAY ? C.BOOK_DAY[o.type] : null;
  return typeof bd === 'number' ? bd : null;
}
// Today's options in loop 'week', with goHere when today is the booked day; null without the days sim.
function dayView(s) {
  if (loopOf(s) !== 'week' || typeof sim.dayOptions !== 'function' || typeof sim.chooseDay !== 'function') return null;
  let v = null;
  try { v = sim.dayOptions(); } catch (e) { v = null; }
  if (!v || !Array.isArray(v.options)) return null;
  v.goHere = v.options.some(function (o) { return o.kind === 'event'; });
  return v;
}
// v3.4: the start card's pick and the rescue (weekSig).
function hubSig() {
  const r = typeof sim.recommendDay === 'function' && loopOf(sim.state) === 'week' ? sim.recommendDay() : null;
  return r ? r.kind + (r.rescue ? 'R' : '') + (r.alt || []).length : '';
}
// What changes the day part of the hub's height (weekSig).
function daySig(s) {
  const v = dayView(s);
  if (!v) return '';
  return (s.season.day | 0) + ':' + v.options.map(function (o) { return o.kind + (o.ok ? '' : '!'); }).join(',');
}

// ol#day-strip: seven display tiles, done days checked, today lit, the booked day marked (D8.2).
function dayStrip(se) {
  const today = se.day | 0;
  const log = Array.isArray(se.dayLog) ? se.dayLog : [];
  const bd = bookedDayOf(se);
  const n = C.WEEK_DAYS || 7;
  const ol = mk('ol', { id: 'day-strip', attrs: { 'aria-label': U('dayStripAria', { day: dayNameOf(today) }) } });
  for (let i = 0; i < n; i++) {
    const done = i < today;
    const li = mk('li', { id: 'day-' + i, cls: 'dy ' + (done ? 'done' : i === today ? 'now' : 'ahead') + (i === bd ? ' booked' : '') });
    let aria;
    if (done) aria = U('dayDoneAria', { day: dayNameOf(i), kind: dayKindWord(log[i]) || dayKindWord('off') });
    else if (i === bd) aria = U('dayBookedAria', { day: dayNameOf(i), label: se.booking.label || bookingLabel(se.booking.type) });
    else aria = U('dayAheadAria', { day: dayNameOf(i) });
    li.setAttribute('aria-label', aria);
    const inner = mk('div', { cls: 'tin', attrs: { 'aria-hidden': 'true' } });
    const word = STRINGS.dayShort ? STRINGS.dayShort[i] || '' : '';
    const color = i === today ? UI.K : done || i === bd ? UI.white : UI.blueL;
    inner.appendChild(uiPut(mk('span', { cls: 'tn' }), word, 2, color, i === today ? undefined : { shadow: UI.ink }));
    if (done) {
      const badge = mk('span', { cls: 'badge' });
      const ck = checkEl(2);
      if (ck) badge.appendChild(ck);
      inner.appendChild(badge);
    }
    li.appendChild(inner);
    ol.appendChild(li);
  }
  return ol;
}

// section#day-choice: the heading, today's price, a button and a hint per option; on the booked day
// #go and #go-why stand in for the event option.
function dayChoice(se, v, goEls) {
  const sec = mk('section', { id: 'day-choice', attrs: { 'aria-labelledby': 'day-choice-h' } });
  const head = mk('div', { cls: 'offers-head' });
  head.appendChild(uiPut(mk('h3', { id: 'day-choice-h', attrs: { tabindex: '-1' } }), U('dayPick').toUpperCase(), 2, UI.white, { bold: true, shadow: UI.ink }, U('dayPick')));
  const mult = typeof v.price === 'number' ? v.price : (Array.isArray(C.DAY_PRICE) ? C.DAY_PRICE[se.day | 0] : 1);
  const pct = Math.round(mult * 100);
  head.appendChild(mk('p', { id: 'day-price', cls: pct < 100 ? 'low' : pct > 100 ? 'high' : '', text: U('priceDay', { n: pct }) }));
  sec.appendChild(head);
  const grid = mk('div', { cls: 'day-opts' });
  for (let i = 0; i < v.options.length; i++) {
    const o = v.options[i];
    const hint = STRINGS.dayHint && STRINGS.dayHint[o.kind] ? STRINGS.dayHint[o.kind] : '';
    if (o.kind === 'event') {
      const cell = mk('div', { cls: 'dopt devent' });
      cell.appendChild(mk('p', { id: 'day-event-hint', cls: 'dhint muted', text: hint }));
      cell.appendChild(goEls[0]);
      cell.appendChild(goEls[1]);
      grid.appendChild(cell);
      continue;
    }
    const cell = mk('div', { cls: 'dopt' });
    const b = pixBtn('day-' + o.kind, dayKindWord(o.kind), 'alt', function () { onDay(o.kind); }, 12);
    b.disabled = !o.ok;
    b.setAttribute('aria-describedby', 'day-' + o.kind + '-hint');
    cell.appendChild(b);
    const warn = o.ok && o.warn ? String(o.warn) : '';   // V32-9: say what spoils before the tap
    const hp = mk('p', { id: 'day-' + o.kind + '-hint', cls: 'dhint muted' + (!o.ok || warn ? ' why' : '') + (warn ? ' warn' : '') });
    const short = STRINGS.dayHintShort && STRINGS.dayHintShort[o.kind] ? STRINGS.dayHintShort[o.kind] : '';
    if (!o.ok || warn || !short) hp.textContent = o.ok ? (warn || hint) : String(o.reason || '');
    else { hp.appendChild(mk('span', { cls: 'hl', text: hint })); hp.appendChild(mk('span', { cls: 'hs', text: short })); }
    cell.appendChild(hp);
    grid.appendChild(cell);
  }
  // v3.2 playtest: a last option alone on its row puts its hint beside the button (fitWeek step 8).
  const cells = grid.children;
  const last = cells.length ? cells[cells.length - 1] : null;
  const plain = grid.querySelectorAll('.dopt:not(.devent)').length;
  if (last && !last.classList.contains('devent') && plain % 2 === 1) last.classList.add('lone');
  sec.appendChild(grid);
  return sec;
}

// A day option. Train opens the crew sheet to pick the card; Yard day and the quick days go to the sim.
function onDay(kind) {
  if (kind === 'train') { crewPick = true; openSheet('crew', 'day-train'); return; }
  const r = sim.chooseDay(kind);
  pump();
  if (!r || !r.ok) {
    if (currentPanel === 'week') rebuildKeepFocus(buildWeek, 'week');
    const h = document.getElementById('day-' + kind + '-hint');
    if (h && r && r.message) h.textContent = String(r.message);
  }
  updateDom();
}

// ---------------------------------------------------------------- v3.4 the start button, tabs, morning shop, rescue

let planOpen = false;         // Change plan shows the other choice
let planDay = -1;             // the day planOpen belongs to (a new day closes it)
let hubTab = 'week';          // the hub's open tab: 'week' | 'pit' | 'season'
let shopKind = null;          // the day kind the morning shop is buying for
let restartArm = false;       // Restart the season asks for a second tap
let offersOpen = false;       // See offers shows the offer cards under a picked booking
let offersWeek = -1;          // the week offersOpen belongs to
const HUB_TABS = Object.freeze([['week', 'This week'], ['pit', 'Your pit'], ['season', 'Season']]);

// The three hub tabs: a tab bar and a panel per tab (without the start button, all panels show).
function hubTabs(on) {
  const bar = mk('div', { id: 'hub-tabs', cls: 'hub-tabs', attrs: { role: 'tablist', 'aria-label': 'Hub sections' } });
  const panels = {};
  for (let i = 0; i < HUB_TABS.length; i++) {
    const id = HUB_TABS[i][0], word = HUB_TABS[i][1];
    const t = mk('button', { id: 'hub-tab-' + id, cls: 'alt htab', type: 'button', text: word, attrs: { role: 'tab', 'aria-controls': 'hub-pane-' + id } });
    t.setAttribute('aria-selected', hubTab === id ? 'true' : 'false');
    t.addEventListener('click', function () { hubTab = id; rebuildKeepFocus(buildWeek, 'week'); });
    bar.appendChild(t);
    const pane = mk('div', { id: 'hub-pane-' + id, cls: 'hub-pane', attrs: on ? { role: 'tabpanel', 'aria-labelledby': 'hub-tab-' + id } : {} });
    pane.hidden = on && hubTab !== id;
    panels[id] = pane;
  }
  return { bar: bar, panel: function (id) { return panels[id]; } };
}

// section#hub-startsec: "Start Tuesday: Yard day" big, then Change plan and the other choice.
function startCard(se, rv) {
  const day = se.day | 0;
  if (planDay !== day) { planOpen = false; planDay = day; }
  const sec = mk('section', { id: 'hub-startsec', attrs: { 'aria-label': rv.start } });
  const b = mk('button', { id: 'hub-start', cls: 'primary big go hub-start', type: 'button' });
  const fl = flameEl(true, 2);
  if (fl) b.appendChild(fl);
  const words = mk('span', { cls: 'hs-words', attrs: { 'aria-hidden': 'true' } });
  const top = U('startDay', { day: dayNameOf(day), kind: '' }).replace(/[:\s]+$/, '');
  words.appendChild(uiPut(mk('span', { cls: 'hs-l1' }), top.toUpperCase(), 3, UI.white, { bold: true, shadow: '#8a3a14' }, top));
  words.appendChild(uiPut(mk('span', { cls: 'hs-l2' }), String(rv.label).toUpperCase(), 2, '#fff4dc', { bold: true, shadow: '#8a3a14' }, rv.label));
  b.appendChild(words);
  b.appendChild(mk('span', { cls: 'sr', text: rv.start }));
  b.addEventListener('click', function () { startDay(rv.kind); });
  sec.appendChild(b);
  const why = mk('p', { id: 'hub-why', cls: 'muted' });
  sec.appendChild(why);
  // Joel: "I can't find how to move the kettle." Arrange yard sits right under Start too.
  if (typeof sim.canArrange === 'function' && sim.canArrange()) {
    sec.appendChild(mk('button', { id: 'hub-arrange', cls: 'linkish', type: 'button', text: 'Move your gear', on: enterArrange }));
  }
  if (TESTER) sec.appendChild(mk('button', { id: 'hub-tester', cls: 'linkish', type: 'button', text: 'Tester tools', on: function () { openTester('hub'); } }));   // v4.7, preview only
  const alt = Array.isArray(rv.alt) ? rv.alt : [];
  if (alt.length) {
    const ch = mk('button', { id: 'hub-change', cls: 'linkish', type: 'button', text: U('changePlan') });
    ch.setAttribute('aria-expanded', planOpen ? 'true' : 'false');
    ch.setAttribute('aria-controls', 'hub-plan');
    ch.addEventListener('click', function () { planOpen = !planOpen; rebuildKeepFocus(buildWeek, 'week'); });
    sec.appendChild(ch);
    const box = mk('div', { id: 'hub-plan', cls: 'day-opts' });
    box.hidden = !planOpen;
    if (planOpen) {
      for (let i = 0; i < alt.length; i++) {
        const o = alt[i];
        const cell = mk('div', { cls: 'dopt' });
        const ob = pixBtn('day-' + o.kind, String(o.label), 'alt', function () { startDay(o.kind); }, 16);
        ob.disabled = !o.ok;
        ob.setAttribute('aria-describedby', 'day-' + o.kind + '-hint');
        cell.appendChild(ob);
        const hint = STRINGS.dayHint && STRINGS.dayHint[o.kind] ? STRINGS.dayHint[o.kind] : '';
        cell.appendChild(mk('p', { id: 'day-' + o.kind + '-hint', cls: 'dhint muted' + (o.ok ? '' : ' why'), text: o.ok ? hint : String(o.reason || '') }));
        box.appendChild(cell);
      }
    }
    sec.appendChild(box);
  }
  return sec;
}

// v3.5 Week planner (Monday): one screen sets Monday to Friday, each a Yard day or Rest, the sim's
// draft prefilled. Start week plays the Rest days at once; Skip to the weekend rests all five.
function planViewOf(s) {
  if (loopOf(s) !== 'week' || typeof sim.planView !== 'function') return null;
  let v = null;
  try { v = sim.planView(); } catch (e) { v = null; }
  return v && Array.isArray(v.days) && v.days.length ? v : null;
}
function planText(key, fb, map) { const P = STRINGS.plan || {}; return fill(typeof P[key] === 'string' ? P[key] : fb, map || {}); }
function pitViewOf() {
  if (typeof sim.pitView !== 'function') return null;
  try { return sim.pitView(); } catch (e) { return null; }
}
function cookTimeOf() {
  if (typeof sim.cookTime !== 'function') return null;
  try { return sim.cookTime(); } catch (e) { return null; }
}
// The hub's rebuild key for the planner, the pit level and the cook time (weekSig).
function planSig() {
  const pv = planViewOf(sim.state);
  const pt = pitViewOf();
  const pd = pv ? pv.days.map(function (d) { return d.reason || ''; }).join('') : '';
  const ct = cookTimeOf();
  return [pv ? pv.days.map(function (d) { return d.kind + (d.ok === false ? '!' : ''); }).join('') : '',
    pt ? pt.level + '.' + pt.pending + '.' + pt.longDay + '.' + pt.xp : '', ct ? ct.total : '', pd].join(':');
}
function plannerCard(pv) {
  const sec = mk('section', { id: 'planner', cls: 'planner', attrs: { 'aria-labelledby': 'planner-h' } });
  const title = String(pv.title || planText('title', 'Plan the week'));
  sec.appendChild(uiPut(mk('h3', { id: 'planner-h' }), title.toUpperCase(), 2, UI.white, { bold: true, shadow: UI.ink }, title));
  const hint = planText('hint', '');
  if (hint) sec.appendChild(mk('p', { id: 'planner-hint', cls: 'muted', text: hint }));
  const row = mk('div', { id: 'plan-days', cls: 'plan-days', attrs: { role: 'group', 'aria-label': title } });
  for (let i = 0; i < pv.days.length; i++) {
    const d = pv.days[i];
    const day = d.day | 0;
    const kind = d.kind === 'yard' ? 'yard' : 'off';
    const kw = kind === 'yard' ? planText('yard', 'Yard day') : planText('rest', 'Rest');
    const dn = String(d.dayName || dayNameOf(day));
    const b = mk('button', { id: 'plan-day-' + day, cls: 'plan-day ' + kind, type: 'button', attrs: { 'data-kind': kind, 'aria-pressed': kind === 'yard' ? 'true' : 'false' } });
    b.appendChild(mk('span', { cls: 'pd-name', text: dn.slice(0, 3) }));
    b.appendChild(mk('span', { cls: 'pd-kind', text: kw }));
    b.setAttribute('aria-label', dn + ': ' + kw + (d.ok === false && d.reason ? '. ' + d.reason : ''));
    b.addEventListener('click', function () {
      if (typeof sim.togglePlanDay === 'function') sim.togglePlanDay(day);
      else if (typeof sim.setPlanDay === 'function') sim.setPlanDay(day, kind === 'yard' ? 'off' : 'yard');
      rebuildKeepFocus(buildWeek, 'week');
      updateDom();
    });
    row.appendChild(b);
  }
  sec.appendChild(row);
  sec.appendChild(mk('p', { id: 'plan-why', cls: 'muted' }));
  const go = mk('button', { id: 'plan-start', cls: 'primary big go hub-start', type: 'button' });
  const fl = flameEl(true, 2);
  if (fl) go.appendChild(fl);
  const st = String(pv.start || planText('start', 'Start week'));
  go.appendChild(uiPut(mk('span', { cls: 'hs-l1', attrs: { 'aria-hidden': 'true' } }), st.toUpperCase(), 3, UI.white, { bold: true, shadow: '#8a3a14' }, st));
  go.appendChild(mk('span', { cls: 'sr', text: st }));
  go.addEventListener('click', function () { runPlan(false); });
  sec.appendChild(go);
  const sk = btn('plan-skip', String(pv.skip || planText('skip', 'Skip to the weekend')), 'alt', function () { runPlan(true); });
  sk.classList.add('plan-skip');
  sec.appendChild(sk);
  return sec;
}
function runPlan(skip) {
  const fn = skip ? sim.skipToWeekend : sim.startPlan;
  if (typeof fn !== 'function') return;
  const r = fn.call(sim);
  pump();
  const n = r && r.note ? r.note : (typeof sim.restNote === 'function' ? sim.restNote() : null);
  if (r && r.ok !== false && n && Array.isArray(n.days) && n.days.length) {
    let line = n.days.length === 1 ? planText('restedOne', 'Rested 1 day.') : planText('rested', 'Rested {n} days.', { n: n.days.length });
    if (n.trained && n.trained.name) line += ' ' + SAY('trained', { name: n.trained.name, xp: n.trained.xp | 0 });
    announce(line);
  }
  if (currentPanel === 'week') rebuildKeepFocus(buildWeek, 'week');
  if (r && r.ok === false && r.message) { const h = document.getElementById('plan-why'); if (h) h.textContent = String(r.message); }
  updateDom();
}
// v3.5 Buy more time: the cook time line, the pit level chip and, while a level is banked, the
// Long Day pick (3 levels, +15 s to every cook).
function fmtClock(sec) { const t = Math.max(0, Math.round(sec)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function pitCard() {
  const sec = mk('section', { id: 'hub-pit', cls: 'hub-pit', attrs: { 'aria-label': 'Pitmaster' } });
  const ct = cookTimeOf();
  const pt = pitViewOf();
  const row = mk('div', { cls: 'hp-row' });
  if (ct) {
    const text = ct.text ? String(ct.text) : 'Cook time ' + fmtClock(ct.total);
    const extra = [];
    if ((ct.longDay | 0) > 0) extra.push('Long Day +' + (ct.longDay | 0) + ' s');
    if ((ct.lights | 0) > 0) extra.push('lights +' + (ct.lights | 0) + ' s');
    row.appendChild(mk('p', { id: 'hub-cooktime', cls: 'hp-time', text: text + (extra.length ? ' (' + extra.join(', ') + ')' : '') }));
  }
  if (pt) {
    const nx = typeof pt.toNext === 'number' && pt.toNext > 0 ? ', ' + pt.toNext + ' XP to go' : '';
    const pl = (STRINGS.pit && STRINGS.pit.title ? STRINGS.pit.title + ' ' : '') + String(pt.label || 'Level ' + (pt.level | 0)) + (pt.xpText ? ', ' + pt.xpText : nx);
    row.appendChild(mk('p', { id: 'pit-level', cls: 'hp-lvl' + ((pt.pending | 0) > 0 ? ' ready' : ''), text: pl }));
  }
  sec.appendChild(row);
  if (pt && (pt.pending | 0) > 0 && Array.isArray(pt.skills)) {
    const box = mk('div', { id: 'pit-levelup', cls: 'pit-levelup', attrs: { role: 'group', 'aria-labelledby': 'pit-levelup-h' } });
    const lh = STRINGS.pit && STRINGS.pit.levelUp ? fill(STRINGS.pit.levelUp, { n: pt.level | 0 }) : 'Level up! Pick a skill.';
    box.appendChild(mk('p', { id: 'pit-levelup-h', cls: 'hp-h', text: lh }));
    for (let i = 0; i < pt.skills.length; i++) {
      const k = pt.skills[i];
      const lab = String(k.label || k.id) + ' +' + ((k.seconds | 0) || 15) + ' s';
      const b = btn('pit-pick-' + k.id, lab, 'primary', function () {
        const r = typeof sim.pickPitSkill === 'function' ? sim.pickPitSkill(k.id) : null;
        pump();
        announce(r && r.ok === false && r.message ? String(r.message) : String(k.label || k.id) + ': every cook runs ' + ((k.seconds | 0) || 15) + ' s longer.');
        rebuildKeepFocus(buildWeek, 'week');
        updateDom();
      });
      b.disabled = k.ok === false;
      box.appendChild(b);
      if (k.info) box.appendChild(mk('p', { cls: 'muted hp-info', text: String(k.info) }));
    }
    sec.appendChild(box);
  }
  return sec;
}

// Start (or a Change plan choice): through the morning shop when the day needs stock or the cart
// would spend; nothing is bought until the shop's Confirm.
function startDay(kind) {
  // Joel 2026-10-19: "There's no more ordering before the day starts?" The morning order opens
  // before every cook day, prefilled; Rest days skip it.
  if (kind !== 'off') { openMorning(kind); return; }
  const r = sim.chooseDay(kind);
  pump();
  if (!r || !r.ok) {
    if (currentPanel === 'week') rebuildKeepFocus(buildWeek, 'week');
    const h = document.getElementById('hub-why');
    if (h && r && r.message) h.textContent = String(r.message);
  }
  updateDom();
}

// The morning shop: the Shop sheet in its morning mode, with Confirm and Back.
function openMorning(kind) {
  if (typeof sim.shopOpen !== 'function') return;
  shopKind = kind;
  sim.shopOpen(kind);
  openSheet('shop', 'hub-start', 'morning');
}
function morningFoot() {
  const sec = mk('section', { id: 'mshop', cls: 'mshop', attrs: { 'aria-label': U('shopFor', { kind: dayKindWord(shopKind) || '' }) } });
  const total = mk('p', { id: 'shop-total', cls: 'mtotal' });
  const warn = mk('p', { id: 'shop-warn', cls: 'mwarn' });
  const spoil = mk('p', { id: 'shop-spoil', cls: 'mwarn' });
  const why = mk('p', { id: 'shop-why', cls: 'muted' });
  const back = btn('shop-back', U('shopBack'), 'alt', closeSheet);
  const ok = btn('shop-confirm', U('shopConfirm'), 'primary', onShopConfirm);
  sec.appendChild(total);
  sec.appendChild(warn);
  sec.appendChild(spoil);
  sec.appendChild(why);
  sec.appendChild(mk('div', { cls: 'mrow' }, [back, ok]));
  rowSink.push(function () {
    const v = typeof sim.shopView === 'function' ? sim.shopView(shopKind) : null;
    if (!v) return;
    total.textContent = 'Total ' + v.total + '. Cash after ' + v.after + '.';
    warn.textContent = v.warn || '';
    warn.hidden = !v.warn;
    spoil.textContent = v.spoil || '';
    spoil.hidden = !v.spoil;
    why.textContent = v.ok ? '' : String(v.reason || '');
    ok.disabled = !v.ok;
  });
  return sec;
}
function onShopConfirm() {
  const k = shopKind;
  const r = sim.shopConfirm(k);
  if (!r || !r.ok) {
    pump();
    runSheetRows();
    const w = document.getElementById('shop-why');
    if (w && r && r.message) w.textContent = String(r.message);
    updateDom();
    return;
  }
  shopKind = null;
  pump();
  if (currentPanel === 'sheet') { dropSheet(); openWeek(); }
  updateDom();
}

// section#rescue: never a dead end when cash cannot cover the day (sell gear at half, an advance on
// the booking, or restart the season, which asks twice).
function rescueCard(s) {
  const v = typeof sim.rescueView === 'function' ? sim.rescueView() : null;
  if (!v) { restartArm = false; return null; }
  const R = STRINGS.rescue || {};
  const fill = function (t, o) { return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return o[k] !== undefined ? String(o[k]) : m; }); };
  const sec = mk('section', { id: 'rescue', cls: 'rescue card3', attrs: { 'aria-labelledby': 'rescue-h' } });
  sec.appendChild(mk('h3', { id: 'rescue-h', text: R.title || 'Short on cash' }));
  sec.appendChild(mk('p', { id: 'rescue-body', text: fill(R.body, { cash: v.cash, need: v.need }) }));
  const act = function (fn) { return function () { const r = fn(); restartArm = false; afterRescue(r); }; };
  // Sell gear at half: always a row, a button per piece, or a disabled one when there is nothing to sell.
  sec.appendChild(mk('p', { id: 'rescue-sell-h', cls: 'rescue-sub', text: R.sellHead || 'Sell gear at half' }));
  for (let i = 0; i < v.gear.length; i++) {
    const g = v.gear[i];
    sec.appendChild(btn('rescue-sell-' + g.id, fill(R.sell, { label: g.label, price: g.price }), 'alt quiet', act(function () { return sim.rescueSell(g.id); })));
  }
  if (!v.gear.length) {
    const none = btn('rescue-sell-none', R.sellNone || 'No gear to sell yet', 'alt quiet', null);
    none.disabled = true;
    sec.appendChild(none);
  }
  if (v.advance > 0) {
    sec.appendChild(btn('rescue-advance', fill(R.advance, { n: v.advance, label: v.label }), 'alt quiet', act(function () { return sim.rescueAdvance(); })));
    if (R.advanceNote) sec.appendChild(mk('p', { cls: 'muted', text: R.advanceNote }));
  }
  const rs = btn('rescue-restart', restartArm ? 'Tap again to restart' : (R.restart || 'Restart the season'), 'alt quiet', function () {
    if (!restartArm) { restartArm = true; rebuildKeepFocus(buildWeek, 'week'); return; }
    restartArm = false;
    afterRescue(sim.rescueRestart());
  });
  sec.appendChild(rs);
  if (R.restartNote) sec.appendChild(mk('p', { cls: 'muted', text: R.restartNote }));
  sec.appendChild(mk('p', { id: 'rescue-msg', cls: 'muted' }));
  return sec;
}
function afterRescue(r) {
  pump();
  if (currentPanel === 'week') rebuildKeepFocus(buildWeek, 'week');
  const m = document.getElementById('rescue-msg') || document.getElementById('hub-why');
  if (m && r && r.message) { m.textContent = String(r.message); announce(String(r.message)); }
  updateDom();
}

// The offer's day tag (offer-{id}-day): SAT or SUN on a booking card, none on the Yard card.
function offerDay(o) {
  if (!o || o.type === 'yard' || typeof o.day !== 'number' || !STRINGS.dayShort) return null;
  const w = STRINGS.dayShort[o.day];
  if (!w) return null;
  const t = mk('span', { id: 'offer-' + o.id + '-day', cls: 'oday' });
  uiPut(t, w, 2, UI.gold, null, dayNameOf(o.day));
  return t;
}

// #daycard (D8.3), opened on day_done: what the day did, the cash, then Next day.
function openDayCard() {
  const c = dayCardNow();
  if (!c) return;
  dropSheet();
  cardCtx = null;
  buildDayCard(c);
  openPanel('daycard');
}
function itemWord(id) {
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return String(CATALOG[i].label).toLowerCase();
  if (MEATS[id]) return MEATS[id].label.toLowerCase();
  return String(id);
}
function buildDayCard(c) {
  const h = el['daycard-h'];
  clear(h);
  const title = dayNameOf(c.day | 0) + ', ' + dayKindWord(c.kind);
  pixLines(h, title.toUpperCase(), 24, 2, UI.white, { bold: true, shadow: UI.ink }, title);
  const body = el['daycard-body'];
  clear(body);
  const card = mk('div', { cls: 'card3 dc-card' });
  let any = false;
  const line = function (id, text) { card.appendChild(mk('p', { id: id, text: text })); any = true; };
  const bought = Array.isArray(c.bought) ? c.bought.filter(function (b) { return b && (b.qty | 0) > 0; }) : [];
  if (bought.length) line('daycard-bought', U('cardBought', { list: andList(bought.map(function (b) { return (b.qty | 0) + ' ' + itemWord(b.id); })), n: c.spent | 0 }));
  if ((c.prepBonus | 0) > 0) line('daycard-prep', U('cardPrep', { n: C.PREP_QUALITY }));
  if (c.loadinSame) line('daycard-loadin', U('cardLoadinSame'));
  if (c.trained && c.trained.name) line('daycard-train', U('cardTrain', { name: c.trained.name, xp: c.trained.xp | 0 }));
  const ov = c.overnight;
  if (ov && (ov.n | 0) > 0) line('daycard-overnight', U('cardOvernight', { n: ov.n | 0, meat: MEATS[ov.meat] ? MEATS[ov.meat].plateLabel.toLowerCase() : '' }));
  const mood = Array.isArray(c.mood) ? c.mood : [];
  if (mood.length) line('daycard-mood', U('cardMood', { list: andList(mood.map(function (m) { return m.name + ' ' + moodWord(m.to).toLowerCase(); })) }));
  else if (c.moodTop) line('daycard-mood', U('cardMoodTop', { mood: moodWord(C.DAYOFF_MOOD_CAP) }));
  if ((c.spoiled | 0) > 0) line('daycard-spoiled', U('cardSpoiled', { n: c.spoiled | 0 }));
  if (!any) line('daycard-nothing', U('cardNothing'));
  body.appendChild(card);
  body.appendChild(mk('div', { id: 'daycard-cash', cls: 'pill' }, [coinEl(2), pillLabel(U('cash')), pillValue(fmt(sim.state.cash))]));
  const nx = mk('button', { id: 'daycard-next', cls: 'primary big', type: 'button' });
  uiPut(nx, U('nextDay').toUpperCase(), 3, UI.creamL, { bold: true, shadow: UI.orangeLo }, U('nextDay'));
  nx.addEventListener('click', onNextDay);
  body.appendChild(nx);
}
// Next day: the sim clears the card (the tick already ran), then the hub, focus on the day choice.
function onNextDay() {
  const r = typeof sim.advanceDay === 'function' ? sim.advanceDay() : null;
  pump();
  if (r && r.ok && loopOf(sim.state) === 'week' && !sim.state.broke) openWeek(); else showLoop();
  pump();
  updateDom();
  const f = document.getElementById('day-choice-h');
  if (f && currentPanel === 'week') f.focus();
}

// ---------------------------------------------------------------- sheets (W17.3)

function openSheet(kind, openerId, from) {
  sheetKind = kind;
  sheetOpener = openerId || null;
  sheetFrom = from === 'yard' || from === 'morning' ? from : 'week';
  sheetMsg = '';
  shopOther = false;
  crewMsg = '';
  cardCtx = null;
  buildSheet();
  openPanel('sheet');
}

// Back from a sheet: to the week hub (X13.1), the morning or the yard.
function closeSheet() {
  const opener = sheetOpener;
  const from = sheetFrom;
  if (from === 'morning') {
    // v3.4 the morning shop's Back: the cart goes back as it was, nothing spent.
    if (typeof sim.shopBack === 'function') sim.shopBack();
    shopKind = null;
    dropSheet();
    openWeek();
    const f = document.getElementById('hub-start');
    if (f) f.focus();
    return;
  }
  dropSheet();
  if (from === 'yard') {
    resumeFromPause();
    return;
  } else {
    openWeek();
  }
  const f = opener ? document.getElementById(opener) : null;
  if (f && typeof f.focus === 'function') f.focus();
}

function dropSheet() {
  crewPick = false;
  sheetKind = null;
  sheetOpener = null;
  sheetRows = [];
  sheetMsg = '';
  if (el['sheet-body']) clear(el['sheet-body']);
  if (el['sheet-h']) clear(el['sheet-h']);
  if (currentPanel === 'sheet') setInert(true);   // v3.4: the yard's "+" taps end with the sheet
}

function buildSheet() {
  const s = sim.state;
  const se = s.season || {};
  const titles = { shop: U('shop'), gear: U('gear'), menu: U('menu'), crew: U('crew') };
  const morning = sheetKind === 'shop' && sheetFrom === 'morning';
  const title = morning ? U('shopTitle', { day: dayNameOf(se.day | 0) }) : (titles[sheetKind] || '');
  const h = el['sheet-h'];
  clear(h);
  uiPut(h, title.toUpperCase(), morning ? 2 : 3, UI.white, { bold: true, shadow: UI.ink }, title);
  const body = el['sheet-body'];
  clear(body);
  sheetRows = [];
  rowSink = sheetRows;
  // Q-2: Back is a 44 px chevron button at the top right, beside the title (no sheet mock has a full
  // width bar between the header and the list).
  const back = mk('button', { id: 'sheet-back', cls: 'alt back', type: 'button', attrs: { 'aria-label': U('back') } });
  back.appendChild(pixCanvas(PIX.arrowL.map, PIX.arrowL.pal, 2));
  back.addEventListener('click', closeSheet);
  body.appendChild(back);
  if (sheetKind === 'crew') { buildCrewSheet(body); return; }   // X13.5
  const card = mk('div', { cls: 'card3 sheet-card' });
  if (sheetKind === 'shop') {
    // Q-2: at a booking only the rail meats show; guests order nothing else, so the rest fold away.
    const ob = se.booking;
    // v3.4: the morning shop for a Yard day shows every meat (a Yard day has no rail).
    const rail = ob && ob.type !== 'yard' && !(morning && shopKind !== 'event') && typeof sim.railFor === 'function' ? sim.railFor(ob, se.addon || null) : null;
    const meats = CATALOG.filter(function (r) { return r.kind === 'meat'; });
    let onRail = rail ? meats.filter(function (r) { return (rail[r.id] | 0) > 0; }) : meats;
    // v3.4 review: a Yard day's morning shop lists the booked event's meats first.
    const bnx = !rail && morning && typeof sim.bookingNeeds === 'function' ? sim.bookingNeeds() : null;
    if (bnx) onRail = onRail.filter(function (r) { return bnx.rail[r.id] > 0; }).concat(onRail.filter(function (r) { return !(bnx.rail[r.id] > 0); }));
    const offRail = rail ? meats.filter(function (r) { return !((rail[r.id] | 0) > 0); }) : [];
    if (offRail.some(function (r) { return (s.cart.meat[r.id] | 0) > 0; })) shopOther = true;
    card.appendChild(h3('Meat'));
    for (let i = 0; i < onRail.length; i++) card.appendChild(cartRow(onRail[i], true, rail));
    if (offRail.length) {
      const tog = btn('shop-other', U('otherMeats'), 'alt', function () { shopOther = !shopOther; rebuildKeepFocus(buildSheet, 'sheet'); });
      tog.setAttribute('aria-expanded', shopOther ? 'true' : 'false');
      tog.setAttribute('aria-controls', 'shop-other-rows');
      const chev = pixCanvas((shopOther ? PIX.arrowD : PIX.arrowR).map, PIX.arrowR.pal, 2);
      tog.appendChild(chev);
      card.appendChild(tog);
      const box = mk('div', { id: 'shop-other-rows' });
      box.hidden = !shopOther;
      if (shopOther) {
        box.appendChild(mk('p', { cls: 'muted', text: U('offMenu') }));
        for (let i = 0; i < offRail.length; i++) box.appendChild(cartRow(offRail[i], true, null));
      }
      card.appendChild(box);
    }
    // R-15: the fuel section's one row is named Charcoal already, so it takes no heading of its own.
    // v4.1: the wood row shows once a cooker burns wood; then the section is Fuel.
    const fuel = CATALOG.filter(function (r) { return r.kind === 'fuel' && (r.id !== 'wood' || !lockedBy(r, s)); });
    if (!(fuel.length === 1 && fuel[0].label === 'Charcoal')) card.appendChild(h3('Fuel'));
    for (let i = 0; i < fuel.length; i++) card.appendChild(cartRow(fuel[i], true));
    card.appendChild(mk('p', { id: 'shop-room', cls: 'muted' }));
    card.appendChild(mk('p', { id: 'shop-spare', cls: 'muted' }));
    card.appendChild(mk('p', { id: 'cart' }));
    if (morning) {
      const pct = Math.round((Array.isArray(C.DAY_PRICE) ? C.DAY_PRICE[se.day | 0] : 1) * 100);
      card.insertBefore(mk('p', { id: 'shop-price', cls: 'muted' + (pct < 100 ? ' low' : pct > 100 ? ' high' : ''), text: U('shopPrice', { p: pct }) }), card.firstChild);
      card.appendChild(morningFoot());
    }
    card.appendChild(mk('p', { cls: 'muted', text: 'Game numbers. Not real prices and not a cooking guide.' }));
  } else if (sheetKind === 'gear') {
    // v4.1: the gear ladder first (each cooker takes the kettle's place), with the crew slots it gives.
    const ladder = CATALOG.filter(function (r) { return r.kind === 'gear' && r.tier > 0; });
    if (ladder.length) {
      card.appendChild(h3('Cookers'));
      const cs = crewSlotsLine('gear-slots');
      if (cs) card.appendChild(cs);
      for (let i = 0; i < ladder.length; i++) card.appendChild(ownRow(ladder[i]));
    }
    card.appendChild(h3('Gear'));
    for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'gear' && !(CATALOG[i].tier > 0)) card.appendChild(ownRow(CATALOG[i]));
    for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'goal') card.appendChild(goalRow(CATALOG[i]));
    card.appendChild(h3('Decor'));
    card.appendChild(mk('p', { cls: 'muted', text: 'Charm adds to the tip each seated customer leaves, up to 3 more, and lets word of mouth climb a little faster.' }));
    for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'decor') card.appendChild(ownRow(CATALOG[i]));
    card.appendChild(mk('p', { id: 'seats', text: seatsLine() }));
  } else if (sheetKind === 'menu') {
    const o = se.booking;
    if (!o || o.type === 'yard') {
      card.appendChild(mk('p', { id: 'menu-yard', text: U('yardMenu') }));
    } else {
      const rail = typeof sim.railFor === 'function' ? sim.railFor(o, se.addon || null) : o.rail;
      for (let i = 0; i < MEAT_IDS.length; i++) {
        const m = MEAT_IDS[i];
        if (rail && (rail[m] | 0) > 0) card.appendChild(iconLine(sprEl('icon_' + m, 0, 2, null), U('menuAsk', { label: MEATS[m].plateLabel, n: rail[m] | 0 }), 'menu-ask')).id = 'menu-' + m;
      }
      card.appendChild(h3(U('addonH')));
      const row = mk('div', { cls: 'addons', attrs: { role: 'group' } });
      const none = btn('addon-none', U('addonNone'), 'alt', function () { sim.setAddon(null); afterAct(); });
      none.setAttribute('aria-pressed', se.addon ? 'false' : 'true');
      row.appendChild(none);
      for (let i = 0; i < MEAT_IDS.length; i++) {
        const m = MEAT_IDS[i];
        if (o.menu.indexOf(m) !== -1 || (m === 'brisket' && !brisketOk(s))) continue;
        const b = btn('addon-' + m, MEATS[m].label, 'alt', function () { sim.setAddon(m); afterAct(); });
        b.setAttribute('aria-pressed', se.addon === m ? 'true' : 'false');
        row.appendChild(b);
      }
      card.appendChild(row);
      card.appendChild(mk('p', { id: 'addon-note', cls: 'muted', text: U('addonNote', { b: Math.round((o.pay | 0) * (C.MENU_BONUS || 0.1)) }) }));
    }
  }
  body.appendChild(card);
  runSheetRows();
}

// X13.5: the crew sheet. The payroll box, the slots, a card per crew member with Bring and (in the
// week) Train beside it, the train line, the last refusal, then this week's walk-ins (week only).
function buildCrewSheet(body) {
  const s = sim.state;
  const week = weekOnly();
  const pay = payrollNow();
  body.appendChild(payrollMeter('crew-payroll'));
  const grow = payrollGrowLine('crew-payroll-grow');
  if (grow) body.appendChild(grow);
  const views = crewViews();
  body.appendChild(mk('p', { id: 'crew-slots', cls: 'crew-slots', text: views.length ? U('slots', { n: views.length, s: pay.slots }) : U('crewEmpty') }));
  const tid = trainedId();
  const ul = mk('ul', { id: 'crew-list' });
  for (let i = 0; i < views.length; i++) {
    const c = views[i];
    const li = mk('li', { cls: 'crew-li' + (c.bring ? '' : ' resting') });
    li.appendChild(heldCard('crew-' + c.id, c, function () { openCard({ mode: 'crew', key: c.id, from: 'sheet', opener: 'crew-' + c.id }); }));
    const ctl = mk('div', { cls: 'crew-ctl' });
    const bring = bringBtn('bring-' + c.id, c, function () { onBring(c.id, !c.bring); }, 10);
    bring.disabled = !crewLoops();
    ctl.appendChild(bring);
    if (week && !autoTrain()) {
      const tr = pixBtn('train-' + c.id, U('train'), 'alt', function () { onTrain(c.id); }, 10);
      tr.disabled = tid !== null;
      ctl.appendChild(tr);
    }
    // Deviation 49: each card's XP toward the next level, and the levels it has banked.
    const need = C.LEVEL_XP || 200;
    ctl.appendChild(segMeter('xp-' + c.id, c.xp | 0, need, U('xp', { x: c.xp | 0, max: need }), 'crew-xp', true));
    if ((c.banked | 0) > 0) ctl.appendChild(mk('p', { id: 'banked-' + c.id, cls: 'gold crew-banked', text: U('banked', { n: c.banked | 0 }) }));
    li.appendChild(ctl);
    if (c.notice) li.appendChild(mk('p', { id: 'crew-notice-' + c.id, cls: 'bad crew-notice', text: U('noticeLine', { name: c.name }) }));
    ul.appendChild(li);
  }
  body.appendChild(ul);
  if (week) {
    const who = tid !== null ? (crewCard(tid) ? crewCard(tid).name : (nameCache.get(tid) || '')) : '';
    const line = tid === null ? (autoTrain() ? 'The first Rest of the week trains the card with the least XP (+' + (C.TRAIN_XP || 40) + ').' : U('trainLine', { xp: C.TRAIN_XP || 40 }))
      : (who ? U('trainedLine', { name: who }) : U('trainDone'));
    body.appendChild(mk('p', { id: 'crew-train-line', cls: 'muted', text: line }));
  }
  body.appendChild(mk('p', { id: 'crew-why', cls: 'muted', text: crewMsg }));
  if (!week) return;
  body.appendChild(boardSection());
  const wk = s.season && Array.isArray(s.season.walkins) ? s.season.walkins : [];
  const sec = mk('section', { cls: 'walkins', attrs: { 'aria-labelledby': 'walkins-h' } });
  sec.appendChild(mk('h3', { id: 'walkins-h', text: U('walkinsH') }));
  // Review 1: no walk-ins in week 1 (sim.js genWalkins), so week 1 says when they come.
  sec.appendChild(mk('p', { id: 'walkins-line', cls: 'muted', text: wk.length ? U('walkinLine') : U('walkinsLater') }));
  const grid = mk('div', { cls: 'walkin-grid' });
  for (let i = 0; i < wk.length; i++) {
    const w = wk[i];
    if (!w || w.hired) continue;
    const d = walkinData(w);
    grid.appendChild(crewCardEl('walkin-' + i, {
      role: d.role, name: d.name, look: d.look, stars: d.stars, potential: d.potential, mood: d.mood, wage: d.wage, rookie: false,
      aria: U('appAria', { name: d.name, role: roleName(d.role), stars: starsText(d.stars), w: d.wage })
    }, (function (k) { return function () { openCard({ mode: 'walkin', key: k, from: 'sheet', opener: 'walkin-' + k }); }; })(i)));
  }
  sec.appendChild(grid);
  body.appendChild(sec);
}

// v4.8: the Help wanted board on the crew sheet: the note, the crew slots, what a Yard day clears and
// the wage warning, the PIT lock line until the cabinet smoker, then a card per open applicant with
// its one line under it. A card opens #card in board mode, where Hire signs or says why not.
function boardSection() {
  const bv = boardData();
  const sec = mk('section', { id: 'help', cls: 'helpw', attrs: { 'aria-labelledby': 'help-h' } });
  sec.appendChild(mk('h3', { id: 'help-h', text: U('boardH') }));
  sec.appendChild(mk('p', { id: 'help-note', cls: 'muted', text: U('boardNote') }));
  const slots = crewSlotsLine('help-slots');
  if (slots) sec.appendChild(slots);
  if (!bv) return sec;
  if (bv.money) {
    sec.appendChild(mk('p', { id: 'help-wage-note', cls: 'muted', text: bv.money.note }));
    if (bv.money.warnLine) sec.appendChild(mk('p', { id: 'help-wage-warn', cls: 'gold', text: bv.money.warnLine }));
  }
  if (!bv.pitOpen) sec.appendChild(mk('p', { id: 'help-pit-lock', cls: 'muted', text: U('pitLockedB') }));
  if (!bv.list.length) { sec.appendChild(mk('p', { id: 'help-empty', cls: 'muted', text: U('boardEmpty') })); return sec; }
  const ul = mk('ul', { id: 'help-list', cls: 'help-grid' });
  for (let k = 0; k < bv.list.length; k++) {
    const e = bv.list[k];
    const line = e.line + (e.from ? ' ' + U('boardFrom', { name: e.from }) : '');
    const li = mk('li', { cls: 'help-li' });
    li.appendChild(crewCardEl('help-' + e.i, {
      role: e.role, name: e.name, look: e.look, stars: e.stars, potential: null, mood: e.mood, wage: e.wage | 0, rookie: false,
      aria: U('boardAria', { name: e.name, role: roleName(roleOf(e.role)), stars: starsText(e.stars), w: e.wage | 0, line: line })
    }, (function (i) { return function () { openCard({ mode: 'board', key: i, from: 'sheet', opener: 'help-' + i }); }; })(e.i)));
    li.appendChild(mk('p', { id: 'help-line-' + e.i, cls: 'help-line', attrs: { 'aria-hidden': 'true' }, text: line }));
    ul.appendChild(li);
  }
  sec.appendChild(ul);
  return sec;
}

// A walk-in with its derived stars and wage (X4.3: derived on load, never saved).
function walkinData(w) {
  const role = roleOf(w.role);
  const skills = Array.isArray(w.skills) ? w.skills : [1, 1];
  const stars = typeof w.stars === 'number' ? w.stars : cardStarsOf(skills);
  return { name: String(w.name || ''), role: role, skills: skills, look: w.look, mood: w.mood | 0,
    potential: typeof w.potential === 'number' ? w.potential : null, stars: stars,
    wage: typeof w.wage === 'number' ? w.wage : wageOf(stars, role), hired: w.hired === true };
}

// A card you hold as a .crewcard (deviation 47: its mood sentence joins the label).
function heldCard(id, c, onClick) {
  const role = roleOf(c.role);
  const stars = typeof c.stars === 'number' ? c.stars : cardStarsOf(c.skills);
  return crewCardEl(id, {
    role: role, name: c.name, look: c.look, stars: stars, potential: typeof c.potential === 'number' ? c.potential : null,
    mood: c.mood, wage: c.wage | 0, rookie: c.rookie === true,
    aria: U('appAria', { name: c.name, role: roleName(role), stars: starsText(stars), w: c.wage | 0 }) + '. ' + U('moodAria', { name: c.name, mood: moodWord(c.mood) })
  }, onClick);
}

// Review 1: Bring shows its state as a state, a check and COMING when the card is in the lineup,
// RESTING when not; aria-pressed and ui.bringAria carry it for screen readers.
function bringBtn(id, c, on, maxChars) {
  const w = c.bring ? U('bringOn') : U('bringOff');
  const b = mk('button', { id: id, cls: 'alt pxbtn bringb', type: 'button', on: on, attrs: { 'aria-pressed': c.bring ? 'true' : 'false', 'aria-label': U('bringAria', { name: c.name }) } });
  const row = mk('span', { cls: 'brow' });
  if (c.bring) { const ck = sprEl('check', 0, 2, null); if (ck) row.appendChild(ck); }
  pixLines(row, w, maxChars || 22, 2, c.bring ? '#1b1714' : '#ffffff', { bold: true, shadow: c.bring ? '#fff6c9' : '#10215E' }, w);
  b.appendChild(row);
  return b;
}

function onBring(id, on) {
  if (typeof sim.setBring !== 'function') return;
  const r = sim.setBring(id, on);
  crewMsg = r && r.message ? String(r.message) : '';
  afterAct();
}
// v3.4 playtest: training is automatic (the week's first Rest), so no Train buttons.
function autoTrain() { return typeof sim.recommendDay === 'function'; }
function onTrain(id) {
  if (typeof sim.train !== 'function') return;
  // v3.2 (D4.6): with days on, every Train tap spends the day, from the pick sheet or not.
  const r = typeof sim.chooseDay === 'function' ? sim.chooseDay('train', { id: id }) : sim.train(id);
  crewMsg = r && r.ok === false && r.message ? String(r.message) : '';
  afterAct();
}

// v4.0 economy: while the wages the yard can sign are under the rung's payroll, one line says gear grows it.
function payrollGrowLine(id) {
  const p = payrollNow();
  if (!p || !(p.hire > 0) || (p.hire | 0) >= (p.budget | 0) || !C.PAYROLL_PER_GEAR) return null;
  return mk('p', { id: id, cls: 'muted pgrow', text: U('payrollGrows', { b: p.hire, n: C.PAYROLL_PER_GEAR, max: p.budget }) });
}

// The payroll box (X13.2): the words set into the top border, a near black bar with the yellow fill,
// orange past 80 percent and red past 95, a tick every 10. role meter, so its numbers are read out.
function payrollMeter(id) {
  const p = payrollNow();
  const now = p.now | 0, budget = Math.max(1, p.budget | 0);
  const label = U('payroll', { p: now, b: budget });
  const m = mk('div', { id: id, cls: 'paybar', attrs: { role: 'meter', 'aria-valuenow': String(now), 'aria-valuemin': '0',
    'aria-valuemax': String(budget), 'aria-label': U('payrollAria', { p: now, b: budget }) } });
  const t = mk('span', { cls: 'pb-t' });
  uiPut(t, label.toUpperCase(), 2, '#ffffff', { shadow: '#10215E' }, label);
  m.appendChild(t);
  const track = mk('span', { cls: 'pb-track', attrs: { 'aria-hidden': 'true' } });
  const frac = now / budget;
  const fillEl = mk('span', { cls: 'pb-fill' + (frac > 0.95 ? ' red' : frac > 0.8 ? ' orange' : '') });
  fillEl.style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(2) + '%';
  track.appendChild(fillEl);
  for (let v = 10; v < budget; v += 10) {
    const tk = mk('span', { cls: 'pb-tick' + (v <= now ? ' under' : '') });
    tk.style.left = (v / budget * 100).toFixed(2) + '%';
    track.appendChild(tk);
  }
  m.appendChild(track);
  return m;
}

// ---------------------------------------------------------------- crew cards (X13.4)

// d: { role, name, look, stars, potential (number or null), mood, wage, rookie, aria }.
function crewCardEl(id, d, onClick) {
  const role = roleOf(d.role);
  const b = mk('button', { id: id, cls: 'crewcard r-' + role, type: 'button', attrs: { 'aria-label': d.aria || d.name } });
  const win = mk('span', { cls: 'cc-win' });
  const bust = portraitEl(d.look, role, 3);
  if (bust) win.appendChild(bust);
  win.appendChild(roleBadge(role, ''));
  if (d.rookie) {
    const nb = mk('span', { cls: 'cc-new' });
    uiPut(nb, U('newBadge') || 'NEW', 2, '#FFD23F', null, U('newBadge') || 'NEW');
    win.appendChild(nb);
  }
  const mood = clampMood(d.mood);
  const face = mk('span', { cls: 'cc-mood', attrs: { role: 'img', 'aria-label': U('moodAria', { name: d.name, mood: moodWord(mood) }), 'data-mood': String(mood) } });
  const mc = moodEl(mood, 2);
  if (mc) face.appendChild(mc);
  win.appendChild(face);
  b.appendChild(win);
  const info = mk('span', { cls: 'cc-info' });
  info.appendChild(uiPut(mk('span', { cls: 'cc-name' }), String(d.name).toUpperCase(), 2, '#ffffff', { shadow: '#2A2C38' }, d.name));
  const row = mk('span', { cls: 'cc-row' });
  // Review 1: the mock's 11 px outlined stars (the 9 px star with a 1 px ink edge, .g11) and its
  // 6 by 6 coin at 2x.
  const sr = starRow(d.stars, d.potential, 1, false);
  sr.classList.add('g11');
  row.appendChild(sr);
  const wage = mk('span', { cls: 'cc-wage' });
  wage.appendChild(uiPut(mk('span', { cls: 'cc-wl' }), U('wage').toUpperCase(), 2, '#CFDEFF', { shadow: '#2A2C38' }, U('wage')));
  const coin = pixCanvas(COIN6.map, COIN6.pal, 2);
  if (coin) wage.appendChild(coin);
  wage.appendChild(uiPut(mk('span', { cls: 'cc-wv' }), String(d.wage | 0), 2, '#FFF1B0', { shadow: '#2A2C38' }));
  row.appendChild(wage);
  info.appendChild(row);
  b.appendChild(info);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// ---------------------------------------------------------------- pixel text and buttons

// Review 1: words in the UI font, wrapped onto lines of at most maxChars characters (a canvas a
// line), with one .sr span holding the sentence. Returns parent.
function pixLines(parent, text, maxChars, scale, color, opts, srText) {
  const words = String(text).toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? cur + ' ' + words[i] : words[i];
    if (cur && next.length > maxChars) { lines.push(cur); cur = words[i]; } else cur = next;
  }
  if (cur) lines.push(cur);
  let drew = 0;
  for (let i = 0; i < lines.length; i++) {
    const c = uiCanvas(lines[i], scale, color, opts);
    if (c) { parent.appendChild(mk('span', { cls: 'pxl' }, [c])); drew++; }
  }
  const sr = srText === undefined ? String(text) : String(srText);
  if (drew) parent.appendChild(mk('span', { cls: 'sr', text: sr }));
  else parent.appendChild(mk('span', { cls: 'utf', text: sr }));
  return parent;
}

// Review 1: an action button drawn like #go and the v3.0 screens, uppercase UI font with a shadow,
// wrapped at maxChars, with the sentence as its accessible name (the .sr span). opts.color and
// opts.shadow override the white text and the shadow of its class.
function pixBtn(id, text, cls, on, maxChars, opts) {
  const o = opts || {};
  const b = mk('button', { id: id, cls: cls + ' pxbtn', type: 'button', on: on });
  const primary = /(^| )primary( |$)/.test(cls);
  pixLines(b, text, maxChars || 22, 2, o.color || '#ffffff', { bold: true, shadow: o.shadow || (primary ? '#8a3a14' : '#10215E') }, text);
  return b;
}

// ---------------------------------------------------------------- the card sheet (X13.3)

// ctx: { mode: 'board' | 'walkin' | 'crew' | 'level', key, from: 'sheet' | 'till', opener }.
function openCard(ctx) {
  cardCtx = { mode: ctx.mode, key: ctx.key, from: ctx.from, opener: ctx.opener || null, back: ctx.back || null, msg: '', sure: false };
  buildCard();
  if (!cardCtx) return;
  openPanel('card');
}

// Back (or Escape): level mode opened from a held card returns to it; else the panel under the sheet.
function cardBack() {
  const c = cardCtx;
  if (!c) return;
  if (c.mode === 'level' && c.back === 'crew') {
    c.mode = 'crew'; c.back = null; c.msg = ''; c.sure = false;
    buildCard();
    focusOr('card-level', el['card-h']);
    return;
  }
  cardCtx = null;
  returnFromCard(c.from, c.opener);
}

function returnFromCard(from, opener) {
  const l = loopOf(sim.state);
  if (from === 'sheet' && sheetKind) {
    buildSheet();
    openPanel('sheet');
  } else if (from === 'till' && (l === 'report' || sim.state.phase === 'evening')) {
    openTill();
  } else {
    showLoop();
    return;
  }
  focusOr(opener, el[currentPanel + '-h']);
}

// While #card is open, the panel under it is rebuilt after every action (deviation 43).
function rebuildUnderCard() {
  const c = cardCtx;
  if (!c) return;
  if (c.from === 'sheet' && sheetKind) buildSheet();
}

// The card's numbers by mode, or null when it is gone (a hired board applicant is).
function cardData(c) {
  if (!c) return null;
  if (c.mode === 'board') {   // v4.8: a Help wanted applicant (key: the hireBoard index)
    const bv = boardData();
    const e = bv ? bv.list.find(function (x) { return x.i === c.key; }) || null : null;
    if (!e) return null;
    return { name: e.name, role: roleOf(e.role), look: e.look, skills: e.skills || [1, 1], stars: e.stars, wage: e.wage | 0,
      potential: null, mood: e.mood | 0, rookie: false, contract: 2, line: e.line || '', from: e.from || null };
  }
  if (c.mode === 'walkin') {
    const se = sim.state.season;
    const w = se && Array.isArray(se.walkins) ? se.walkins[c.key] : null;
    if (!w) return null;
    const d = walkinData(w);
    d.contract = 1; d.rookie = false;
    return d;
  }
  const v = crewViewOf(c.key);
  if (!v) return null;
  const role = roleOf(v.role);
  return { id: v.id, name: v.name, role: role, look: v.look, skills: v.skills || [1, 1], potential: typeof v.potential === 'number' ? v.potential : null,
    stars: typeof v.stars === 'number' ? v.stars : cardStarsOf(v.skills), wage: v.wage | 0, mood: v.mood | 0, rookie: v.rookie === true,
    contract: v.contract | 0, xp: v.xp | 0, banked: v.banked | 0, notice: v.notice === true, bring: v.bring === true,
    raised: v.raised === true, worked: v.worked | 0,
    postLabel: v.postLabel || '', posts: Array.isArray(v.posts) ? v.posts : [], open: v.open !== false };   // v4.3: the PIT card's cooker
}

function buildCard() {
  const c = cardCtx;
  const d = cardData(c);
  if (!d) {
    cardCtx = null;
    if (c) returnFromCard(c.from, c.opener);
    return;
  }
  const role = d.role;
  const h = el['card-h'];
  clear(h);
  uiPut(h, String(d.name).toUpperCase(), 3, '#ffffff', { bold: true, shadow: '#10215E' }, d.name);
  const body = el['card-body'];
  clear(body);
  const back = mk('button', { id: 'card-back', cls: 'alt back', type: 'button', attrs: { 'aria-label': U('cardBack') } });
  back.appendChild(pixCanvas(PIX.arrowL.map, PIX.arrowL.pal, 2));
  back.addEventListener('click', cardBack);
  body.appendChild(back);

  // The portrait on the role band, with the role badge and the mood face as on the grid card.
  const pw = mk('div', { id: 'card-portrait', cls: 'cp-win r-' + role, attrs: { 'aria-hidden': 'true' } });
  const bust = portraitEl(d.look, role, 4);
  if (bust) pw.appendChild(bust);
  if (d.rookie) {
    const nb = mk('span', { cls: 'cc-new' });
    uiPut(nb, U('newBadge') || 'NEW', 2, '#FFD23F', null, U('newBadge') || 'NEW');
    pw.appendChild(nb);
  }
  body.appendChild(pw);

  const info = mk('div', { cls: 'card3 cp-info' });
  const rl = mk('div', { id: 'card-role', cls: 'cp-role' });
  rl.appendChild(mk('p', { cls: 'cp-rl' }, [roleBadge(role, ''), mk('span', { cls: 'cp-rn', text: roleName(role) })]));
  rl.appendChild(mk('p', { cls: 'muted', text: roleJob(role) }));
  if (c.mode === 'board' && d.line) rl.appendChild(mk('p', { id: 'card-line', cls: 'cp-line', text: d.line + (d.from ? ' ' + U('boardFrom', { name: d.from }) : '') }));
  info.appendChild(rl);

  const mood = clampMood(d.mood);
  const md = mk('div', { id: 'card-mood', cls: 'cp-mood', attrs: { role: 'img', 'aria-label': U('moodAria', { name: d.name, mood: moodWord(mood) }), 'data-mood': String(mood) } });
  const mc = moodEl(mood, 2);
  if (mc) md.appendChild(mc);
  md.appendChild(mk('span', { text: moodWord(mood) }));
  info.appendChild(md);

  const st = mk('div', { id: 'card-stars', cls: 'cp-stars' });
  st.appendChild(mk('span', { cls: 'sr', text: starsText(d.stars) }));
  st.appendChild(starRow(d.stars, d.potential, 2, true));
  st.appendChild(mk('p', { cls: 'muted', text: typeof d.potential === 'number' ? U('potential', { n: half(d.potential) }) : U('potentialHidden') }));
  info.appendChild(st);

  for (let i = 0; i < 2; i++) {
    const v = Math.round((Number(d.skills[i]) || 1) * 2) / 2;
    const sk = mk('div', { id: 'card-skill-' + i, cls: 'cp-skill' + (c.lifted === i ? ' lvl-new' : ''), attrs: { role: 'meter', 'aria-valuenow': String(v), 'aria-valuemin': '1', 'aria-valuemax': '5',
      'aria-label': U('skillAria', { skill: skillName(role, i), n: half(v) }) } });
    sk.appendChild(mk('span', { cls: 'sk-n', text: skillName(role, i) }));
    sk.appendChild(starRow(v, null, 2, true));
    sk.appendChild(mk('p', { cls: 'muted sk-h', text: skillHelp(role, i) }));
    info.appendChild(sk);
  }

  const wr = mk('div', { cls: 'cp-wage' });
  wr.appendChild(mk('p', { id: 'card-wage' }, [coinEl(2), mk('span', { text: U('perEvent', { w: d.wage }) })]));
  wr.appendChild(mk('span', { id: 'card-contract', cls: 'cchip', text: d.contract === 2 ? U('contract2') : U('contract1') }));
  info.appendChild(wr);

  if (c.mode === 'crew' || c.mode === 'level') {
    const need = C.LEVEL_XP || 200;
    info.appendChild(segMeter('card-xp', d.xp, need, U('xp', { x: d.xp, max: need }), 'cp-xp', true));
    if (d.banked > 0) info.appendChild(mk('p', { id: 'card-banked', cls: 'gold', text: U('banked', { n: d.banked }) }));
  }
  if (c.mode === 'crew' && d.notice) info.appendChild(mk('p', { id: 'card-notice', cls: 'bad', text: U('noticeLine', { name: d.name }) }));
  body.appendChild(info);

  const act = mk('div', { cls: 'cp-act' });
  if (c.mode === 'board') cardBoardActs(act, d);
  else if (c.mode === 'walkin') cardWalkinActs(act, d);
  else if (c.mode === 'crew') cardCrewActs(act, d);
  else if (c.mode === 'level') cardLevelActs(act, d);
  body.appendChild(act);
}

// v4.8: a Help wanted applicant. Hire signs them (no fee, two seasons) or says plainly why not
// (crew full, the payroll cap, a PIT applicant without the cabinet smoker); Pass goes back.
function cardBoardActs(act, d) {
  const c = cardCtx;
  const hire = pixBtn('card-hire', U('hire'), 'primary', function () {
    const r = typeof sim.hireBoard === 'function' ? sim.hireBoard(c.key) : null;
    pump();
    if (r && r.ok) {
      cardCtx = null;
      crewMsg = '';
      returnFromCard('sheet', 'crew-' + r.id);
      updateDom();
      return;
    }
    c.msg = r && r.message ? String(r.message) : '';
    afterAct();
    focusOr('card-hire', el['card-h']);
  });
  hire.disabled = !weekOnly();
  act.appendChild(hire);
  act.appendChild(pixBtn('card-pass', U('pass'), 'alt quiet', cardBack));
  act.appendChild(mk('p', { id: 'card-why', cls: 'muted', text: c.msg }));
}

function cardWalkinActs(act, d) {
  const c = cardCtx;
  const hire = pixBtn('card-hire', U('hireFee', { f: d.wage }), 'primary', function () {
    const r = sim.hireWalkin(c.key);
    pump();
    if (r && r.ok) {
      cardCtx = null;
      crewMsg = '';
      returnFromCard('sheet', 'crew-' + r.id);
      updateDom();
      return;
    }
    c.msg = r && r.message ? String(r.message) : '';
    afterAct();
  });
  hire.disabled = d.hired || !weekOnly();
  act.appendChild(hire);
  act.appendChild(pixBtn('card-pass', U('pass'), 'alt quiet', cardBack));
  act.appendChild(mk('p', { id: 'card-why', cls: 'muted', text: c.msg }));
}

function cardCrewActs(act, d) {
  const c = cardCtx;
  const id = d.id;
  const done = function (r, keep) {
    c.msg = r && r.message ? String(r.message) : '';
    afterAct();
    focusOr(keep, el['card-h']);
  };
  if (crewLoops()) act.appendChild(bringBtn('card-bring', d, function () { done(sim.setBring(id, !d.bring), 'card-bring'); }, 22));
  // v4.3: the cooker a PIT card runs; a tap moves it to the next one you own.
  if (d.role === 'pit' && crewLoops() && typeof sim.cyclePitPost === 'function') {
    const pb = pixBtn('card-post', U('pitPost', { c: d.postLabel }), 'alt', function () { done(sim.cyclePitPost(id), 'card-post'); }, 22);
    pb.disabled = d.posts.length < 2;
    act.appendChild(pb);
    if (!d.open) act.appendChild(mk('p', { id: 'card-pit-lock', cls: 'bad', text: U('pitLocked') }));
  }
  if (weekOnly() && !autoTrain()) {
    const tid = trainedId();
    const tr = pixBtn('card-train', tid !== null ? U('trainDone') : U('train'), 'alt', function () {
      const r = typeof sim.chooseDay === 'function' ? sim.chooseDay('train', { id: id }) : sim.train(id);
      pump();
      if (currentPanel === 'daycard') { updateDom(); return; }
      done(r && r.ok === false ? r : null, 'card-level');
    });
    tr.disabled = tid !== null;
    act.appendChild(tr);
  }
  if (d.banked > 0) {
    act.appendChild(pixBtn('card-level', U('levelUp'), 'primary', function () {
      c.mode = 'level'; c.back = 'crew'; c.msg = ''; c.sure = false;
      buildCard();
      focusOr('card-pick-0', el['card-h']);
    }));
  }
  if (weekOnly()) {
    const raise = pixBtn('card-raise', d.raised ? U('raiseDone') : U('raise', { w: Math.round(d.wage * (1 + (C.RAISE_FRAC || 0.2))) }), 'alt', function () {
      const r = sim.giveRaise(id);
      done(r && r.ok === false ? r : null, 'card-letgo');
    });
    raise.disabled = d.raised;
    act.appendChild(raise);
  }
  if (crewLoops()) {
    act.appendChild(pixBtn('card-letgo', U('letGo'), 'alt', function () {
      c.sure = true; c.msg = '';
      buildCard();
      focusOr('card-letgo-no', el['card-h']);
    }));
    if (c.sure) {
      const sure = mk('div', { cls: 'cp-sure' });
      sure.appendChild(mk('p', { id: 'card-letgo-sure', text: d.worked > 0 ? U('letGoSure', { name: d.name, f: d.wage }) : U('letGoFree', { name: d.name }) }));
      sure.appendChild(pixBtn('card-letgo-yes', U('yes'), 'primary', function () {
        const r = sim.letGo(id);
        pump();
        if (r && r.ok) {
          const from = c.from;
          cardCtx = null;
          crewMsg = '';
          returnFromCard(from, from === 'sheet' ? 'sheet-back' : null);
          updateDom();
          return;
        }
        c.sure = false;
        done(r, 'card-letgo');
      }));
      sure.appendChild(pixBtn('card-letgo-no', U('no'), 'alt', function () {
        c.sure = false;
        buildCard();
        focusOr('card-letgo', el['card-h']);
      }));
      act.appendChild(sure);
    }
  }
  act.appendChild(mk('p', { id: 'card-why', cls: 'muted', text: c.msg }));
}

// Review 1: the curve each skill's level line names, and how its value reads.
const LEVEL_KEY = { run: ['runSpeed', 'runTip'], fire: ['fireSense', 'firePace'], prep: ['prepKnife', 'prepPace'], till: ['tillRing', 'tillTip'], pit: ['pitTiming', 'pitCare'] };
function curveWords(key, v) {
  if (!Number.isFinite(v)) return '';
  if (key === 'runTip' || key === 'tillTip') return String(Math.round((1 + v) * 100));
  if (key === 'prepKnife' || key === 'pitCare') return String(Math.round(v * 100));
  if (key === 'pitTiming') return String(Math.round(v));
  if (key === 'fireSense') return String(Math.round(v));
  return (Math.round(v * 10) / 10).toFixed(1);
}
// "Walks 4.4 tiles a second instead of 4.0." for skill i a half star up, or '' at 5 stars.
function levelWhat(role, i, skill) {
  const key = (LEVEL_KEY[role] || [])[i];
  const tpl = STRINGS.ui && STRINGS.ui.levelWhat ? STRINGS.ui.levelWhat[key] : null;
  const sv = PitSim.skillValue;
  const s = Number(skill) || 1;
  if (!key || !tpl || typeof sv !== 'function' || s >= 5) return '';
  return fill(tpl, { a: curveWords(key, sv(key, s)), b: curveWords(key, sv(key, Math.min(5, s + 0.5))) });
}

// Level mode (X13.3, deviation 45). Review 1: each pick says what it changes in the cook, and the
// pick names the skill that improved (and the new overall stars when they rose) in #card-why.
function cardLevelActs(act, d) {
  const c = cardCtx;
  act.appendChild(mk('h3', { id: 'card-level-h', cls: 'cp-lh', text: U('levelH') }));
  const p = typeof d.potential === 'number' ? d.potential : 5;
  const both = (Number(d.skills[0]) || 1) >= p && (Number(d.skills[1]) || 1) >= p;
  for (let i = 0; i < 2; i++) {
    const at = !both && (Number(d.skills[i]) || 1) >= p;
    const b = pixBtn('card-pick-' + i, U('levelPick', { skill: skillName(d.role, i) }), 'primary', (function (k) {
      return function () {
        const before = cardStarsOf(d.skills);
        const r = sim.levelUp(d.id, k);
        pump();
        const v = crewViewOf(d.id);
        if (r && r.ok === false) c.msg = r.message ? String(r.message) : '';
        else if (v) {
          const lifted = r && r.ok && v.skills && Number(v.skills[k]) > Number(d.skills[k]);
          c.msg = lifted ? SAY('levelUp', { name: v.name, skill: skillName(v.role, k).toLowerCase() }) : SAY('levelMood', { name: v.name });
          const now = typeof v.stars === 'number' ? v.stars : cardStarsOf(v.skills);
          if (lifted && now > before) c.msg += ' ' + U('levelStars', { n: half(now), w: v.wage | 0 });
          c.lifted = lifted ? k : null;
        }
        if (v && (v.banked | 0) <= 0) { c.mode = 'crew'; }
        afterAct();
        focusOr(c.mode === 'level' ? 'card-pick-' + k : 'card-back', el['card-h']);
      };
    })(i), 16);
    b.disabled = at;
    if (at) b.title = U('atPotential');
    act.appendChild(b);
    if (at) act.appendChild(mk('p', { id: 'card-pick-' + i + '-note', cls: 'muted', text: U('atPotential') }));
    else if (!both) {
      const what = levelWhat(d.role, i, d.skills[i]);
      if (what) act.appendChild(mk('p', { id: 'card-pick-' + i + '-what', cls: 'muted lwhat', text: what }));
    }
  }
  if (both) act.appendChild(mk('p', { id: 'card-level-both', cls: 'muted', text: U('levelBoth') }));
  act.appendChild(mk('p', { id: 'card-why', cls: 'muted', text: c.msg }));
}

function runSheetRows() {
  const s = sim.state;
  for (let i = 0; i < sheetRows.length; i++) sheetRows[i]();
  if (sheetKind === 'shop') {
    const room = meatRoomNow();
    const cap = typeof sim.coolerCap === 'function' ? sim.coolerCap() : 0;
    // R-8: with no cooler the line says so instead of "The cooler holds 0 overnight".
    const e = room === Infinity ? 0 : Math.max(0, room);
    let t = cap === 0 ? (room <= 0 ? U('coolerFullNone') : U('coolerNone', { e: e }))
      : (room <= 0 ? U('coolerFull', { cap: cap }) : U('coolerRoom', { cap: cap, e: e }));
    if ((s.charcoal | 0) + (s.cart.charcoal | 0) >= (C.CHARCOAL_MAX || 200)) t += ' ' + U('pileFull');
    if (sheetMsg && t.indexOf(sheetMsg) === -1) t = sheetMsg + ' ' + t;
    const sr = document.getElementById('shop-room');
    if (sr && sr.textContent !== t) sr.textContent = t;
    const total = sim.cartTotal();
    const o = s.season ? s.season.booking : null;
    // Q-2: the cart covers the rail with no whole spare unit of some meat (no cooler, no spare).
    const sp = document.getElementById('shop-spare');
    if (sp) {
      const rail = o && o.type !== 'yard' && typeof sim.railFor === 'function' ? sim.railFor(o, s.season.addon || null) : null;
      let covered = !!rail, tight = false;
      if (rail) {
        for (let i = 0; i < MEAT_IDS.length; i++) {
          const m = MEAT_IDS[i], want = rail[m] | 0;
          if (want <= 0) continue;
          const p = ((s.stock[m] | 0) + (s.cart.meat[m] | 0)) * MEATS[m].plates;
          if (p < want) covered = false;
          else if (p - want < MEATS[m].plates) tight = true;
        }
      }
      const line = covered && tight ? U('noSpare') : '';
      if (sp.textContent !== line) sp.textContent = line;
      sp.hidden = !line;
    }
    const line = o && o.type !== 'yard'
      ? U('cartLine', { t: total, d: o.deposit | 0, c: s.cash + (o.deposit | 0) - total })
      : U('cartLineYard', { t: total, c: s.cash - total });
    const ct = document.getElementById('cart');
    if (ct && ct.textContent !== line) ct.textContent = line;
  } else if (sheetKind === 'gear') {
    const se = document.getElementById('seats');
    const line = seatsLine();
    if (se && se.textContent !== line) se.textContent = line;
  }
}

function refreshSheet() {
  if (sheetKind === 'menu' || sheetKind === 'crew') { rebuildKeepFocus(buildSheet, 'sheet'); return; }
  runSheetRows();
  const a = document.activeElement;
  if (!a || a === document.body || !el.sheet.contains(a)) {
    const b = document.getElementById('sheet-back');
    if (b) b.focus();
  }
}

// ---------------------------------------------------------------- the creator (W17.5)

function filterName(v, max) {
  if (typeof PitSim.filterName === 'function') return PitSim.filterName(v, max);
  return String(v === undefined || v === null ? '' : v).slice(0, max || C.NAME_MAX || 14);
}
function cleanName(v, fb, max) {
  if (typeof PitSim.cleanName === 'function') return PitSim.cleanName(v, fb, max);
  const t = filterName(v, max).trim();
  return t || fb;
}

function openCreator(fromPause) {
  crFromPause = !!fromPause;
  crDraft = copyLook(lookNow());
  applyLook(crDraft);
  buildCreator();
  openPanel('creator');
  drawCrSign();
  drawCreatorScene();
}

function buildCreator() {
  const s = sim.state;
  const h = el['creator-h'];
  clear(h);
  const st1 = starEl(true, 2), st2 = starEl(true, 2);
  if (st1) h.appendChild(st1);
  uiPut(h, U('creatorH').toUpperCase(), 3, UI.white, { bold: true, shadow: UI.ink }, U('creatorH'));
  if (st2) h.appendChild(st2);
  const body = el['creator-body'];
  clear(body);

  if (!crFromPause) {
    const sub = mk('p', { id: 'cr-sub' });
    if (migrated) {
      sub.appendChild(document.createTextNode(U('crSub')));
    } else {
      const ck = checkEl(2);
      if (ck) sub.appendChild(ck);
      const words = U('crSubDone');
      const cut = words.indexOf('. ');
      if (cut > 0) {
        sub.appendChild(mk('span', { cls: 'crdone', text: words.slice(0, cut + 1) }));
        sub.appendChild(mk('span', { text: words.slice(cut + 1) }));
      } else {
        sub.appendChild(mk('span', { cls: 'crdone', text: words }));
      }
    }
    body.appendChild(sub);
  }

  // The preview: the pit sign on posts, the backyard patch, Random.
  const pv = mk('div', { id: 'cr-preview' });
  pv.appendChild(mk('div', { id: 'cr-sign', cls: 'sign posts' }));
  const scene = mk('div', { cls: 'scene' });
  scene.appendChild(mk('canvas', { id: 'cr-scene', attrs: { 'aria-hidden': 'true', width: String(CR_SCENE_W), height: String(CR_SCENE_H) } }));
  const rnd = mk('button', { id: 'cr-random', cls: 'alt', type: 'button' });
  rnd.appendChild(pixCanvas(PIX.dice.map, PIX.dice.pal, 2));   // Q-6: the die, as screen-6-creator has it
  uiPut(rnd, U('crRandom').toUpperCase(), 2, UI.white, { shadow: UI.ink }, U('crRandom'));
  rnd.addEventListener('click', onRandom);
  scene.appendChild(rnd);   // Q-6: the scene's bottom right corner, as screen-6-creator places it
  pv.appendChild(scene);
  body.appendChild(pv);

  // The two names (R-14: the defaults are placeholders, so the first tap types a name).
  const fields = mk('div', { cls: 'cr-fields' });
  const defName = STRINGS.defaultName || 'Pitmaster', defPit = STRINGS.defaultPit || 'Your Pit';
  fields.appendChild(nameField('cr-name', U('crName'), s.profile && s.profile.name ? s.profile.name : defName, defName));
  fields.appendChild(nameField('cr-pit', U('crPit'), pitName(s), defPit));
  body.appendChild(fields);

  // The option rows.
  const opts = mk('div', { id: 'cr-opts', cls: 'card3 cr-opts' });
  for (let i = 0; i < CR_ROWS.length; i++) opts.appendChild(crRow(CR_ROWS[i]));
  body.appendChild(opts);

  const go = mk('button', { id: 'cr-go', cls: 'primary big', type: 'button' });
  const f1 = flameEl(true, 3), f2 = flameEl(true, 3);
  if (f1) go.appendChild(f1);
  uiPut(go, U('crGo').toUpperCase(), 3, UI.creamL, { bold: true, shadow: UI.orangeLo }, U('crGo'));
  if (f2) go.appendChild(f2);
  go.addEventListener('click', onCreatorGo);
  // Q-6: on a phone Fire it up rides a sticky footer, so it is always one tap away.
  body.appendChild(mk('div', { id: 'cr-foot', cls: 'cr-foot' }, [go]));
  if (crFromPause) body.appendChild(btn('cr-back', U('crBack'), 'alt', creatorBack));
  body.appendChild(mk('p', { id: 'cr-note', text: U('crNote') }));
  refreshCreatorRows();
}

function nameField(id, label, value, fallback) {
  // The pit name gets more room than the player name (Joel, 2026-10-19: "Holy Smokes BBQ Co").
  const lim = id === 'cr-pit' ? (C.PIT_NAME_MAX || 20) : (C.NAME_MAX || 14);
  const wrap = mk('div', { cls: 'field' });
  // Q-6: the label in the UI font, white, and gold while its field has focus (two canvases, CSS picks).
  const lab = mk('label', { id: id + '-l', attrs: { for: id } });
  const lw = uiCanvas(label.toUpperCase(), 2, UI.white), lg = uiCanvas(label.toUpperCase(), 2, UI.gold);
  if (lw && lg) {
    lw.classList.add('lw');
    lg.classList.add('lg');
    lab.appendChild(lw);
    lab.appendChild(lg);
    lab.appendChild(mk('span', { cls: 'sr', text: label }));
    lab.classList.add('ui');
  } else {
    lab.textContent = label;
  }
  wrap.appendChild(lab);
  const inp = mk('input', { id: id, type: 'text', attrs: {
    maxlength: String(lim), autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false',
    enterkeyhint: 'done', 'aria-describedby': id + '-count'
  } });
  // R-14: the default name shows as the placeholder and the field starts empty (cleanName falls back).
  inp.placeholder = fallback || '';
  inp.value = value === fallback ? '' : filterName(value, lim);
  const cnt = mk('span', { id: id + '-count', cls: 'count', text: U('crCount', { n: inp.value.length, max: lim }) });
  inp.addEventListener('input', function () {
    const v = filterName(inp.value, lim);
    if (v !== inp.value) {
      inp.value = v;
      try { inp.setSelectionRange(v.length, v.length); } catch (e) { /* not a text field */ }
    }
    cnt.textContent = U('crCount', { n: v.length, max: lim });
    if (id === 'cr-pit') drawCrSign();
  });
  inp.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const nx = document.getElementById(id === 'cr-name' ? 'cr-pit' : 'cr-go');
    if (nx) nx.focus();
  });
  wrap.appendChild(inp);
  wrap.appendChild(cnt);
  return wrap;
}

function crRow(def) {
  const key = def[0], part = def[1], kind = def[2], labelKey = def[3];
  const r = mk('div', { id: 'cr-row-' + part, cls: 'crrow ' + (kind === 'swatch' ? 'crsw' : 'crch'), attrs: { role: 'group', 'aria-labelledby': 'cr-row-' + part + '-l' } });
  r.appendChild(mk('span', { id: 'cr-row-' + part + '-l', cls: 'crl', text: U(labelKey) }));
  const n = lookCounts()[key] || 1;
  const row = rowWord(labelKey);
  if (kind === 'swatch') {
    const sw = mk('div', { cls: 'swatches' });
    for (let j = 0; j < n; j++) {
      const b = mk('button', { id: 'cr-' + part + '-' + j, cls: 'swatch', type: 'button', attrs: {
        'aria-label': U('crSwatch', { row: row, label: lookLabel(key, j) }), 'aria-pressed': 'false'
      } });
      b.style.setProperty('--sw', swatchColor(key, j));
      const badge = mk('span', { cls: 'badge', attrs: { 'aria-hidden': 'true' } });
      const ck = checkEl(2);
      if (ck) badge.appendChild(ck);
      b.appendChild(badge);
      b.addEventListener('click', function () { setDraft(key, j); });
      sw.appendChild(b);
    }
    r.appendChild(sw);
  } else {
    const ch = mk('div', { cls: 'chooser' });
    const prev = mk('button', { id: 'cr-' + part + '-prev', cls: 'arrow', type: 'button', attrs: { 'aria-label': U('crPrev', { row: row }) } });
    prev.appendChild(pixCanvas(PIX.arrowL.map, PIX.arrowL.pal, 2));
    prev.addEventListener('click', function () { stepDraft(key, -1); });
    const next = mk('button', { id: 'cr-' + part + '-next', cls: 'arrow', type: 'button', attrs: { 'aria-label': U('crNext', { row: row }) } });
    next.appendChild(pixCanvas(PIX.arrowR.map, PIX.arrowR.pal, 2));
    next.addEventListener('click', function () { stepDraft(key, 1); });
    const out = mk('output', { id: 'cr-' + part + '-val', cls: 'val', attrs: { 'aria-live': 'polite' } });
    ch.appendChild(prev);
    ch.appendChild(out);
    ch.appendChild(next);
    r.appendChild(ch);
  }
  return r;
}

function setDraft(key, idx) {
  crDraft[key] = idx;
  applyLook(crDraft);
  refreshCreatorRows();
  drawCreatorScene();
}
function stepDraft(key, d) {
  const n = lookCounts()[key] || 1;
  setDraft(key, ((crDraft[key] + d) % n + n) % n);
}

function refreshCreatorRows() {
  for (let i = 0; i < CR_ROWS.length; i++) {
    const key = CR_ROWS[i][0], part = CR_ROWS[i][1], kind = CR_ROWS[i][2];
    const n = lookCounts()[key] || 1;
    const v = crDraft[key];
    if (kind === 'swatch') {
      for (let j = 0; j < n; j++) {
        const b = document.getElementById('cr-' + part + '-' + j);
        if (b) b.setAttribute('aria-pressed', j === v ? 'true' : 'false');
      }
    } else {
      const out = document.getElementById('cr-' + part + '-val');
      if (!out) continue;
      const word = lookLabel(key, v).toUpperCase();
      clear(out);
      const room = out.clientWidth > 0 ? out.clientWidth - 8 : 120;
      const fit = fitSign(word, room, [2], UI.gold, null);
      if (fit) { out.appendChild(fit); out.appendChild(mk('span', { cls: 'sr', text: word })); }
      else uiPut(out, word, 2, UI.gold, null, word);
      const pips = mk('span', { cls: 'pips', attrs: { 'aria-hidden': 'true' } });
      for (let k = 0; k < n; k++) pips.appendChild(mk('span', { cls: 'pp' + (k === v ? ' on' : '') }));
      out.appendChild(pips);
    }
  }
}

function onRandom() {
  if (typeof sim.randomLook !== 'function') return;
  crDraft = copyLook(sim.randomLook());
  applyLook(crDraft);
  refreshCreatorRows();
  drawCreatorScene();
}

function drawCrSign() {
  const sign = document.getElementById('cr-sign');
  if (!sign) return;
  const inp = document.getElementById('cr-pit');
  const name = cleanName(inp ? inp.value : pitName(sim.state), STRINGS.defaultPit || 'Your Pit', C.PIT_NAME_MAX);
  clear(sign);
  const room = Math.max(120, ((sign.parentNode && sign.parentNode.clientWidth) || 330) - 56);
  // R-14: the sticky phone preview keeps the sign at 2x so the scene stays the larger part.
  const big = (document.documentElement.clientWidth || 375) >= 900;
  const c = fitSign(name, room, big ? [3, 2] : [2], UI.signText, { bold: true, shadow: UI.woodX });
  if (c) {
    sign.appendChild(c);
    sign.appendChild(mk('span', { cls: 'sr', text: name }));
  } else {
    uiPut(sign, name.toUpperCase(), 3, UI.signText, { bold: true, shadow: UI.woodX }, name);
  }
}


function onCreatorGo() {
  const n = document.getElementById('cr-name'), p = document.getElementById('cr-pit');
  const fromPause = crFromPause;
  sim.setPlayer(copyLook(crDraft), n ? n.value : '', p ? p.value : '');
  applyLook(lookNow());
  crFromPause = false;
  migrated = false;
  pump();
  if (fromPause) {
    openPanel('pause', 'pause-look');
    updateDom();
    return;
  }
  showLoop();
  pump();
  updateDom();
}

// Back from a creator opened on the pause panel: the saved look returns (W17.1).
function creatorBack() {
  crFromPause = false;
  applyLook(lookNow());
  openPanel('pause', 'pause-look');
  updateDom();
}

// ---------------------------------------------------------------- v3.3 competition and offseason ([S 3.5], [S 3.6])
// Design [S 3.5], [S 3.6], [S 6.7], [S 6.8], [S 19.8]. Spec 19.9 (the sim's names) did not exist when
// this was written; the reads now follow [S 19.9], with fallbacks for an older sim. Deviations 70 to 66.
// 70. [S 19.9] names: the competition cook is the booking day with today.comp set; compView() reads
//     sim.compView() (cats, at, boxes, next, pulled) and maps each box to judged (score shown),
//     handed in (IN until the judges score it at its turn-in time) or missed.
// 71. The Hold clock is compView().pulled for the next open category: the clock that piece came off
//     the grate, in hand, on the board or with PREP. HOLD n turns red past the 15 s full window.
// 72. The judges' results card is till.kind 'comp' (a booking till with till.comp also opens it):
//     placing, total, trophy or shelf full, ribbons, fans, the four boxes with Doneness, Hold and Look,
//     the 10 row standings, the judges, the entry and the prize. Names come from the sim.
// 73. Trophies are state.trophies [{ year, contest, place }], six at most; ribbons are state.ribbons.
// 74. The Offseason screen is #season-end. seasonEndPreview()'s v3.3 fields (record, contracts with
//     asks and decided, leaving with reason and refers, next) fill the boxes under the record; Re-sign
//     1 season, Re-sign 2 seasons and Let go call sim.resign(id, 1 or 2) and sim.release(id). Without
//     contracts in the preview the v3.1 renew lines stay.
// 75. The FIRE badge sits over the FIRE card's head through service; the feed puff fires on the sim's
//     fire_fed { cooker } at that cooker's vent and logs 'fed'. An older sim with no fire_fed (no
//     C.COMP_SECONDS) gets the puff from the FIRE card's bag count instead.
// 76. Copy the sim does not carry yet falls back to the lines in CX below (same keys under
//     STRINGS.ui win). Contest names say competition BBQ and never a sanctioning body.
// 77. The trophy shelf shows on the hub only once a trophy or ribbon is won, so the hub fit levels
//     of a first season are unchanged; the Offseason screen always shows it.
// 78. The comp rail: the clock, then the four turn-in tickets (meat icon and time, gold for the next
//     one with its seconds to go, green with the score once boxed, red when missed), then HOLD n
//     under it while the next category's piece is off the grate.

const CX = {
  contest: { backyard: 'Backyard Open', regional: 'Regional Cook-off', invitational: 'Invitational' },
  compH: '{contest} results',
  compPlace: '{p} of {n}',
  compTotal: 'Total {n} of 400',
  judgesT: 'Judges',
  boxesT: 'Your boxes',
  fieldT: 'Standings',
  boxLine: 'Doneness {d}, Hold {h}, Look {l}',
  boxMissed: 'Missed the window',
  boxScore: '{n}',
  ribbonOne: 'Ribbon for {list}.',
  ribbonNone: 'No ribbons this time.',
  trophyWon: 'First place. A trophy goes on the shelf.',
  compFans: 'A top 3 finish. Fan rating +{n}.',
  compEntry: 'Entry fee',
  compPrize: 'Prize',
  you: 'You',
  shelfT: 'Trophy shelf',
  shelfEmpty: 'Win a competition to put a trophy here.',
  shelfAria: '{n} of 6 trophies',
  trophyAria: 'Season {y}, {contest}, first place',
  ribbonsLine: 'Ribbons: {n}',
  offT: 'Offseason',
  contractsT: 'Contracts ending',
  contractAsk: '{name}, {role}, asks {w} a cook',
  resign: 'Re-sign 1 season',
  resign2: 'Re-sign 2 seasons',
  release: 'Let go',
  contractsNone: 'No contracts end this season.',
  leavingT: 'Moving on',
  leaving: '{name} is moving on: {reason}',
  refers: '{name} refers a friend of {n} stars or better. The friend joins the week 1 Help wanted board.',
  refersNone: '{name} refers nobody.',
  leavingNone: 'Nobody is moving on.',
  nextT: 'Coming next',
  nextLine: '{label}, {price}',
  placeAria: 'Week {w}, {contest}, placed {place}',
  holdRail: 'HOLD {n}',
  turnIn: '{label} box scored {n}.',
  missed: 'Missed the {meat} turn-in.',
  fireBadge: 'FIRE'
};
function UX(key, map) {
  if (STRINGS.ui && STRINGS.ui[key] !== undefined) return U(key, map);
  return fill(CX[key] !== undefined ? CX[key] : '', map);
}
// Deviation 70: the four turn-ins of today's competition, normalized, or null. sim.compView() [S 19.9]:
// { cats, at, boxes [null or { score, done, hold, look, missed, judged, held }], next, pulled }; a
// sim without it falls back to the same names on today.comp.
function compView(s) {
  if (!isCompDay(s)) return null;
  let v = null;
  if (typeof sim.compView === 'function') { try { v = sim.compView(); } catch (e) { v = null; } }
  const c = v || s.today.comp || {};
  if (!Array.isArray(c.cats)) return null;
  const at = Array.isArray(c.at) ? c.at : (C.COMP_TURNINS || [45, 85, 125, 165]);
  const bx = Array.isArray(c.boxes) ? c.boxes : [];
  const rows = c.cats.map(function (m, i) {
    const b = bx[i] || null;
    const missed = !!(b && b.missed);
    const judged = !!(b && !missed && (b.judged === true || (b.judged === undefined && typeof b.score === 'number')));
    return { meat: m, at: at[i], missed: missed, inBox: !!(b && !missed && !judged), box: judged ? b : null };
  });
  let next = typeof c.next === 'number' ? c.next : -1;
  if (!v) for (let i = 0; i < rows.length && next < 0; i++) if (!rows[i].box && !rows[i].missed && !rows[i].inBox) next = i;
  return { contest: c.contest || '', rows: rows, next: next, pulled: c.pulled || null };
}
// Sim copy first (STRINGS[group][key], then STRINGS.ui[key]), else the CX fallback line.
function SX(group, key, map, cxKey) {
  const g = STRINGS[group];
  if (g && typeof g[key] === 'string') return fill(g[key], map);
  return UX(cxKey || key, map);
}
function contestName(id) {
  const t = STRINGS.contest && STRINGS.contest[id];
  return t ? String(t) : (CX.contest[id] || String(id || ''));
}
function ordinal(n) {
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  return n + suf;
}
function isCompDay(s) { return !!(s && s.phase === 'service' && s.today && s.today.comp); }
// Deviation 71: the Hold clock, seconds since the next category's piece came off the grate (compView's
// pulled: the piece in hand, on the board or with PREP), or null when none is off the grate.
function holdOf(s, v) {
  const r = v.next >= 0 ? v.rows[v.next] : null;
  if (!r || !v.pulled || typeof v.pulled[r.meat] !== 'number') return null;
  return Math.max(0, s.clock - v.pulled[r.meat]);
}

// Deviation 78: the competition rail. Playtest 2026-10-19: every pending turn-in counts down like the
// clock (it showed the next one as seconds left and the rest as start times, so 85 read as 85 s left).
function compRailStrs(v, s) {
  return {
    clock: String(Math.max(0, Math.ceil(tEnd(s) - s.clock))),
    rows: v.rows.map(function (r) {
      if (r.box) return String(Math.round(r.box.score) | 0);
      if (r.missed) return 'X';
      if (r.inBox) return 'IN';
      return String(Math.max(0, Math.ceil(r.at - s.clock)));
    })
  };
}
function drawCompRail(v, s) {
  const rs = compRailStrs(v, s);
  const clock = rs.clock, strs = rs.rows;
  const x0 = drawClockBox(clock);
  let w = 0;
  for (let i = 0; i < strs.length; i++) w += 2 + 8 + 1 + art.textWidth(strs[i]) + 2;
  const bw = Math.min(176 - x0, w + 2);
  if (strs.length && bw > 12) {
    octx.fillStyle = COLOR.U;
    octx.fillRect(x0, 1, bw, 11);
    railBoxes.items = [x0, bw];
  }
  let x = x0 - 1;
  for (let i = 0; i < v.rows.length; i++) {
    const r = v.rows[i], tw = art.textWidth(strs[i]);
    if (x + 2 + 8 + 1 + tw + 2 > x0 + bw) break;
    x += 2;
    D('icon_' + r.meat, x, 2);
    x += 9;
    octx.fillStyle = r.box || r.inBox ? COLOR.lawnA : r.missed ? '#c0392b' : i === v.next ? '#F3CF6D' : COLOR.C;
    octx.fillRect(x, 2, tw + 2, 9);
    T(strs[i], x + 1, 3, r.missed ? 'white' : 'K');
    x += tw + 2;
  }
  const h = holdOf(s, v);
  if (h !== null) {
    const hs = fill(UX('holdRail'), { n: Math.floor(h) });
    octx.fillStyle = h > 15 ? '#8a2a1c' : COLOR.U;
    octx.fillRect(1, 13, art.textWidth(hs) + 4, 11);
    T(hs, 3, 15, h > 15 ? 'yellow' : null);
  }
}

// Deviation 72: the judges' results card on the till (till.comp, the sim's finishComp() view).
function compBoxRow(b, i) {
  const m = b.meat;
  const label = MEATS[m] ? MEATS[m].label : String(m);
  const missed = !!b.missed;
  const score = typeof b.score === 'number' ? b.score : b.total;
  const detail = missed ? UX('boxMissed') : UX('boxLine', { d: (typeof b.done === 'number' ? b.done : b.don) | 0, h: b.hold | 0, l: b.look | 0 });
  const r = tillRow(label, detail, String(missed ? 0 : Math.round(score) | 0), 'cbox' + (missed ? ' missed' : ''));
  r.id = 'comp-box-' + (i + 1);
  const ic = sprEl('icon_' + m, 0, 2, null);
  if (ic) r.insertBefore(ic, r.firstChild);
  return r;
}
function buildCompReport(t, head, body) {
  const c = t.comp || {};
  const name = c.label || contestName(c.contest);
  el.till.classList.add('booking');
  el.till.insertBefore(repTop(t), head);
  const title = UX('compH', { contest: name });
  uiPut(head, title.toUpperCase(), title.length > 14 ? 2 : 3, UI.gold, { bold: true, shadow: UI.K }, title);   // 2x keeps a long contest name on a phone
  const table = Array.isArray(c.standings) ? c.standings : (Array.isArray(c.table) ? c.table : []);
  const n = typeof c.field === 'number' ? c.field : (table.length || 10);
  const place = c.place | 0;
  const placeText = SX('comp', 'place', { p: ordinal(place), n: n }, 'compPlace');
  const top = repBox('comp-place', null, 'cplace');
  top.appendChild(uiPut(mk('p', { id: 'comp-placed', cls: 'big' }), placeText.toUpperCase(), 3, place > 0 && place <= 3 ? UI.gold : UI.cream, { bold: true, shadow: UI.K }, placeText));
  top.appendChild(mk('p', { id: 'comp-total', text: UX('compTotal', { n: Math.round(c.total) | 0 }) }));
  if (c.trophy) top.appendChild(mk('p', { id: 'comp-trophy', cls: 'up' }, [trophyEl(3), SX('comp', 'trophy', null, 'trophyWon')]));
  else if (c.shelfFull) top.appendChild(mk('p', { id: 'comp-trophy', text: SX('comp', 'shelfFull', null, 'trophyWon') }));
  const rib = Array.isArray(c.ribbons) ? c.ribbons : [];
  const ribWords = rib.map(function (m) { return MEATS[m] ? MEATS[m].label.toLowerCase() : String(m); });
  top.appendChild(mk('p', { id: 'comp-ribbons', text: rib.length ? SX('comp', 'ribbon', { meat: andList(ribWords) }, 'ribbonOne') : UX('ribbonNone') }));
  if ((c.fans | 0) > 0) top.appendChild(mk('p', { id: 'comp-fans', text: SX('comp', 'fans', { n: c.fans | 0 }, 'compFans') }));
  body.appendChild(top);

  const boxes = repBox('comp-boxes', UX('boxesT'));
  const bl = Array.isArray(c.boxes) ? c.boxes : [];
  for (let i = 0; i < bl.length; i++) boxes.appendChild(compBoxRow(bl[i] || {}, i));
  body.appendChild(boxes);

  const fb = repBox('comp-field', UX('fieldT'));
  const ol = mk('ol', { id: 'comp-standings', cls: 'standings' });
  for (let i = 0; i < table.length; i++) {
    const f = table[i] || {};
    const you = !!f.you;
    ol.appendChild(mk('li', { id: you ? 'comp-you' : null, cls: you ? 'you' : null }, [
      mk('span', { cls: 'sp', text: ordinal(i + 1) }),
      mk('span', { cls: 'sn', text: (you ? (f.name || pitName(sim.state)) + ' (' + UX('you') + ')' : String(f.name || '')) }),
      mk('span', { cls: 'st', text: String(Math.round(f.total) | 0) })
    ]));
  }
  fb.appendChild(ol);
  body.appendChild(fb);

  const jd = Array.isArray(c.judges) ? c.judges : [];
  if (jd.length) {
    const jb = repBox('comp-judges', UX('judgesT'));
    jb.appendChild(mk('p', { id: 'comp-judge-names', text: andList(jd.map(String)) }));
    body.appendChild(jb);
  }

  const money = repBox('comp-money', U('money'), 'money', coinEl(2));
  money.appendChild(repRow(UX('compEntry'), null, minus((typeof c.entry === 'number' ? c.entry : t.entry) | 0)));
  money.appendChild(repRow(UX('compPrize'), null, plus(c.prize | 0)));
  body.appendChild(money);
  body.appendChild(nextButton());
  body.appendChild(tillNewButton());
}

// Deviation 73: the trophy shelf, six slots on a plank.
const TROPHY_MAP = ['.gggg.', 'gggggg', '.gggg.', '..gg..', '..gg..', '.wwww.'];
function trophyEl(scale) {
  if (art.has('trophy')) return sprEl('trophy', 0, scale, null);
  return pixCanvas(TROPHY_MAP, { g: '#F3CF6D', w: '#5a3412' }, scale);
}
function trophiesOf(s) {
  const t = Array.isArray(s.trophies) ? s.trophies : [];
  return t.slice(0, 6);
}
function ribbonsOf(s) {
  const r = s.ribbons;
  if (typeof r === 'number') return r | 0;
  let n = 0;
  if (r && typeof r === 'object') for (const k in r) n += r[k] | 0;
  return n;
}
function trophyShelf(s, id, always) {
  const tr = trophiesOf(s), rb = ribbonsOf(s);
  if (!always && tr.length === 0 && rb === 0) return null;
  const sec = mk('section', { id: id, cls: 'card3 shelf', attrs: { 'aria-labelledby': id + '-h' } });
  sec.appendChild(uiPut(mk('h3', { id: id + '-h' }), UX('shelfT').toUpperCase(), 2, UI.gold, { bold: true, shadow: UI.K }, UX('shelfT')));
  const row = mk('ol', { cls: 'plank', attrs: { 'aria-label': UX('shelfAria', { n: tr.length }) } });
  for (let i = 0; i < 6; i++) {
    const t = tr[i];
    const li = mk('li', { id: t ? id + '-t' + (i + 1) : null, cls: t ? 'won' : 'empty' });
    if (t) { li.setAttribute('aria-label', UX('trophyAria', { y: t.year | 0, contest: contestName(t.contest) })); li.appendChild(trophyEl(3)); }
    else li.setAttribute('aria-hidden', 'true');
    row.appendChild(li);
  }
  sec.appendChild(row);
  sec.appendChild(mk('p', { id: id + '-ribbons', cls: 'muted', text: tr.length || rb ? UX('ribbonsLine', { n: rb }) : UX('shelfEmpty') }));
  return sec;
}

// Deviation 74: a contract pick: sim.resign(id, 1 or 2) or sim.release(id) [S 19.9].
function contractAct(id, keep) {
  try {
    if (keep > 0 && typeof sim.resign === 'function') sim.resign(id, keep);
    else if (keep === 0 && typeof sim.release === 'function') sim.release(id);
  } catch (e) { fail(e); }
  pump();
  rebuildKeepFocus(buildSeasonEnd, 'season-end');
}
function offseasonBoxes(body, ov) {
  const s = sim.state;
  const shelf = trophyShelf(s, 'se-shelf', true);
  if (shelf) body.appendChild(shelf);
  if (!ov || !Array.isArray(ov.contracts)) return;
  const H = function (id, key, cx) {
    const t = SX('offseason', key, null, cx);
    return uiPut(mk('h3', { id: id }), t.toUpperCase(), 2, '#2a2015', null, t);
  };
  const exp = ov.contracts;
  const box = mk('section', { id: 'se-contracts', cls: 'se-box', attrs: { 'aria-labelledby': 'se-contracts-h' } });
  box.appendChild(H('se-contracts-h', 'contracts', 'contractsT'));
  if (!exp.length) box.appendChild(mk('p', { text: SX('offseason', 'noContracts', null, 'contractsNone') }));
  for (let i = 0; i < exp.length; i++) {
    const k = exp[i];
    if (!k) continue;
    const ask = SX('offseason', 'asks', { name: k.name || '', w: k.asks | 0 }, 'contractAsk');
    const line = mk('p', { id: 'se-ask-' + k.id, text: roleWord(k.role || 'run') + ', ' + starsText(k.stars) + '. ' + ask });
    const pick = function (bid, key, cx, dec, keep) {
      const b = btn(bid + k.id, SX('offseason', key, null, cx), 'alt', function () { contractAct(k.id, keep); });
      b.setAttribute('aria-pressed', String(k.decided === dec));
      return b;
    };
    box.appendChild(mk('div', { cls: 'se-contract' }, [line, mk('div', { cls: 'foot-row' }, [
      pick('se-sign1-', 'sign1', 'resign', 'sign1', 1), pick('se-sign2-', 'sign2', 'resign2', 'sign2', 2), pick('se-release-', 'letGo', 'release', 'go', 0)])]));
  }
  body.appendChild(box);
  const lv = Array.isArray(ov.leaving) ? ov.leaving : [];
  const lb = mk('section', { id: 'se-leaving', cls: 'se-box', attrs: { 'aria-labelledby': 'se-leaving-h' } });
  lb.appendChild(H('se-leaving-h', 'movingOn', 'leavingT'));
  if (!lv.length) lb.appendChild(mk('p', { text: SX('offseason', 'nobody', null, 'leavingNone') }));
  for (let i = 0; i < lv.length; i++) {
    const g = lv[i];
    if (!g) continue;
    lb.appendChild(mk('p', { id: 'se-leave-' + g.id, text: SX('offseason', 'leaves', { name: g.name || '', reason: g.reason || '' }, 'leaving') }));
    const ref = (g.refers | 0) > 0 || g.refers === true ? SX('offseason', 'refers', { name: g.name || '', n: half(typeof g.refers === 'number' ? g.refers : Math.max(1, (g.stars || 1) - 1)) }, 'refers') : SX('offseason', 'refersNone', { name: g.name || '' }, 'refersNone');
    lb.appendChild(mk('p', { id: 'se-refer-' + g.id, cls: 'se-note', text: ref }));
  }
  body.appendChild(lb);
  const nx = ov.next && typeof ov.next === 'object' ? ov.next : null;
  if (nx && nx.label) {
    const nb = mk('section', { id: 'se-next', cls: 'se-box', attrs: { 'aria-labelledby': 'se-next-h' } });
    nb.appendChild(H('se-next-h', 'comingNext', 'nextT'));
    nb.appendChild(mk('p', { id: 'se-next-line', text: UX('nextLine', { label: nx.label, price: fmt(nx.price | 0) }) }));
    body.appendChild(nb);
  }
}

// Deviation 75: the FIRE card's badge and the feed puffs.
const feedPuffs = [];   // { cooker, at }
let fedSeen = { card: null, bags: 0, day: -1 };
let simFeeds = false;   // true once the sim sends fire_fed [S 19.9]; the bag watcher then stands down
function watchFeeds(s) {
  if (simFeeds || typeof C.COMP_SECONDS === 'number') return;
  const t = s.tender;
  const rec = t && s.today && s.today.crew ? s.today.crew[String(t.cardId)] : null;
  if (!t || !rec || s.phase !== 'service') { fedSeen = { card: null, bags: 0, day: s.day }; return; }
  const bags = rec.bags | 0;
  if (fedSeen.card !== t.cardId || fedSeen.day !== s.day) { fedSeen = { card: t.cardId, bags: bags, day: s.day, cooker: t.cooker || null }; return; }
  // The sim clears t.cooker on the tick it adds the bag, so the cooker it walked to is remembered.
  const ck = t.cooker || fedSeen.cooker, fed = bags > fedSeen.bags;
  if (fed && ck) feedPuff(ck);
  fedSeen.bags = bags;
  fedSeen.cooker = t.cooker || (fed ? null : fedSeen.cooker);
}
function feedPuff(cooker) {
  const st = MAP.station(cooker);
  if (!st || !owned(st)) return;
  if (feedPuffs.length >= 8) feedPuffs.shift();
  feedPuffs.push({ cooker: cooker, at: tAnim });
  const vs = ventSim(st);
  log('fed', vs.x, vs.y);
}
const FEED_PUFF_S = 0.9;
function drawFireCues(s) {
  if (s.phase !== 'service') { feedPuffs.length = 0; return; }
  const t = s.tender;
  if (t) {
    // [S 19.8] playtest 2026-10-19: the text plate read as a big orange sign over the prep table on a
    // phone. The badge is now a 5 by 6 pixel flame just over the head, under a third of the sprite.
    const px = Math.round(t.px), py = Math.round(t.py);
    withShift(moverShift(px, py), function () {
      const bx = px + 6, by = py - 14;   // the old plate's bottom edge, py - 10
      octx.fillStyle = COLOR.outline;
      octx.fillRect(bx + 1, by - 1, 3, 1);
      octx.fillRect(bx, by, 5, 5);
      octx.fillStyle = '#d4581c';
      octx.fillRect(bx + 2, by, 1, 1);
      octx.fillRect(bx + 1, by + 1, 3, 3);
      octx.fillStyle = '#ffd23c';
      octx.fillRect(bx + 2, by + 2, 1, 2);
    });
  }
  for (let i = feedPuffs.length - 1; i >= 0; i--) {
    const p = feedPuffs[i], age = tAnim - p.at;
    if (age < 0 || age >= FEED_PUFF_S) { feedPuffs.splice(i, 1); continue; }
    const st = MAP.station(p.cooker);
    if (!st || !owned(st)) continue;
    const v = ventRp(stationArt(st));
    const u = age / FEED_PUFF_S, rise = reduced ? 0 : Math.round(18 * u), r = 2 + Math.round(4 * u);
    onWorld(function () {
      octx.save();
      octx.globalAlpha = 0.85 * (1 - u);
      octx.fillStyle = '#f4ead2';
      const cx = Math.round(v[0]), cy = Math.round(v[1]) - 6 - rise;
      octx.fillRect(cx - r, cy - r + 1, r * 2, r * 2 - 2);
      octx.fillRect(cx - r + 1, cy - r, r * 2 - 2, r * 2);
      octx.fillRect(cx - r - 3, cy + 2, r, r);
      octx.fillRect(cx + r, cy + 1, r, r);
      octx.fillStyle = '#ff9a3c';
      if (u < 0.5) octx.fillRect(cx - 1, cy + r + 2, 3, 3);
      octx.restore();
    });
  }
}

// ---------------------------------------------------------------- the season end card (W17.5)

function openSeasonEnd() {
  buildSeasonEnd();
  if (currentPanel !== 'season-end') openPanel('season-end');
}

function buildSeasonEnd() {
  const s = sim.state;
  const pv = typeof sim.seasonEndPreview === 'function' ? sim.seasonEndPreview() : null;
  const year = pv ? pv.year : (s.season ? s.season.year : 1);
  const ov = pv && Array.isArray(pv.contracts) ? pv : null;   // [S 19.9]: the Offseason fields
  const h = el['season-end-h'];
  clear(h);
  uiPut(h, U('seasonH', { y: year }).toUpperCase(), 3, UI.white, { bold: true, shadow: UI.ink }, U('seasonH', { y: year }));
  const body = el['season-end-body'];
  clear(body);
  const sign = mk('div', { id: 'se-pit', cls: 'sign' });
  signWords(sign, pitName(s), 1, el['season-end']);
  body.appendChild(sign);
  const box = mk('div', { cls: 'se-box' });
  box.appendChild(uiPut(mk('h3', { id: 'se-record-h' }), U('record').toUpperCase(), 2, '#2a2015', null, U('record')));
  const ol = mk('ol', { id: 'se-record', attrs: { 'aria-labelledby': 'se-record-h' } });
  const res = s.season && s.season.results ? s.season.results : [];
  const n = C.SEASON_WEEKS || 7;
  for (let i = 0; i < n; i++) {
    const r = res[i] || { type: 'yard', stars: 0 };
    const rec = ov && Array.isArray(ov.record) ? ov.record[i] : null;
    const place = (rec && rec.place) || r.place || 0;
    const comp = place > 0;
    const st = r.type === 'yard' || comp ? 0 : r.stars | 0;
    const aria = comp ? UX('placeAria', { w: i + 1, contest: (rec && rec.contest) || r.contest ? contestName((rec && rec.contest) || r.contest) : bookingLabel(r.type), place: ordinal(place) }) : U('wkDone', { w: i + 1, label: bookingLabel(r.type), stars: starsWord(st) });
    const li = mk('li', { id: 'se-wk-' + (i + 1), cls: 'se-wk', attrs: { 'aria-label': aria } });
    const inner = mk('div', { cls: 'tin', attrs: { 'aria-hidden': 'true' } });
    inner.appendChild(uiPut(mk('span', { cls: 'tn' }), String(i + 1), 2, UI.K));
    const ic = sprEl('ev_' + r.type, 0, 2, null) || (comp ? trophyEl(2) : null);
    if (ic) inner.appendChild(ic);
    const row = mk('span', { cls: 'tstars' });
    if (comp) row.appendChild(uiPut(mk('span', { cls: 'tplace' }), ordinal(place).toUpperCase(), 2, UI.K));
    else if (r.type !== 'yard') for (let k = 0; k < 5; k++) { const e = starEl(k < st, 1); if (e) row.appendChild(e); }
    inner.appendChild(row);
    li.appendChild(inner);
    ol.appendChild(li);
  }
  box.appendChild(ol);
  body.appendChild(box);
  offseasonBoxes(body, ov);
  const cbox = mk('div', { cls: 'se-box' });
  const P = pv || { cash: s.cash, repFrom: s.rep, repTo: s.rep, spoiled: {}, charcoal: s.charcoal };
  const meat = railList(P.spoiled, 'label');
  cbox.appendChild(mk('p', { id: 'se-cash', text: U('seCash', { c: fmt(P.cash) }) }));
  cbox.appendChild(mk('p', { id: 'se-rep', text: U('seRep', { b: P.repTo, a: P.repFrom }) }));
  cbox.appendChild(mk('p', { id: 'se-meat', text: meat ? U('seMeat', { list: meat }) : U('seMeatNone') }));
  cbox.appendChild(mk('p', { id: 'se-charcoal', text: U('seCharcoal', { n: P.charcoal }) }));
  // X5.9, X13.6: each card whose contract renews, at its new wage.
  const pc = pv && Array.isArray(pv.crew) && !ov ? pv.crew : [];
  for (let i = 0; i < pc.length; i++) {
    if (pc[i] && pc[i].renews) cbox.appendChild(mk('p', { id: 'se-crew-' + pc[i].id, cls: 'se-crew', text: U('seCrew', { name: pc[i].name, w: pc[i].wageTo }) }));
  }
  body.appendChild(cbox);
  const go = mk('button', { id: 'season-next', cls: 'primary big', type: 'button' });
  const label = U('seNext', { n: year + 1 });
  uiPut(go, label.toUpperCase(), 3, UI.creamL, { bold: true, shadow: UI.orangeLo }, label);
  go.addEventListener('click', function () {
    sim.startSeason();
    pump();
    showLoop();
    pump();
    updateDom();
  });
  body.appendChild(go);
}

// ---------------------------------------------------------------- v3.9 arrange mode

// Between days the hub's Your pit tab opens Arrange yard: tap a piece to lift it, tap a spot to set
// it down (desktop also drags). The footprint shows green or red with a short reason; an invalid
// drop is refused. No steps or distances anywhere: a tighter yard just plays faster.
// arr: { draft, lift, grab, aim: { layout, tiles, ok, reason } | null }
let arr = null;
let seenLK = null;
let deskSig = null;
let drawLog = [];
let lateBadges = [];  // this frame's station chips, redrawn over the canopy roof where it covers them     // the depth pass's labelled items in draw order, then canopy_roof (harness)   // the layout, gear and decor the desktop view was last framed for
let arrDrag = null;
function arrUnit(id) { return PitSim.UNITS.find(function (u) { return u.id === id; }) || null; }
function arrOff(lay, id) { const o = lay[id]; return o ? o : [0, 0]; }
function arrPreview() {
  if (!arr) return null;
  if (arr.aim && arr.aim.ok) return arr.aim.layout;
  return arr.draft;
}
// Keeps the sim's live layout on the preview and drops every cache that holds a position.
function layoutSync() {
  if (sim && typeof sim.previewLayout === 'function') sim.previewLayout(arrPreview());
  const k = typeof PitSim.layoutKey === 'function' ? PitSim.layoutKey() : '';
  if (k === seenLK) return;
  seenLK = k;
  SALE = null; TABLES = null; WORK = null;
  Object.keys(SEAT_TB).forEach(function (id) { delete SEAT_TB[id]; });
  for (let i = 0; i < MAP.seats.length; i++) SEAT_BY_ID[MAP.seats[i].id] = MAP.seats[i];
  const table = MAP.station('table');
  extTile = null;
  for (let i = 0; i < table.tiles.length; i++) if (table.tiles[i].gear === 'bigtable') extTile = table.tiles[i];
}
function arrMsg(text) {
  const m = document.getElementById('arr-msg');
  if (m && m.textContent !== text) m.textContent = text;
  arrTurnSync();
}
// v4.7: the Turn button shows only while a piece that turns (a 2 tile cooker) is lifted.
function arrTurnSync() {
  const b = document.getElementById('arr-turn');
  if (!b) return;
  const on = !!(arr && arr.lift && typeof sim.canTurnUnit === 'function' && sim.canTurnUnit(arr.lift));
  if (b.hidden === on) b.hidden = !on;
}
function arrLabel(id) {
  const v = sim.arrangeView().units.find(function (q) { return q.id === id; });
  if (v && v.label) return v.label;
  const u = arrUnit(id);
  return u ? u.label : 'It';
}
function arrIdle() { return 'Tap a piece of gear to pick it up.'; }
function arrLifted() {
  const t = typeof sim.canTurnUnit === 'function' && sim.canTurnUnit(arr.lift) ? ' Turn swaps which way it runs.' : '';
  return arrLabel(arr.lift) + ' picked up. Tap a spot to set it down.' + t;
}
function arrLift(id, x, y) {
  arr.lift = id; arr.grab = { x: x, y: y }; arr.aim = null;
  arr.turn = !!(arr.draft[id] && arr.draft[id][2] === 1);
}
// v4.7: Turn the lifted piece where it stands; when it does not fit there the red footprint shows
// it turned and the next tap places it turned.
function arrTurn() {
  if (!arr || !arr.lift || typeof sim.canTurnUnit !== 'function' || !sim.canTurnUnit(arr.lift)) return false;
  arr.turn = !arr.turn;
  const off = arrOff(arr.draft, arr.lift), s = sim.state;
  const r = sim.checkMove(arr.draft, arr.lift, [off[0], off[1], arr.turn ? 1 : 0]);
  // v4.8 (Joel on his phone: "you can't rotate equipment"): a turn that did not fit in place only drew
  // a red footprint, often off the edge of a phone's view (the stick burner sits at the left edge), so
  // Turn looked dead. Now the turned piece moves to the nearest spot it fits (up to 3 tiles away) and
  // shows turned there, still lifted; only when nothing near fits does the red footprint stay.
  let fit = r.ok ? r : null;
  for (let d = 1; !fit && d <= 3; d++) {
    for (let dx = -d; dx <= d && !fit; dx++) {
      const rest = d - Math.abs(dx);
      const dys = rest === 0 ? [0] : [rest, -rest];
      for (let k = 0; k < dys.length && !fit; k++) {
        const q = sim.checkMove(arr.draft, arr.lift, [off[0] + dx, off[1] + dys[k], arr.turn ? 1 : 0]);
        if (q.ok) fit = q;
      }
    }
  }
  if (fit) {
    arr.draft = fit.layout; arr.aim = null;
    const own = PitSim.unitTiles(fit.layout, arr.lift, s.gear, s.decor);
    if (fit !== r && own.length) arr.grab = { x: own[0].x, y: own[0].y };   // moved: the next tap places its first tile
    for (let i = 0; i < own.length; i++) camReveal(own[i].x, own[i].y);   // a phone's near view keeps the turned piece in sight
    arrMsg(arrLabel(arr.lift) + ' turned. Tap a spot to set it down, or tap it to leave it here.');
  } else {
    arr.aim = { layout: r.layout, ok: false, reason: r.reason, x: arr.grab.x, y: arr.grab.y, tiles: PitSim.unitTiles(r.layout, arr.lift, s.gear, s.decor) };
    arrMsg('Turned, but it does not fit here: ' + (r.reason || 'no room') + '. Tap a spot to set it down.');
  }
  return true;
}
function enterArrange() {
  if (!sim.canArrange()) return;
  arr = { draft: sim.arrangeView().layout, lift: null, grab: null, aim: null, turn: false };
  dropSheet();
  closePanel();
  el.root.classList.add('arranging');
  el.arrange.hidden = false;
  arrMsg(arrIdle());
  const d = document.getElementById('arr-done');
  if (d) d.focus();
}
function leaveArrange(save) {
  if (!arr) return;
  let r = { ok: true };
  if (save) r = sim.setLayout(arr.draft);
  arr = null; arrDrag = null;
  el.arrange.hidden = true;
  el.root.classList.remove('arranging');
  layoutSync();
  pump();
  if (save && r.ok) announce('Yard saved.');
  openWeek();
}
function arrReset() {
  if (!arr) return;
  arr.draft = {}; arr.lift = null; arr.aim = null;
  arrMsg('Back to the default yard. ' + arrIdle());
}
// The tile under a client point, and the movable piece there (by sprite first, then by tile).
function arrPick(clientX, clientY) {
  const w = clientToWorld(clientX, clientY);
  if (!(w.r.width > 0)) return null;
  const g = unIso(w.X / RS, w.Y / RS), tx = Math.floor(g.x / TILE), ty = Math.floor(g.y / TILE);
  const s = sim.state;
  let uid = PitSim.unitAt(arr.draft, tx, ty, s.gear, s.decor);
  if (!uid && !arr.lift) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (!h.st || !hitOne(h, w.X, w.Y)) continue;
      const u = PitSim.UNITS.find(function (q) { return q.stations.indexOf(h.st.id) !== -1; });
      if (u) { uid = u.id; break; }
    }
  }
  return { x: tx, y: ty, unit: uid };
}
// Where the lifted piece would go with its grabbed tile on (tx, ty).
function arrAim(tx, ty) {
  const off = arrOff(arr.draft, arr.lift);
  const want = [off[0] + tx - arr.grab.x, off[1] + ty - arr.grab.y, arr.turn ? 1 : 0];
  const r = sim.checkMove(arr.draft, arr.lift, want);
  const s = sim.state;
  return { layout: r.layout, ok: r.ok, reason: r.reason, x: tx, y: ty, tiles: PitSim.unitTiles(r.layout, arr.lift, s.gear, s.decor) };
}
function arrTap(clientX, clientY) {
  const p = arrPick(clientX, clientY);
  if (!p) return;
  if (!arr.lift) {
    if (!p.unit) { arrMsg(arrIdle()); return; }
    arrLift(p.unit, p.x, p.y);
    arrMsg(arrLifted());
    return;
  }
  const own = PitSim.unitTiles(arr.draft, arr.lift, sim.state.gear, sim.state.decor);
  if (hasTile(own, p.x, p.y)) { arr.lift = null; arr.aim = null; arrMsg(arrIdle()); return; }
  if (p.unit && p.unit !== arr.lift) {
    arrLift(p.unit, p.x, p.y);
    arrMsg(arrLifted());
    return;
  }
  arrDrop(p.x, p.y);
}
function arrDrop(tx, ty) {
  const a = arrAim(tx, ty);
  if (a.ok) {
    const nm = arrLabel(arr.lift);
    arr.draft = a.layout; arr.lift = null; arr.aim = null;
    arrMsg(nm + ' moved. ' + arrIdle());
    return true;
  }
  arr.aim = a;
  arrMsg(a.reason || 'That spot does not work.');
  return false;
}
function arrHover(e) {
  if (!arr || !arr.lift || arrDrag || e.pointerType === 'touch') return;
  const p = arrPick(e.clientX, e.clientY);
  if (!p) return;
  if (arr.aim && arr.aim.x === p.x && arr.aim.y === p.y) return;
  const own = PitSim.unitTiles(arr.draft, arr.lift, sim.state.gear, sim.state.decor);
  if (hasTile(own, p.x, p.y) && p.x === arr.grab.x && p.y === arr.grab.y) { arr.aim = null; arrMsg(arrLifted()); return; }
  arr.aim = arrAim(p.x, p.y);
  arrMsg(arr.aim.ok ? arrLifted() : arr.aim.reason);
}
function arrPtrDown(e) {
  const p = arrPick(e.clientX, e.clientY);
  if (p && p.unit && (!arr.lift || p.unit === arr.lift)) {
    arrDrag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, unit: p.unit, grab: { x: p.x, y: p.y }, moved: false };
    try { el.cv.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
    return true;
  }
  return false;
}
function arrPtrMove(e) {
  const d = arrDrag;
  if (!d || d.id !== e.pointerId) return false;
  if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) {
    d.moved = true;
    if (arr.lift !== d.unit) arrLift(d.unit, d.grab.x, d.grab.y); else arr.grab = d.grab;
    arrMsg(arrLifted());
  }
  if (d.moved) {
    const p = arrPick(e.clientX, e.clientY);
    if (p && !(arr.aim && arr.aim.x === p.x && arr.aim.y === p.y)) {
      arr.aim = arrAim(p.x, p.y);
      arrMsg(arr.aim.ok ? arrLifted() : arr.aim.reason);
    }
  }
  return true;
}
function arrPtrUp(e) {
  const d = arrDrag;
  if (!d || d.id !== e.pointerId) return false;
  arrDrag = null;
  if (!d.moved) { if (e.type === 'pointerup') arrTap(e.clientX, e.clientY); return true; }
  const p = arrPick(e.clientX, e.clientY);
  if (p) {
    const own = PitSim.unitTiles(arr.draft, arr.lift, sim.state.gear, sim.state.decor);
    if (p.x === arr.grab.x && p.y === arr.grab.y && hasTile(own, p.x, p.y)) { arr.aim = null; arrMsg(arrLifted()); }
    else arrDrop(p.x, p.y);
  }
  return true;
}
function tileDiamond(t, inset) {
  const k = inset || 0;
  const P = [vtxRp(t.x, t.y), vtxRp(t.x + 1, t.y), vtxRp(t.x + 1, t.y + 1), vtxRp(t.x, t.y + 1)];
  octx.beginPath();
  octx.moveTo(P[0][0], P[0][1] + k);
  octx.lineTo(P[1][0] - 2 * k, P[1][1]);
  octx.lineTo(P[2][0], P[2][1] - k);
  octx.lineTo(P[3][0] + 2 * k, P[3][1]);
  octx.closePath();
}
function drawFoot(tiles, col, fillA, dash) {
  for (let i = 0; i < tiles.length; i++) {
    tileDiamond(tiles[i], 1);
    octx.fillStyle = 'rgba(' + col + ', ' + fillA + ')';
    if (fillA > 0) octx.fill();
    octx.lineWidth = 2;
    octx.setLineDash(dash ? [4, 3] : []);
    octx.strokeStyle = 'rgba(' + col + ', 0.95)';
    octx.stroke();
  }
  octx.setLineDash([]);
}
function drawArrange(s) {
  if (!arr) return;
  onWorld(function () {
    if (!arr.lift) return;
    const own = PitSim.unitTiles(arr.draft, arr.lift, s.gear, s.decor);
    const a = arr.aim;
    if (a && a.ok) {
      drawFoot(own, '255, 214, 90', 0, true);
      drawFoot(a.tiles, '70, 220, 90', 0.38, false);
    } else {
      drawFoot(own, '255, 214, 90', 0.32, false);
      if (a) drawFoot(a.tiles.filter(function (t) { return t.x >= -1 && t.x <= MAP.W && t.y >= -1 && t.y <= MAP.H; }), '240, 60, 50', 0.42, false);
    }
  });
}
function buildArrangeBar() {
  const bar = mk('div', { id: 'arrange', attrs: { role: 'group', 'aria-label': 'Arrange yard' } });
  bar.hidden = true;
  bar.appendChild(mk('p', { id: 'arr-msg', attrs: { 'aria-live': 'polite' }, text: '' }));
  bar.appendChild(mk('div', { cls: 'arr-row' }, [
    btn('arr-cancel', 'Cancel', 'alt', function () { leaveArrange(false); }),
    btn('arr-reset', 'Reset to default', 'alt', arrReset),
    btn('arr-turn', 'Turn', 'alt', function () { arrTurn(); }),
    btn('arr-done', 'Done', 'primary', function () { leaveArrange(true); })
  ]));
  el.stage.appendChild(bar);
  el.arrange = bar;
  document.getElementById('arr-turn').hidden = true;
  // v4.8: the phone bar is one row of four, so the button reads Reset; its name stays the whole phrase.
  const rs = document.getElementById('arr-reset');
  rs.textContent = 'Reset'; rs.setAttribute('aria-label', 'Reset to default');
  el.cv.addEventListener('pointermove', arrHover);
}
// The hint line, once, the first hub after week 1 (a per browser note; the save is unchanged).
let arrTipWeek = null;
function arrangeTip(se) {
  if (!se || (se.week | 0) < 2) return null;
  let seen = null;
  try { seen = localStorage.getItem('hs.pitsim.tip'); } catch (e) { seen = 'x'; }
  if (seen && arrTipWeek !== (se.week | 0)) return null;
  if (!seen) { arrTipWeek = se.week | 0; try { localStorage.setItem('hs.pitsim.tip', '1'); } catch (e) { /* no storage */ } }
  return mk('p', { id: 'arrange-tip', cls: 'muted', text: 'Tip: Arrange yard lets you move your gear.' });
}

// ---------------------------------------------------------------- input

function setupInput() {
  el.cv.addEventListener('pointerdown', onPtrDown);
  el.cv.addEventListener('pointermove', onPtrMove);
  el.cv.addEventListener('pointerup', onPtrUp);
  el.cv.addEventListener('pointercancel', onPtrUp);
  el.cv.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  el.act.addEventListener('click', onAct);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', function () { held.clear(); });
  document.addEventListener('visibilitychange', onVisibility);
}


function extRect() {
  const sz = size('counter_ext');
  return { x: extTile.x * TILE, y: (extTile.y + 1) * TILE - sz[1], w: sz[0], h: sz[1] };
}



// v3.6 (spec C, F): a pointer that moves more than 8 CSS px is a drag that pans the camera, never a
// tap; two pointers pinch (together: far view, apart: near view, centred on the pinch); a pointer
// that lifts without dragging taps.
// v4.5 (Joel 2026-10-20 on his phone, "the touch sensor is confused as to where I am tapping"): the
// tap is resolved where the finger came DOWN (the world point and what is under it), with the camera
// as it stood then; the follow camera eases while the pitmaster walks, so the yard slid under a
// resting finger and the lift landed off target. A touch may wobble 12 CSS px and still tap (a mouse 8).
const TAP_SLOP = Object.freeze({ mouse: 8, touch: 12 });
const ptrs = new Map();
let dragP = null, pinchP = null;
function tapResolve(clientX, clientY) {
  const w = clientToWorld(clientX, clientY);
  if (!(w.r.width > 0 && w.r.height > 0)) return null;
  return { X: w.X, Y: w.Y, hit: hitWorld(w.X, w.Y), at: tAnim };
}
function onPtrDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (currentPanel && !saleTaps()) return;
  if (arr && ptrs.size === 0 && arrPtrDown(e)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { el.cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  if (ptrs.size === 2) {
    const p = Array.from(ptrs.values());
    pinchP = { d0: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, done: false };
    dragP = null;
  } else if (ptrs.size === 1) {
    const slop = e.pointerType === 'mouse' ? TAP_SLOP.mouse : TAP_SLOP.touch;
    let pre = null;
    try { pre = tapResolve(e.clientX, e.clientY); } catch (err) { pre = null; }
    dragP = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, slop: slop, pre: pre };
  }
}
function onPtrMove(e) {
  if (arr && arrPtrMove(e)) return;
  const q = ptrs.get(e.pointerId);
  if (!q) return;
  q.x = e.clientX; q.y = e.clientY;
  if (pinchP && ptrs.size >= 2) {
    const p = Array.from(ptrs.values());
    const r = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / pinchP.d0;
    if (!pinchP.done && r < 0.8 && cam.mode === 'near') { camSet('far'); pinchP.done = true; }
    else if (!pinchP.done && r > 1.25 && cam.mode === 'far') {
      const w = clientToWorld((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
      camSet('near', w.X, w.Y);
      pinchP.done = true;
    }
    return;
  }
  if (!dragP || dragP.id !== e.pointerId) return;
  if (!dragP.moved && Math.hypot(e.clientX - dragP.x0, e.clientY - dragP.y0) > dragP.slop) dragP.moved = true;
  if (dragP.moved) camPan(e.clientX - dragP.lx, e.clientY - dragP.ly);
  dragP.lx = e.clientX; dragP.ly = e.clientY;
}
function onPtrUp(e) {
  if (arr && arrPtrUp(e)) return;
  const had = ptrs.delete(e.pointerId);
  if (pinchP) { if (ptrs.size === 0) pinchP = null; dragP = null; return; }
  const d = dragP;
  if (d && d.id === e.pointerId) dragP = null;
  if (had && e.type === 'pointerup' && d && d.id === e.pointerId && !d.moved) tapAt(d.x0, d.y0, d.pre);
}

// The last taps as the game resolved them (harness): { kind, guest, x, y, ok, at }.
const tapLog = [];
function tapAt(clientX, clientY, pre) {
  if (currentPanel) {
    // v3.4: with the Shop or Gear sheet open beside the yard (desktop), a "+" picks its row there.
    if (!saleTaps()) return;
    const h0 = pre ? pre.hit : (function () { const w0 = clientToWorld(clientX, clientY); return w0.r.width > 0 ? hitWorld(w0.X, w0.Y) : {}; })();
    if (h0.plus) openForSale(h0.plus);
    return;
  }
  if (arr) { arrTap(clientX, clientY); return; }
  const s = sim.state;
  if (s.paused || s.phase !== 'service') return;
  let hit = pre ? pre.hit : null;
  if (!hit) {
    const w = clientToWorld(clientX, clientY);
    if (!(w.r.width > 0 && w.r.height > 0)) return;
    hit = hitWorld(w.X, w.Y);
  }
  if (hit.plus) { openForSale(hit.plus); return; }
  let tx = -1, ty = -1, ok = false;
  if (hit.guest !== undefined) {
    // v4.5: the ring goes under the guest (their seat, or the tile they stand on).
    const c = s.customers.find(function (o) { return o.id === hit.guest; }) || null;
    const se = c ? seatOf(c) : null;
    const sat = se && c && (c.mode === 'seated' || c.mode === 'eating' || (c.mode === 'toSeat' && c.next === null && c.path.length === 0));
    if (c) { tx = sat ? se.x : Math.round(c.px / TILE); ty = sat ? se.y : Math.round(c.py / TILE); }
    ok = sim.walkToGuest(hit.guest) === true;
  } else {
    if (hit.st) { tx = hit.st.tiles[0].x; ty = hit.st.tiles[0].y; }
    else if (hit.tile) { tx = hit.tile.x; ty = hit.tile.y; }
    ok = sim.walkTo(tx, ty) === true;
  }
  pump();
  if (ok) cam.follow = true;
  tapLog.push({ kind: hit.guest !== undefined ? 'guest' : hit.st ? 'station' : 'tile', guest: hit.guest !== undefined ? hit.guest : null, st: hit.st ? hit.st.id : null, x: tx, y: ty, ok: ok, at: tAnim });
  if (tapLog.length > 12) tapLog.shift();
  if (tx >= 0 && tx < MAP.W && ty >= 0 && ty < MAP.H) {
    rings.push({ x: tx * TILE, y: ty * TILE, at: tAnim, ok: ok });
    if (rings.length > 6) rings.shift();
    log('ring', tx * TILE, ty * TILE);
  }
  if (ok && !reduced) {
    squashAt = tAnim;
    const p = sim.state.player;
    log('squash', Math.round(p.px) - 1, Math.round(p.py) + TILE - 22);
  }
}

// A tap on a "+": the game pauses and the Gear list opens on that row, highlighted (spec D).
function openForSale(id) {
  const s = sim.state;
  if (currentPanel === 'sheet') { openSheet('gear', sheetOpener, sheetFrom); }   // v3.4: from the open sheet
  else {
    if (s.phase === 'service' && !s.paused) sim.setPaused(true);
    openSheet('gear', null, 'yard');
  }
  syncSheetRows();
  const row = el['sheet-body'] ? el['sheet-body'].querySelector('[data-item="' + id + '"]') : null;
  if (row) {
    row.classList.add('hl');
    if (typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'center' });
  }
  announce((CATALOG.find(function (r) { return r.id === id; }) || { label: id }).label + ', in the Gear list.');
}
function syncSheetRows() { for (let i = 0; i < sheetRows.length; i++) sheetRows[i](); }

// The backyard patch with the draft look (spec E): the in-yard pitmaster on three by three pavers
// with a kettle beside him, 1:1 rp at the phone near scale (round(1.5 dpr) device px per rp; the two
// column layout round(2 dpr)).
function drawCreatorScene() {
  const cv = document.getElementById('cr-scene');
  if (!cv || !B3) return;
  if (!crOff) crOff = document.createElement('canvas');
  const P = B3.PREVIEW;
  if (crOff.width !== P.w || crOff.height !== P.h) { crOff.width = P.w; crOff.height = P.h; }
  const g = crOff.getContext('2d');
  B3.preview(g, null);
  previewLook = B3.previewLook;
  const d = dpr();
  const phone = (document.documentElement.clientWidth || 375) < 900;
  const k = Math.max(1, Math.round((phone ? 1.5 : 2) * d));
  if (cv.width !== P.w * k || cv.height !== P.h * k) { cv.width = P.w * k; cv.height = P.h * k; }
  cv.style.width = (P.w * k / d) + 'px';
  cv.style.height = (P.h * k / d) + 'px';
  const vg = cv.getContext('2d');
  vg.imageSmoothingEnabled = false;
  vg.drawImage(crOff, 0, 0, P.w, P.h, 0, 0, P.w * k, P.h * k);
  // R-14 and Q-6: focused rows scroll clear of the sticky preview and the sticky Fire it up.
  const pvw = document.getElementById('cr-preview'), foot = document.getElementById('cr-foot');
  if (el.creator) {
    el.creator.style.scrollPaddingTop = phone && pvw ? (pvw.offsetHeight + 8) + 'px' : '';
    el.creator.style.scrollPaddingBottom = phone && foot ? (foot.offsetHeight + 8) + 'px' : '';
  }
}

function onAct() {
  if (currentPanel) return;
  const r = sim.interact();
  pump();
  if (r && r.ok) feedback();
}

function feedback() {
  if (reduced) return;
  el.act.style.transform = 'scale(0.96)';
  setTimeout(function () { el.act.style.transform = ''; }, 100);
}

// Joel 2026-10-20: the desktop hub's side panel sits beside the yard, not over it, so the walk keys
// still walk there (every other panel covers the yard or is a dialog).
function besideYard() { return (currentPanel === 'clipboard' || currentPanel === 'week') && !!(mqDesktop && mqDesktop.matches); }
function typing(t) {
  const tag = t && t.tagName ? t.tagName : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(t && t.isContentEditable);
}
// Arrange: arrow keys move the lifted piece's preview a tile, Enter or Space sets it down.
function arrKey(e, key, dir) {
  if (!arr || !arr.lift || !arr.grab) return false;
  if (dir) {
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const at = arr.aim ? arr.aim : arr.grab;
    arr.aim = arrAim(at.x + v[0], at.y + v[1]);
    arrMsg(arr.aim.ok ? arrLifted() : arr.aim.reason);
    return true;
  }
  if ((key === 'Enter' || key === ' ') && arr.aim) { arrDrop(arr.aim.x, arr.aim.y); return true; }
  if (key === 'r' || key === 'R') return arrTurn();   // v4.7
  return false;
}

function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key || '';
  const lower = key.length === 1 ? key.toLowerCase() : key;
  if (howtoOpen) {
    if (key === 'Escape') { e.preventDefault(); closeHowto(); }
    return;
  }
  if (arr && !currentPanel) {
    if (key === 'Escape') { e.preventDefault(); leaveArrange(false); return; }
    if (typing(e.target)) return;
    const adir = DIRS[key] || DIRS[lower];
    if (arrKey(e, key, adir)) { e.preventDefault(); return; }
    return;
  }
  if (besideYard() && !typing(e.target)) {
    const hdir = DIRS[key] || DIRS[lower];
    if (hdir) {
      e.preventDefault();
      if (!e.repeat) { held.add(hdir); sim.move(hdir); pump(); }
      return;
    }
  }
  if (currentPanel) {
    if (currentPanel === 'pause' && (key === 'Escape' || lower === 'p')) {
      e.preventDefault();
      if (!e.repeat) resumeFromPause();
    } else if (currentPanel === 'tester' && key === 'Escape') {
      e.preventDefault();
      closeTester();
    } else if (currentPanel === 'newgame' && key === 'Escape') {
      e.preventDefault();
      confirmNo();
    } else if (currentPanel === 'sheet' && key === 'Escape') {
      e.preventDefault();
      closeSheet();
    } else if (currentPanel === 'card' && key === 'Escape') {
      e.preventDefault();
      cardBack();
    } else if (currentPanel === 'creator' && crFromPause && key === 'Escape') {
      e.preventDefault();
      creatorBack();
    }
    return;
  }
  const t = e.target;
  const tag = t && t.tagName ? t.tagName : '';
  const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const dir = DIRS[key] || DIRS[lower];
  if (dir) {
    if (typing(t)) return;
    e.preventDefault();
    if (!e.repeat) { held.add(dir); sim.move(dir); pump(); }
    return;
  }
  if (key === ' ' || lower === 'e') {
    if (key === ' ' && onControl) return;
    e.preventDefault();
    if (!e.repeat) onAct();
    return;
  }
  if (key.length === 1 && key >= '1' && key <= '5') {
    e.preventDefault();
    if (!e.repeat) {
      for (let i = 0; i < MEAT_IDS.length; i++) {
        if (MEATS[MEAT_IDS[i]].key === key) { sim.selectMeat(MEAT_IDS[i]); pump(); break; }
      }
    }
    return;
  }
  if (lower === 'q') {
    e.preventDefault();
    if (!e.repeat) { sim.cycleMeat(e.shiftKey ? -1 : 1); pump(); }
    return;
  }
  if (key === 'Escape' || lower === 'p') {
    if (sim.state.phase === 'service') {
      e.preventDefault();
      if (!e.repeat) togglePause();
    }
  }
}

function onKeyUp(e) {
  const key = e.key || '';
  const lower = key.length === 1 ? key.toLowerCase() : key;
  const dir = DIRS[key] || DIRS[lower];
  if (dir) held.delete(dir);
}

function onVisibility() {
  if (document.hidden) {
    held.clear();
    const s = sim.state;
    if (s.phase === 'service' && !s.paused && !currentPanel) {
      sim.setPaused(true);
      openPanel('pause');
      updateDom();
    }
  } else {
    last = null;
  }
}

// ---------------------------------------------------------------- effects

function clearFx() {
  nums.length = 0; sparkles.length = 0; hearts.length = 0; puffs.length = 0; rings.length = 0;
  markX.clear(); sweatAt.clear(); columnT.clear();
  for (const k in puffT) delete puffT[k];
  for (const k in puffOn) delete puffOn[k];
  for (const k in warnOn) delete warnOn[k];
  rainDrops = null;
  squashAt = -1;
  zzzSince = null; zzzAt = -1;
  birdUntil = -1; birdNext = tAnim + birdGap();
  shakeUntil = 0;
}

function ovW() { return ov ? ov.width / RS : SW; }
function ovH() { return ov ? ov.height / RS : SH; }
function birdGap() { return FX.BIRD_GAP_MIN + (FX.BIRD_GAP_MAX - FX.BIRD_GAP_MIN) * crng(); }

function piecePos(st, p) {
  const o = st.slotPx && st.slotPx[p.slot] ? st.slotPx[p.slot] : { x: 3, y: 3 };
  return { x: st.tiles[0].x * TILE + o.x, y: st.tiles[0].y * TILE + o.y };
}

function burntBurst(cooker) {
  const st = MAP.station(cooker);
  const ck = sim.state.stations[cooker];
  if (!st || !ck) return;
  let best = null;
  for (let i = 0; i < ck.pieces.length; i++) {
    const p = ck.pieces[i];
    if (p.state !== 'burnt') continue;
    if (best === null || (p.burntAt || 0) >= (best.burntAt || 0)) best = p;
  }
  if (!best) return;
  const pos = piecePos(st, best);
  for (let i = 0; i < BURST_OFFS.length; i++) {
    spawnPuff(pos.x + BURST_OFFS[i][0], pos.y + BURST_OFFS[i][1], 0, FX.BURNT_RISE_PX_S, FX.BURNT_BURST_S, true, false);
  }
  log('burnt', pos.x + BURST_OFFS[0][0], pos.y + BURST_OFFS[0][1]);
}

// A chimney stream drifts away from the cooler's column so the smoke never sits over it.
function puffDrift(st) {
  const r = crng();
  const cooler = MAP.station('cooler');
  const away = cooler ? Math.sign(st.tiles[0].x - cooler.tiles[0].x) : 0;
  return away === 0 ? r * 2 - 1 : away * r;
}

function spawnPuff(x, y, vx, rise, life, dark, sway, src) {
  if (puffs.length >= 60) puffs.shift();
  puffs.push({ x0: x, y0: y, vx: vx, rise: rise, life: life, at: tAnim, dark: dark, sway: sway, src: src || null });
}

// Watches the sim for the cues that have no event: the buddy's zzz, sweat drops, and the dog
// going home at the panels. Starts no timer and moves nothing on the effect clock.
function observe() {
  const s = sim.state;
  const service = s.phase === 'service';
  watchFeeds(s);
  watchCarry(s);   // v4.9
  // A cooker's warning bubble starting logs one 'warn' at the bubble (K10).
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (st.type !== 'cooker') continue;
    const on = service && owned(st) && cookerWarns(s.stations[st.id]);
    if (on && !warnOn[st.id]) { const bp = warnBubblePos(st); log('warn', bp.x, bp.y); }
    warnOn[st.id] = on;
  }
  if (!service || reduced) {
    const h = MAP.dogHome;
    if (dog.x !== h.x || dog.y !== h.y || dog.px !== h.x * TILE || dog.py !== h.y * TILE || dog.frame !== 2 || dogAI.next) dogReset(2);
  }
  const b = s.buddy;
  if (service && b && b.task === 'idle') {
    if (zzzSince === null) zzzSince = s.clock;
    if (s.clock - zzzSince >= C.ZZZ_AFTER) {
      if (zzzAt < 0) {
        zzzAt = tAnim;
        log('zzz', Math.round(b.px) + 10, Math.round(b.py) - 14);
      }
    } else {
      zzzAt = -1;
    }
  } else {
    zzzSince = null; zzzAt = -1;
  }
  if (service || sweatAt.size) {
    const seen = new Set();
    for (let i = 0; i < s.customers.length; i++) {
      const c = s.customers[i];
      if (!sweating(c)) continue;
      seen.add(c.id);
      if (!sweatAt.has(c.id)) {
        sweatAt.set(c.id, tAnim);
        log('sweat', Math.round(c.px) + 12, Math.round(c.py) - 6);
      }
    }
    sweatAt.forEach(function (t, id) { if (!seen.has(id)) sweatAt.delete(id); });
  }
}

function sweating(c) {
  return (c.mode === 'waiting' || waitsPlate(c)) && c.patienceMax > 0 && c.patience <= c.patienceMax * C.SWEAT_FRAC;
}

function updateFx(dt) {
  const s = sim.state;

  // Chimney puffs on lit cookers and the smoke column over burnt pieces.
  if (!reduced) {
    const live = new Set();
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (st.type !== 'cooker') continue;
      const ck = s.stations[st.id];
      if (!ck || !owned(st)) { puffOn[st.id] = false; continue; }
      const tx = st.tiles[0].x * TILE, ty = st.tiles[0].y * TILE;
      const band = PitSim.fireBand(ck.fire);
      if (band === 'out') {
        puffOn[st.id] = false;
        puffT[st.id] = 0;
      } else {
        const every = band === 'low' ? FX.PUFF_EVERY_LOW : band === 'good' ? FX.PUFF_EVERY_GOOD : FX.PUFF_EVERY_HOT;
        puffT[st.id] = (puffT[st.id] || 0) - dt;
        if (puffT[st.id] <= 0) {
          puffT[st.id] = every;
          const vent = ventSim(st);
          const life = FX.PUFF_LIFE_MIN + (FX.PUFF_LIFE_MAX - FX.PUFF_LIFE_MIN) * crng();
          spawnPuff(vent.x - SMOKE_HALF_W, vent.y, puffDrift(st) * FX.PUFF_DRIFT_PX_S, FX.PUFF_RISE_PX_S, life, cookerWarns(ck), false, st.id);
          if (!puffOn[st.id]) { puffOn[st.id] = true; log('puff', vent.x, vent.y); }
        }
      }
      for (let j = 0; j < ck.pieces.length; j++) {
        const p = ck.pieces[j];
        if (p.state !== 'burnt') continue;
        const key = st.id + ':' + p.id;
        live.add(key);
        const pos = piecePos(st, p);
        let left = columnT.get(key);
        if (left === undefined) { left = 0; log('column', pos.x + 1, pos.y - 3); }
        left -= dt;
        if (left <= 0) {
          left = FX.BURNT_COLUMN_EVERY;
          spawnPuff(pos.x + 1, pos.y - 3, 0, FX.BURNT_COLUMN_RISE_PX_S, FX.BURNT_COLUMN_LIFE, true, true);
        }
        columnT.set(key, left);
      }
    }
    columnT.forEach(function (v, k) { if (!live.has(k)) columnT.delete(k); });
  }

  // Expire.
  for (let i = puffs.length - 1; i >= 0; i--) if (tAnim - puffs[i].at >= puffs[i].life) puffs.splice(i, 1);
  for (let i = nums.length - 1; i >= 0; i--) if (tAnim - nums[i].at >= FX.NUMBER_S) nums.splice(i, 1);
  for (let i = sparkles.length - 1; i >= 0; i--) if (tAnim - sparkles[i].at >= FX.SPARKLE_S) sparkles.splice(i, 1);
  for (let i = hearts.length - 1; i >= 0; i--) if (tAnim - hearts[i].at >= FX.HEART_S) hearts.splice(i, 1);
  for (let i = rings.length - 1; i >= 0; i--) if (tAnim - rings[i].at >= FX.TAP_RING_S) rings.splice(i, 1);
  if (markX.size) markX.forEach(function (until, id) { if (until <= tAnim) markX.delete(id); });
  if (squashAt >= 0 && tAnim - squashAt >= FX.SQUASH_S) squashAt = -1;

  // The bird at the bath.
  if (s.decor && s.decor.birdbath === true && !reduced) {
    if (birdUntil >= 0 && tAnim >= birdUntil) { birdUntil = -1; birdNext = tAnim + birdGap(); }
    if (birdUntil < 0 && tAnim >= birdNext) {
      birdUntil = tAnim + FX.BIRD_SHOW_S;
      const bath = decorDraw('birdbath', 'birdbath');
      if (bath) log('bird', bath.x, bath.y);
    }
  } else {
    birdUntil = -1;
  }

  // The dog.
  if (!reduced) updateDog(dt);

  // Rain.
  if (s.rain && !reduced) {
    if (!rainDrops) {
      rainDrops = [];
      for (let i = 0; i < 40; i++) rainDrops.push({ x: Math.floor(crng() * ovW()), y: crng() * ovH(), v: 70 + crng() * 40 });
    }
    for (let i = 0; i < rainDrops.length; i++) {
      const d = rainDrops[i];
      d.y += d.v * dt;
      if (d.y > ovH()) { d.y = -3; d.x = Math.floor(crng() * ovW()); }
    }
  }
}

function decorDraw(spotId, sprite) {
  for (let i = 0; i < MAP.decor.length; i++) {
    const spot = MAP.decor[i];
    if (spot.id !== spotId) continue;
    for (let j = 0; j < spot.draws.length; j++) if (spot.draws[j].sprite === sprite) return spot.draws[j];
  }
  return null;
}

// ---------------------------------------------------------------- the dog

function dogReset(frame) {
  const h = MAP.dogHome;
  dog.x = h.x; dog.y = h.y; dog.px = h.x * TILE; dog.py = h.y * TILE;
  dog.frame = frame; dog.flip = false;
  dogAI.path = []; dogAI.next = null; dogAI.anim = 0;
  dogAI.wait = FX.DOG_WAIT_MIN + FX.DOG_WAIT_SPREAD * crng();
}

function dogOpen(x, y) {
  return x >= 0 && y >= 0 && x < MAP.W && y < MAP.H && y <= MAP.H - 2 && sim.custWalkable(x, y, -1, -1) === true;
}

// 4 direction BFS, neighbors up, down, left, right; returns the tiles after the start, or null.
function dogPath(sx, sy, gx, gy) {
  if (!dogOpen(gx, gy)) return null;
  const W = MAP.W, n = W * MAP.H;
  const prev = new Int16Array(n).fill(-1);
  const start = sy * W + sx, goal = gy * W + gx;
  prev[start] = start;
  const q = [start];
  const NB = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi];
    if (cur === goal) break;
    const cx = cur % W, cy = (cur - cx) / W;
    for (let d = 0; d < 4; d++) {
      const nx = cx + NB[d][0], ny = cy + NB[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= MAP.H) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1 || !dogOpen(nx, ny)) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (prev[goal] === -1) return null;
  const path = [];
  for (let c = goal; c !== start; c = prev[c]) path.push({ x: c % W, y: Math.floor(c / W) });
  path.reverse();
  return path;
}

function dogFaceNext() {
  const nx = dogAI.next;
  if (nx.x < dog.x) dog.flip = false;
  else if (nx.x > dog.x) dog.flip = true;
}

function dogArrive() {
  const h = MAP.dogHome;
  dog.frame = (dog.x === h.x && dog.y === h.y) ? 3 : 2;
  dogAI.wait = FX.DOG_WAIT_MIN + FX.DOG_WAIT_SPREAD * crng();
  dogAI.anim = 0;
}

function dogPick() {
  const cands = [];
  for (let i = 0; i < MAP.dogRoam.length; i++) {
    const t = MAP.dogRoam[i];
    if ((t.x !== dog.x || t.y !== dog.y) && !seatTakenBelow(t.x, t.y) && !nearStation(t.x, t.y)) cands.push(t);
  }
  const goal = cands.length ? cands[Math.min(cands.length - 1, Math.floor(crng() * cands.length))] : null;
  const path = goal ? dogPath(dog.x, dog.y, goal.x, goal.y) : null;
  if (!path || !path.length) { dogAI.wait = FX.DOG_WAIT_MIN + FX.DOG_WAIT_SPREAD * crng(); return; }
  dogAI.path = path;
  dogAI.next = dogAI.path.shift();
  dogAI.anim = 0;
  dogFaceNext();
}

// True when the tile south of (x, y) is a seat someone has taken (round 2): the dog does not
// stand behind a seated customer's head.
function seatTakenBelow(x, y) {
  const seats = sim.state.seats || {};
  const all = MAP.seats.concat(hostNow().seats);
  for (let i = 0; i < all.length; i++) {
    const st = all[i];
    if (st.x === x && st.y === y + 1 && seats[st.id] !== null && seats[st.id] !== undefined) return true;
  }
  return false;
}

function updateDog(dt) {
  if (sim.state.phase !== 'service') return;
  if (!dogAI.next) {
    dogAI.wait -= dt;
    if (dogAI.wait <= 0) dogPick();
    if (!dogAI.next) return;
  }
  dogAI.anim += dt;
  let budget = FX.DOG_TILES_PER_S * TILE * dt;
  while (dogAI.next && budget > 0) {
    const tx = dogAI.next.x * TILE, ty = dogAI.next.y * TILE;
    const dx = tx - dog.px, dy = ty - dog.py;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= budget) {
      budget -= dist;
      dog.px = tx; dog.py = ty; dog.x = dogAI.next.x; dog.y = dogAI.next.y;
      dogAI.next = dogAI.path.length ? dogAI.path.shift() : null;
      if (dogAI.next) dogFaceNext();
      else { dogArrive(); return; }
    } else {
      if (dx !== 0) dog.px += Math.sign(dx) * Math.min(Math.abs(dx), budget);
      else dog.py += Math.sign(dy) * Math.min(Math.abs(dy), budget);
      budget = 0;
    }
  }
  if (dogAI.next) dog.frame = Math.floor(dogAI.anim * 6) % 2;
}

// ---------------------------------------------------------------- v3.6: the world, the camera, the depth pass

// The angle redo (spec 2026-10-19 C): sim px (sx, sy) on the ground sits at world render px
// X = OX + 1.5 (sx - sy), Y = OY + 0.75 (sx + sy), so a 16 px tile is a 48 by 24 diamond and a person
// keeps its 47 rp. The off canvas holds the whole 656 by 434 rp world (the barn end and the fence corners inside); octx keeps the RS transform, so
// octx units are rp / RS and every v2 draw (people, hand items, effects) still goes through D() in sim
// px, moved onto the world by a shift. Stations, props and decor draw by their art3 anchors (rule.js)
// at world rp. The camera picks the part of the world the yard canvas shows.
const WORLD = Object.freeze({ W: 656, H: 434, OX: 300, OY: 150, SX: 1.5, SY: 0.75 });
const OV_MIN_RW = 352;                        // the overlay (clock, rail, banner) keeps its v3.5 size
const OV_MIN_RW_DESK = 480;                  // v3.4 desktop: 2x at a 1400 px canvas, not 3x or 4x
const SKY = '#9fd8f2';
let SW = WORLD.W / RS, SH = WORLD.H / RS;     // the canvas being drawn, in octx units (world, then overlay)
const VIEW = { x0: 0, w: WORLD.W / RS };      // what the camera shows, in octx units (number clamps)
let A3 = null;                                // PitSim.art3 once the bridge booted
let wctx = null, ov = null, ovctx = null;     // the world's context, the overlay canvas and its context
let zoomBtn = null;
let ovRec = false;                            // drawing the overlay (records map to the v3.5 canvas)
let previewLook = null;
function isoX(sx, sy) { return (WORLD.OX + WORLD.SX * (sx - sy)) / RS; }
function isoY(sx, sy) { return (WORLD.OY + WORLD.SY * (sx + sy)) / RS; }
function halfPx(v) { return Math.round(v * RS) / RS; }
// Screen units back to the sim px point on the ground.
function unIso(ux, uy) {
  const a = (ux * RS - WORLD.OX) / WORLD.SX, b = (uy * RS - WORLD.OY) / WORLD.SY;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
function ptOf(t) { return Array.isArray(t) ? { x: t[0], y: t[1] } : t; }
// World rp of a tile's ground centre, of a tile's top vertex, and of the centroid of tiles.
function tileRp(tx, ty) { return [WORLD.OX + 24 * (tx - ty), WORLD.OY + 12 * (tx + ty + 1)]; }
function vtxRp(tx, ty) { return [WORLD.OX + 24 * (tx - ty), WORLD.OY + 12 * (tx + ty)]; }
function tilesRp(tiles) {
  let x = 0, y = 0;
  for (let i = 0; i < tiles.length; i++) { const c = tileRp(tiles[i].x, tiles[i].y); x += c[0]; y += c[1]; }
  return [x / tiles.length, y / tiles.length];
}
// The shift that puts sim point (fx, fy) at the ground point (gx, gy) projected, lift units down.
function shiftTo(gx, gy, fx, fy, lift) {
  return { dx: halfPx(isoX(gx, gy) - fx), dy: halfPx(isoY(gx, gy) + lift - fy) };
}
// A mover whose tile top left is (px, py): its feet (px + 8, py + 16) stand 4 rp below its tile centre.
function moverShift(px, py) { return shiftTo(px + 8, py + 8, px + 8, py + 16, 2); }
// A point drawn 32 sim px above someone's feet (numbers, hearts, sparkles).
function ptShift(x, y) { return moverShift(x - 8, y + 16); }
// The shift that puts octx point (fx, fy) on world rp (X, Y). D(name, x, y) puts the art3 anchor on
// octx (x + w / 2, y + h), w by h the v2 size, so rpShift(X, Y, x + w / 2, y + h) puts it on (X, Y).
function rpShift(X, Y, fx, fy) { return { dx: halfPx(X / RS - fx), dy: halfPx(Y / RS - fy) }; }
function withShift(sh, fn) {
  if (!sh) { fn(); return; }
  octx.save();
  octx.translate(sh.dx, sh.dy);
  try { fn(); } finally { octx.restore(); }
}
// D() of v2 sprite `name` at legacy sim px (x, y) (its capture record) with its art3 anchor on rp (X, Y).
function drawRp(name, frame, X, Y, x, y, flip) {
  const sz = size(name);
  withShift(rpShift(X, Y, x + sz[0] / 2, y + sz[1]), function () { D(name, x, y, frame, flip); });
}
function onWorld(fn) {
  const m = octx.getTransform();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  try { fn(); } finally { octx.setTransform(m); }
}
// An art3 sprite with its anchor on world rp (X, Y).
function put3(name, frame, X, Y, flip) {
  if (!A3) return;
  onWorld(function () { A3.drawAt(octx, name, Math.round(X), Math.round(Y), frame | 0, flip === true); });
}
// v3.4 playtest: put3 with the dark ring (stations and plates).
function put3o(name, frame, X, Y, flip) {
  if (!A3) return;
  const f = typeof A3.drawAtOutlined === 'function' ? A3.drawAtOutlined : A3.drawAt;
  onWorld(function () { f(octx, name, Math.round(X), Math.round(Y), frame | 0, flip === true); });
}

// v3.4 playtest: an icon badge over each station (flame cooker, snowflake cooler, knife board, bag pile,
// plate counter), on a dark chip.
const BADGE = Object.freeze({
  flame: ['...o...', '..ooo..', '..oyo..', '.oyyyo.', '.oyyyo.', 'oyywyyo', '.ooooo.'],
  snow: ['...w...', '.w.w.w.', '..www..', 'wwwwwww', '..www..', '.w.w.w.', '...w...'],
  knife: ['......w', '.....ww', '....ww.', '...ww..', '..ww...', '.b.....', 'b......'],
  plate: ['.......', '..www..', '.wgggw.', 'wgwwwgw', '.wgggw.', '..www..', '.......'],
  bag: ['..b.b..', '...b...', '.bbbbb.', 'bbkkkbb', 'bbkkkbb', 'bbbbbbb', '.bbbbb.'],
  coin: ['..ooo..', '.oyyyo.', 'oywyyyo', 'oyyoyyo', 'oyyyoyo', '.oyyyo.', '..ooo..'],   // v3.6: the register
  log: ['.......', '.dddd..', 'dbbbbtt', 'dbbbtlt', 'dbbbbtt', '.dddd..', '.......']   // v4.9: the wood rack, a log end on
});
const BADGE_PAL = Object.freeze({ o: '#f2702a', y: '#ffd35a', w: '#ffffff', b: '#a0622e', g: '#c9d3e0', k: '#4a4a4a', d: '#5e3a1e', t: '#f2c58a', l: '#c98a4b' });
// v3.4 review: the chip is 1.5x the first cut (the icon at 2 rp a pixel on a 16 by 16 chip) and sits
// centred over the sprite's own drawn pixels (its opaque box), 2 rp above its top.
const opaqueBoxes = new Map();
function opaqueBox(name, frame) {
  const key = name + '|' + (frame | 0);
  if (opaqueBoxes.has(key)) return opaqueBoxes.get(key);
  let box = null;
  try {
    const src = typeof A3.frameCanvas === 'function' ? A3.frameCanvas(name, frame | 0, false) : null;
    if (src && src.width > 0) {
      const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
      let x0 = src.width, x1 = -1, y0 = src.height;
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
        if (d[(y * src.width + x) * 4 + 3] < 128) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
      }
      if (x1 >= 0) box = { cx: (x0 + x1 + 1) / 2, top: y0 };
    }
  } catch (e) { box = null; }
  opaqueBoxes.set(key, box);
  return box;
}
// Joel's phone playtest (2026-10-19): a badge drew over the pitmaster when its station stood in front
// of him. Now a badge whose chip would touch a person (the bodies drawn last frame, peopleBoxes) is
// not drawn while they stand there; badgeLog keeps this frame's badges for the harness, each with its
// chip and its station's opaque box (world rp). The kettle has no badge (its fire shows it).
let peopleBoxes = [], peopleNext = [], badgeLog = [];
let regClear = null;   // v3.6: the register's opaque box (world rp) this frame, kept clear of other chips
const custBoxes = new Map();
function keepPerson(id) {
  const p = B3 && typeof B3.lastPerson === 'function' ? B3.lastPerson() : null;
  if (!p) return;
  peopleNext.push(p);
  if (id !== null && id !== undefined) {
    custBoxes.set(id, p);
    // v4.5: a guest's drawn body is a tap target, in draw order with the sprites (front most last).
    hits.push({ guest: id, box: p });
  }
}
function overlaps(a, b) { return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1; }
function drawBadge(kind, name, frame, X, Y, again) {
  const m = BADGE[kind];
  if (!m || !A3) return;
  const an = A3.anchor(name, frame | 0);
  const ob = opaqueBox(name, frame);
  const cx = ob ? Math.round(X) - an.ax + ob.cx : Math.round(X);
  const top = ob ? Math.round(Y) - an.ay + ob.top : Math.round(Y) - an.ay;
  let x0 = Math.round(cx - 8);
  const y0 = top - 18;
  let chip = { x0: x0, x1: x0 + 16, y0: y0, y1: y0 + 17 };
  // v3.6: a chip that would cover the register slides along its station past it (the counter's
  // plate chip sat right over the register), or stays off when there is no room.
  let clash = false;
  if (kind !== 'coin' && regClear && overlaps(chip, regClear)) {
    const sb = boxRp(name, frame, X, Y), nx = regClear.x1 + 1;
    if (nx + 8 <= sb.x1) { x0 = nx; chip = { x0: x0, x1: x0 + 16, y0: y0, y1: y0 + 17 }; } else clash = true;
  }
  const by = clash || peopleBoxes.some(function (p) { return overlaps(chip, p); });
  if (!again) { badgeLog.push({ kind: kind, chip: chip, station: boxRp(name, frame, X, Y), shown: !by }); lateBadges.push({ a: [kind, name, frame, X, Y], chip: chip, by: by }); }
  if (by) return;
  onWorld(function () {
    octx.fillStyle = '#1b1410';
    octx.fillRect(x0 + 1, y0, 14, 16); octx.fillRect(x0, y0 + 1, 16, 14);
    octx.fillStyle = '#3a2a1e';
    octx.fillRect(x0 + 2, y0 + 2, 12, 12);
    octx.fillStyle = '#1b1410';
    octx.fillRect(x0 + 7, y0 + 16, 2, 1);   // a small stem toward its station
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const k = m[r].charAt(c);
      if (k === '.') continue;
      octx.fillStyle = BADGE_PAL[k];
      octx.fillRect(x0 + 1 + 2 * c, y0 + 1 + 2 * r, 2, 2);
    }
  });
}
// v3.4 playtest: a soft ring on the ground under what the player can act on next: the station in
// reach, and any cooker with a piece done (pull it).
function actTargets(s) {
  const out = [];
  if (s.phase !== 'service') return out;
  const r = typeof sim.reach === 'function' ? sim.reach() : null;
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (!owned(st)) continue;
    const ck = st.type === 'cooker' ? s.stations[st.id] : null;
    const done = !!(ck && ck.pieces && ck.pieces.some(function (p) { return p.state === 'done'; }));
    if (st.id === r || done) out.push({ st: st, hot: done });
  }
  return out;
}
function drawActRings(s) {
  const list = actTargets(s);
  if (!list.length) return;
  const a = reduced ? 0.55 : 0.4 + 0.25 * Math.sin(tAnim * 5);
  onWorld(function () {
    for (let i = 0; i < list.length; i++) {
      const ts = list[i].st.tiles;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let j = 0; j < ts.length; j++) { x0 = Math.min(x0, ts[j].x); x1 = Math.max(x1, ts[j].x); y0 = Math.min(y0, ts[j].y); y1 = Math.max(y1, ts[j].y); }
      const P = [vtxRp(x0, y0), vtxRp(x1 + 1, y0), vtxRp(x1 + 1, y1 + 1), vtxRp(x0, y1 + 1)];
      octx.beginPath();
      octx.moveTo(P[0][0], P[0][1] - 9);
      octx.lineTo(P[1][0] + 18, P[1][1]);
      octx.lineTo(P[2][0], P[2][1] + 9);
      octx.lineTo(P[3][0] - 18, P[3][1]);
      octx.closePath();
      const col = list[i].hot ? '255, 120, 60' : '255, 214, 90';
      octx.fillStyle = 'rgba(' + col + ', ' + (a * 0.35).toFixed(3) + ')';
      octx.fill();
      octx.lineWidth = 2;
      octx.strokeStyle = 'rgba(' + col + ', ' + a.toFixed(3) + ')';
      octx.stroke();
    }
  });
}
// Opaque masks of art3 frames, for taps by object and for the anchor maths.
const MASKS = Object.create(null);
function maskOf(name, frame, flip) {
  const k = name + ':' + (frame | 0) + (flip ? 'f' : '');
  let m = MASKS[k];
  if (m) return m;
  const a = A3.anchor(name, frame | 0);
  m = { w: a.w, h: a.h, ax: flip ? a.w - a.ax : a.ax, ay: a.ay, a: new Uint8Array(a.w * a.h), x0: a.w, x1: -1, y0: a.h, y1: -1 };
  try {
    const c = A3.frameCanvas(name, frame | 0, flip === true);
    const d = c.getContext('2d').getImageData(0, 0, a.w, a.h).data;
    for (let i = 0; i < a.w * a.h; i++) {
      const al = d[i * 4 + 3];
      m.a[i] = al;
      if (al >= 128) {
        const x = i % a.w, y = (i / a.w) | 0;
        if (x < m.x0) m.x0 = x; if (x > m.x1) m.x1 = x; if (y < m.y0) m.y0 = y; if (y > m.y1) m.y1 = y;
      }
    }
  } catch (e) { m.a.fill(255); m.x0 = 0; m.x1 = a.w - 1; m.y0 = 0; m.y1 = a.h - 1; }
  MASKS[k] = m;
  return m;
}

// ---------------------------------------------------------------- v3.6: the MAP, read for drawing

// The v2 box a station, prop or decor item records under (capture records stay in sim px): its MAP
// draw spot when the MAP has one, else its first tile's top left.
function drawOf(o) {
  if (o.draw) return o.draw;
  const t = ptOf((o.tiles && o.tiles[0]) || o.tile || (o.blocks && o.blocks[0]) || { x: 0, y: 0 });
  return { x: t.x * TILE, y: t.y * TILE };
}
function tilesOf(o) {
  const b = o.blocks && o.blocks.length ? o.blocks : (o.tiles && o.tiles.length ? o.tiles : (o.tile ? [o.tile] : []));
  return b.map(ptOf);
}
function hasTile(tiles, tx, ty) { for (let i = 0; i < tiles.length; i++) if (tiles[i].x === tx && tiles[i].y === ty) return true; return false; }
function spanOf(tiles) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  tiles.forEach(function (t) { x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y); });
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}
function rectTiles(x0, y0, x1, y1) { const out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x: x, y: y }); return out; }
// The art a station draws: the counter grows to counter_long with the extension.
function stationArt(st, all) {
  let tiles = st.tiles.filter(function (t) { return all || owned(t); }).map(ptOf);
  if (!tiles.length) tiles = st.tiles.map(ptOf);
  let name = st.sprite;
  if (st.type === 'table') name = tiles.length >= 4 ? 'counter_long' : 'counter';
  else if (st.type === 'cooker') name = st.sprite && st.sprite !== 'kettle' && A3 && A3.has(st.sprite) ? st.sprite : (st.sprite === 'drum' || st.id === 'drum' ? 'drum' : 'kettle');
  else if (!name || !A3 || !A3.has(name)) name = st.type;
  const c = tilesRp(tiles);
  // v4.7: a turned 2 tile unit (MAP station turned) draws mirrored left to right: in this projection
  // the flip swaps the ground axes, so the art lies along the turned footprint.
  return { name: name, tiles: tiles, X: c[0], Y: c[1], id: st.id, flip: st.turned === true };
}
// The rp box of an art3 sprite's opaque pixels with its anchor on (X, Y) (flip: mirrored).
function boxRp(name, frame, X, Y, flip) {
  const m = maskOf(name, frame | 0, flip === true);
  return { x0: Math.round(X) - m.ax + m.x0, x1: Math.round(X) - m.ax + m.x1 + 1, y0: Math.round(Y) - m.ay + m.y0, y1: Math.round(Y) - m.ay + m.y1 + 1 };
}
// MAP.walk (the stone path) as tiles; v3.5 MAPs fall back on the customer route.
// v4.4: the worn path the stage draws (dirt and stepping stones): the guests' route from the gate to
// the nearest line spot by the sim's own customer walk rule (4 directions), plus the line spots. Only
// the layout and owned seats change it, so the cached stage rebuilds only then.
let wornKey = null, wornList = [];
function wornTiles() {
  const g0 = MAP.gate, Q = MAP.queue || [];
  if (!g0 || !sim || typeof sim.custWalkable !== 'function') return [];
  const W = MAP.W, H = MAP.H, open = new Uint8Array(W * H);
  let key = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = sim.custWalkable(x, y, -1, -1) === true ? 1 : 0; open[y * W + x] = o; key += o; }
  key += '|' + Q.map(function (q) { return q.x + ',' + q.y; }).join(';');
  if (key === wornKey) return wornList;
  const isQ = function (x, y) { return Q.some(function (q) { return q.x === x && q.y === y; }); };
  const prev = new Int16Array(W * H).fill(-1), start = g0.y * W + g0.x;
  prev[start] = start;
  const q = [start];
  let goal = -1;
  for (let i = 0; i < q.length && goal < 0; i++) {
    const c = q[i], cx = c % W, cy = (c - cx) / W;
    if (isQ(cx, cy)) { goal = c; break; }
    [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(function (d) {
      const nx = cx + d[0], ny = cy + d[1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
      const n = ny * W + nx;
      if (prev[n] !== -1 || !open[n]) return;
      prev[n] = c; q.push(n);
    });
  }
  const out = [];
  if (goal >= 0) for (let c = goal; c !== start; c = prev[c]) out.push({ x: c % W, y: (c / W) | 0 });
  Q.forEach(function (t) { if (!out.some(function (o) { return o.x === t.x && o.y === t.y; })) out.push({ x: t.x, y: t.y }); });
  wornKey = key; wornList = out;
  return out;
}
function walkTiles() {
  if (Array.isArray(MAP.walk)) return MAP.walk.map(ptOf);
  const out = [];
  PATH_TILES.forEach(function (k) { const p = k.split(','); out.push({ x: +p[0], y: +p[1] }); });
  return out;
}
// v3.4 playtest: the "+" marks show (and take taps) only while the Shop or Gear sheet is open.
function saleShown() { return currentPanel === 'sheet' && (sheetKind === 'shop' || sheetKind === 'gear'); }
// MAP.forSale (spec D) as [{ id, tiles }]; without it, unbought gear and decor spots.
let SALE = null;
function forSale() {
  if (SALE) return SALE;
  const fs = MAP.forSale;
  if (fs) {
    SALE = Array.isArray(fs) ? fs.map(function (e) { return { id: e.id, tiles: (e.tiles || []).map(ptOf) }; })
      : Object.keys(fs).map(function (id) { return { id: id, tiles: (fs[id] || []).map(ptOf) }; });
  } else {
    SALE = [];
    MAP.stations.forEach(function (st) {
      if (st.gear) SALE.push({ id: st.gear, tiles: st.tiles.map(ptOf) });
      st.tiles.forEach(function (t) { if (t.gear && !SALE.some(function (e) { return e.id === t.gear; })) SALE.push({ id: t.gear, tiles: [ptOf(t)] }); });
    });
    MAP.decor.forEach(function (d) { SALE.push({ id: d.id, tiles: d.id === 'lights' ? [ptOf(d.tiles[0])] : d.tiles.map(ptOf) }); });
  }
  SALE = SALE.filter(function (e) { return e.tiles.length > 0; });
  return SALE;
}
function idOwned(id) { const s = sim.state; return s.gear[id] === true || s.decor[id] === true; }
function canopyTiles() {
  const c = MAP.overhead && MAP.overhead.canopy;
  if (c && Array.isArray(c.tiles) && c.tiles.length) { const b = spanOf(c.tiles.map(ptOf)); return rectTiles(b.x0, b.y0, b.x1, b.y1); }
  return rectTiles(5, 1, 8, 2);
}
function lightsHooks() {
  const L = MAP.overhead && MAP.overhead.lights;
  const spot = MAP.decor.find(function (q) { return q.id === 'lights'; });
  const post = L && L.post ? ptOf(L.post) : (spot ? ptOf(spot.tiles[0]) : { x: 0, y: 7 });
  const hook = L && L.hook ? ptOf(L.hook) : { x: 8, y: 0 };
  return { post: post, hook: hook };
}
// Picnic tables: every 'picnic' prop and the picnic decor, as { tiles, decor }.
let TABLES = null;
function picnicTables() {
  if (TABLES) return TABLES;
  TABLES = [];
  MAP.props.forEach(function (p) { if (p.sprite === 'picnic') TABLES.push({ tiles: tilesOf(p), decor: null, rec: drawOf(p) }); });
  MAP.decor.forEach(function (d) {
    const dr = d.draws ? d.draws.find(function (q) { return q.sprite === 'picnic'; }) : null;
    if (dr || d.id === 'picnic2') TABLES.push({ tiles: d.tiles.map(ptOf), decor: d.id, rec: dr ? { x: dr.x, y: dr.y } : drawOf(d) });
  });
  return TABLES;
}
// A seat's table and its index on the far bench (by column), or null for chairs.
const SEAT_TB = Object.create(null);
function seatTable(seat) {
  if (seat.id in SEAT_TB) return SEAT_TB[seat.id];
  let out = null;
  picnicTables().forEach(function (tb) {
    if (out || !hasTile(tb.tiles, seat.x, seat.y + 1)) return;
    out = { tb: tb, i: seat.x - spanOf(tb.tiles).x0 };
  });
  SEAT_TB[seat.id] = out;
  return out;
}
// Where a seat's sitter's anchor goes (rule seats('picnic_bench'), seats('chair')), world rp.
function seatRp(seat) {
  const st = seatTable(seat);
  if (st) {
    const c = tilesRp(st.tb.tiles), q = (A3.rule.seats('picnic_bench')[st.i]) || [0, -12];
    return [c[0] + q[0], c[1] + q[1]];
  }
  const c = tileRp(seat.x, seat.y), q = A3.rule.seats('chair')[0] || [0, -7];
  return [c[0] + q[0], c[1] + q[1]];
}
function seatShift(seat) {
  const p = seatRp(seat);
  return rpShift(p[0], p[1], seat.x * TILE + 8, seat.y * TILE + 16);
}
function stationShift(st) {
  const a = stationArt(st), d = drawOf(st), sz = size(st.sprite || 'kettle');
  return rpShift(a.X, a.Y, d.x + sz[0] / 2, d.y + sz[1]);
}

// ---------------------------------------------------------------- v3.6: the camera (spec C)

// mode 'near' (phones: k device px per rp, k = round(1.5 dpr)), 'far' (phones: the whole world, any
// scale) or 'fit' (desktop: the largest whole k that shows the whole world). x0, y0 is the view's top
// left in world rp, vw by vh its size in rp, z the device px per rp.
const cam = { mode: 'fit', phone: false, x0: 0, y0: 0, vw: WORLD.W, vh: WORLD.H, z: 1, nearK: 1, kOv: 1, follow: true, ease: null, homed: false, moved: false };
const CAM_EASE_S = 0.25;
// The far view on a phone fits the fenced yard (both front fence corners and a margin) to the stage
// width; the stage then shrinks to the world's height at that scale, so no empty bands sit above or
// below it. The barn's far end runs past the right edge, as in the mock.
function farBox() {
  const L = vtxRp(0, MAP.H), R = vtxRp(MAP.W, 0);
  return { x0: Math.max(0, L[0] - 16), x1: Math.min(WORLD.W, R[0] + 16) };
}
function farZ(cw, ch) {
  const f = farBox(), z = Math.min(cw / (f.x1 - f.x0), ch / WORLD.H);
  return !cam.phone && z >= 1 ? Math.floor(z + 1e-6) : z;   // v3.4: whole device px per rp on desktop
}
function camClamp() {
  if (cam.mode === 'far') {
    const f = farBox();
    cam.x0 = f.x0 - (cam.vw - (f.x1 - f.x0)) / 2;
    cam.y0 = (WORLD.H - cam.vh) / 2;
    return;
  }
  cam.x0 = cam.vw <= WORLD.W ? Math.max(0, Math.min(WORLD.W - cam.vw, cam.x0)) : (WORLD.W - cam.vw) / 2;
  cam.y0 = cam.vh <= WORLD.H ? Math.max(0, Math.min(WORLD.H - cam.vh, cam.y0)) : (cam.mode === 'far' ? (WORLD.H - cam.vh) / 2 : WORLD.H - cam.vh);
}
function camView() {
  const cw = el.cv.width, ch = el.cv.height;
  cam.z = cam.mode === 'far' ? farZ(cw, ch) : cam.nearK;
  cam.vw = cw / cam.z; cam.vh = ch / cam.z;
}
// The view's top left as drawn: whole rp in near and fit, so every art pixel is k device pixels.
function camOrigin() {
  if (cam.mode === 'far') return [cam.x0, cam.y0];
  return [Math.round(cam.x0), Math.round(cam.y0)];
}
function camCenter(X, Y) { cam.x0 = X - cam.vw / 2; cam.y0 = Y - cam.vh / 2; camClamp(); }
// MAP.home: the ids the home view frames (every station plus queue[0] and queue[1]).
function homeBox() {
  const H = MAP.home;
  let ids = MAP.stations.map(function (st) { return st.id; }).concat(['queue0', 'queue1']);
  if (Array.isArray(H)) ids = H;
  else if (H && typeof H === 'object') ids = (H.stations || []).concat((H.queue || []).map(function (i) { return 'queue' + i; }));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const grow = function (b) { x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); };
  ids.forEach(function (id) {
    const q = /^queue\[?(\d+)\]?$/.exec(String(id));
    if (q) {
      const t = MAP.queue[+q[1]];
      if (t) { const c = tileRp(t.x, t.y); grow({ x0: c[0] - 12, x1: c[0] + 12, y0: c[1] - 47, y1: c[1] + 4 }); }
      return;
    }
    const st = MAP.station(id);
    if (!st) return;
    const a = stationArt(st, true);
    grow(boxRp(a.name, 0, a.X, a.Y, a.flip));
  });
  if (!(x1 > x0)) return null;
  return { x0: x0, x1: x1, y0: y0, y1: y1 };
}
// Joel 2026-10-20: the desktop near view frames the kitchen, the counter, the owned seats and the
// pit sign on the barn (its top not cut), with no wide lawn band under the seats.
// Joel 2026-10-23 (week 6 screenshot: the sign cut at the right, the line and the seats off the
// side): the box is what the player works and watches, named part by part (world rp): every OWNED
// station (the counter and the register among them), every spot of the line, every owned seat with
// its guest, and the whole wall sign. Unowned stations (a kettle 2 spot) no longer pull it.
function deskParts() {
  const out = [];
  if (!sim) return out;
  const s = sim.state;
  MAP.stations.forEach(function (st) {
    if (!owned(st)) return;
    const a = stationArt(st);
    out.push({ id: st.id, kind: 'station', b: boxRp(a.name, 0, a.X, a.Y, a.flip) });
  });
  (MAP.queue || []).forEach(function (t, i) {
    const c = tileRp(t.x, t.y);
    out.push({ id: 'queue' + i, kind: 'line', b: { x0: c[0] - 12, x1: c[0] + 12, y0: c[1] - 47, y1: c[1] + 4 } });
  });
  (MAP.seats || []).forEach(function (se) {
    if (!PitSim.tileOwned(se, s.gear, s.decor)) return;
    const c = tileRp(se.x, se.y);
    out.push({ id: se.id, kind: 'seat', b: { x0: c[0] - 26, x1: c[0] + 26, y0: c[1] - 42, y1: c[1] + 12 } });
  });
  const sg = signRp();
  if (sg) out.push({ id: 'sign', kind: 'sign', b: boxRp('sign', 0, sg[0], sg[1]) });
  return out;
}
// Where the bridge stage puts the wall sign's anchor (art3/bridge.js stage: wallAt, 4 up).
function signRp() {
  const sign = MAP.props.find(function (p) { return p.id === 'sign'; });
  if (!sign || !A3 || !A3.has('sign')) return null;
  const ts = tilesOf(sign).concat(sign.tiles ? sign.tiles.map(ptOf) : []), b = spanOf(ts);
  const u = 12 * (b.x0 + (b.x1 > b.x0 ? b.x1 : b.x0 + 1) + 1) + 8;
  return [WORLD.OX + u, WORLD.OY + u / 2 - 4];
}
function deskFrame() {
  const parts = deskParts();
  if (!parts.length) return homeBox();
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  parts.forEach(function (p) { b.x0 = Math.min(b.x0, p.b.x0); b.x1 = Math.max(b.x1, p.b.x1); b.y0 = Math.min(b.y0, p.b.y0); b.y1 = Math.max(b.y1, p.b.y1); });
  return b;
}
const DESK_PAD = 12;   // rp kept round the desktop action box where the zoom allows
const DESK_PAD_MIN = 4;
// The kitchen block: every owned station's drawn box (world rp), the counter included.
function kitchenBox() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  MAP.stations.forEach(function (st) {
    if (!owned(st)) return;
    const a = stationArt(st), b = boxRp(a.name, 0, a.X, a.Y, a.flip);
    x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1);
  });
  return x1 > x0 ? { x0: x0, x1: x1, y0: y0, y1: y1 } : null;
}
function camHome() {
  const b = homeBox();
  cam.ease = null;
  cam.follow = true;
  cam.homed = true;
  cam.moved = false;
  const f = cam.phone || cam.mode !== 'near' ? null : deskFrame();
  cam.deskFit = !!f && f.x1 - f.x0 <= cam.vw + 1e-6 && f.y1 - f.y0 <= cam.vh + 1e-6;
  if (f) {
    // Joel 2026-10-23: the desktop view is centred on the action box, not on the pitmaster or the
    // yard; when the box fits, it stays put through service (camFollow leaves it).
    camCenter((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2);
    if (!cam.deskFit) camKeepWork();
    return;
  }
  if (cam.mode === 'near' && b) {
    camCenter((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    // Feedback audit item 19: on a narrow phone (375 CSS px: 250 rp for a 240 rp home box) centring,
    // then keeping 12 rp right of the line, cut the drum and the charcoal pile at the left edge. When
    // the box has under 16 rp to spare, the kitchen side (left) gets the margin, up to 12 rp, and the
    // line only has to fit.
    const slack = cam.vw - (b.x1 - b.x0);
    if (slack < 16) { cam.x0 = b.x0 - Math.max(0, Math.min(12, slack)); camClamp(); }
    camKeepWork();
  }
  else camClamp();
}
function camSet(mode, X, Y) {
  if (mode !== 'far') mode = 'near';   // v3.4: desktop has the near view and the zoom button too
  const cx = X !== undefined ? X : cam.x0 + cam.vw / 2, cy = Y !== undefined ? Y : cam.y0 + cam.vh / 2;
  const was = cam.mode;
  cam.mode = mode;
  cam.ease = null;
  if (cam.phone && was !== mode && el.cv && ov) resize();   // the far stage is only as tall as the world
  camView();
  if (mode === 'near') camCenter(cx, cy); else camClamp();
  syncZoom();
}
// Puts tile (tx, ty)'s centre at least 24 CSS px inside the view, at once; follow waits for a walk.
function camReveal(tx, ty) {
  if (cam.mode !== 'near') return;
  // A follow ease under way lands first: dropping it part way left the view a fraction of a tile
  // short, the next frame eased again, and the point just worked out slid under the tap.
  if (cam.ease) { cam.x0 = cam.ease.tx; cam.y0 = cam.ease.ty; camClamp(); }
  const c = tileRp(tx, ty), m = 24 / cssPerRp();
  const o = camOrigin();
  let x0 = o[0], y0 = o[1];
  if (c[0] < x0 + m) x0 = c[0] - m; else if (c[0] > x0 + cam.vw - m) x0 = c[0] - cam.vw + m;
  if (c[1] < y0 + m) y0 = c[1] - m; else if (c[1] > y0 + cam.vh - m) y0 = c[1] - cam.vh + m;
  if (x0 !== o[0] || y0 !== o[1]) {
    cam.x0 = x0; cam.y0 = y0; camClamp();
    // Keep the counter and the head of the line in view too, the revealed tile first.
    camKeepWork();
    cam.x0 = Math.max(c[0] + m - cam.vw, Math.min(c[0] - m, cam.x0));
    cam.y0 = Math.max(c[1] + m - cam.vh, Math.min(c[1] - m, cam.y0));
    camClamp();
    cam.follow = false; cam.moved = true; cam.deskFit = false;
  }
  cam.ease = null;
}
function camPan(dxCss, dyCss) {
  if (cam.mode === 'fit') return;
  const k = cssPerRp();
  cam.x0 -= dxCss / k; cam.y0 -= dyCss / k;
  camClamp();
  cam.ease = null;
  cam.follow = false;
  cam.moved = true;
  cam.deskFit = false;   // a view the player dragged off the action box follows again, until the next reframe
}
function cssPerRp() {
  const r = el.cv.getBoundingClientRect();
  return r.width > 0 ? r.width / cam.vw : cam.z / dpr();
}
// Auto follow: the pitmaster stays in the middle half of the width and 60 percent of the height;
// out of it the camera eases back over 250 ms (jumps under reduced motion).
function camFollow(dt) {
  if (cam.mode !== 'near' || !sim) return;
  if (cam.ease) {
    const e = cam.ease;
    e.t += dt;
    const k = Math.min(1, e.t / CAM_EASE_S), q = 1 - (1 - k) * (1 - k);
    cam.x0 = e.fx + (e.tx - e.fx) * q; cam.y0 = e.fy + (e.ty - e.fy) * q;
    if (k >= 1) cam.ease = null;
  }
  // Joel 2026-10-23: the desktop view holds the whole action box, so it does not chase the pitmaster.
  if (!cam.phone && cam.deskFit) return;
  const s = sim.state;
  if (!cam.follow || s.phase !== 'service' || cam.ease) return;
  const p = s.player, X = isoX(p.px + 8, p.py + 8) * RS, Y = isoY(p.px + 8, p.py + 8) * RS - 24;
  const fx = cam.x0, fy = cam.y0;
  const inMid = X >= cam.x0 + cam.vw * 0.25 && X <= cam.x0 + cam.vw * 0.75 && Y >= cam.y0 + cam.vh * 0.2 && Y <= cam.y0 + cam.vh * 0.8;
  if (!inMid) camCenter(X, Y);
  // The counter and the head of the line stay in frame while it follows (MAP.home's queue ids).
  camKeepWork();
  // The pitmaster always stays in view: when the work area and the pitmaster cannot both fit, the
  // pitmaster wins.
  cam.x0 = Math.max(X + 20 - cam.vw, Math.min(X - 20, cam.x0));
  cam.y0 = Math.max(Y + 30 - cam.vh, Math.min(Y - 40, cam.y0));
  // v4.1: at a long cooker (the stick burner, the trailer rig) the view takes in the whole cooker.
  const rid = typeof sim.reach === 'function' && !p.walking && p.path.length === 0 ? sim.reach() : null;
  const rst = rid ? MAP.station(rid) : null;
  if (rst && rst.type === 'cooker' && (rst.tier | 0) > 0 && rst.tiles.length > 1) {
    const a = stationArt(rst), bx = boxRp(a.name, 0, a.X, a.Y, a.flip);
    if (bx.x0 - 6 < cam.x0) cam.x0 = Math.max(X + 20 - cam.vw, bx.x0 - 6);
    if (bx.x1 + 6 > cam.x0 + cam.vw) cam.x0 = Math.min(X - 20, bx.x1 + 6 - cam.vw);
    if (bx.y0 - 6 < cam.y0) cam.y0 = Math.max(Y + 30 - cam.vh, bx.y0 - 6);
  }
  camClamp();
  const tx = cam.x0, ty = cam.y0;
  if (reduced) return;
  cam.x0 = fx; cam.y0 = fy;
  if (Math.abs(tx - fx) < 0.5 && Math.abs(ty - fy) < 0.5) return;
  cam.ease = { fx: fx, fy: fy, tx: tx, ty: ty, t: 0 };
}
// The work area the near view keeps in frame while it follows: the counter, the head of the line
// (MAP.home's queue ids) and the pit sign over them, with a 12 rp margin where the view has room.
function workBox() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const grow = function (b) { x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); };
  MAP.stations.forEach(function (st) {
    if (st.type !== 'table') return;
    const a = stationArt(st);
    grow(boxRp(a.name, 0, a.X, a.Y, a.flip));
  });
  const H = MAP.home, qs = H && Array.isArray(H.queue) ? H.queue : [0];
  qs.forEach(function (i) { const t = MAP.queue[i]; if (t) { const c = tileRp(t.x, t.y); grow({ x0: c[0] - 12, x1: c[0] + 12, y0: c[1] - 47, y1: c[1] + 4 }); } });
  // v3.4 review: the pit sign no longer pulls the view up to the barn; the kitchen stays centred.
  return x1 > x0 ? { x0: x0, x1: x1, y0: y0, y1: y1 } : null;
}
function camKeepWork() {
  if (cam.mode !== 'near') return;
  const b = workBox();
  if (!b) return;
  // Feedback audit item 19: when the home box has under 16 rp to spare across, the line keeps no
  // margin across (it only has to fit), so the kitchen side keeps the room camHome gave it.
  const hb = homeBox(), xMax = hb && cam.vw - (hb.x1 - hb.x0) < 16 ? 0 : 12;
  const fit = function (v, lo0, hi0, span, mMax) {
    const m = Math.max(0, Math.min(mMax, (span - (hi0 - lo0)) / 2));
    const lo = hi0 + m - span, hi = lo0 - m;
    return lo <= hi ? Math.max(lo, Math.min(hi, v)) : (lo + hi) / 2;
  };
  cam.x0 = fit(cam.x0, b.x0, b.x1, cam.vw, xMax);
  cam.y0 = fit(cam.y0, b.y0, b.y1, cam.vh, 12);
  // Joel's phone playtest (2026-10-19): on a phone the near view holds the kitchen block centred top
  // to bottom (resize keeps the canvas short enough that the world never clamps it), so the lawn in
  // front no longer fills the bottom half.
  const kb = cam.phone ? kitchenBox() : null;
  if (kb && kb.y1 - kb.y0 + 24 <= cam.vh) cam.y0 = (kb.y0 + kb.y1) / 2 - cam.vh / 2;
  camClamp();
}
// The corner button: four brackets out (to far) or in (back to near). Phones only.
const ZOOM_OUT = [[2, 2, 5, 1], [2, 2, 1, 5], [13, 2, 5, 1], [17, 2, 1, 5], [2, 17, 5, 1], [2, 13, 1, 5], [13, 17, 5, 1], [17, 13, 1, 5]];
const ZOOM_IN = [[2, 6, 5, 1], [6, 2, 1, 5], [13, 6, 5, 1], [13, 2, 1, 5], [2, 13, 5, 1], [6, 13, 1, 5], [13, 13, 5, 1], [13, 13, 1, 5]];
function syncZoom() {
  if (!zoomBtn) return;
  zoomBtn.hidden = false;
  const far = cam.mode === 'far';
  if (zoomBtn.dataset.far === String(far)) return;
  zoomBtn.dataset.far = String(far);
  zoomBtn.setAttribute('aria-label', far ? 'Zoom in' : 'Zoom out');
  zoomBtn.setAttribute('aria-pressed', far ? 'true' : 'false');
  const c = zoomBtn.firstChild, g = c.getContext('2d');
  g.clearRect(0, 0, 20, 20);
  g.fillStyle = COLOR.C;
  (far ? ZOOM_IN : ZOOM_OUT).forEach(function (r) { g.fillRect(r[0], r[1], r[2], r[3]); });
}
function makeZoom() {
  zoomBtn = document.createElement('button');
  zoomBtn.id = 'zoom';
  zoomBtn.type = 'button';
  const c = document.createElement('canvas');
  c.width = 20; c.height = 20;
  c.setAttribute('aria-hidden', 'true');
  zoomBtn.appendChild(c);
  zoomBtn.addEventListener('click', function () { camSet(cam.mode === 'far' ? 'near' : 'far'); });
  el.wrap.appendChild(zoomBtn);
  syncZoom();
}

// ---------------------------------------------------------------- v3.6: taps by object (spec F)

// What the last render drew that a tap can hit, in draw order: { name, frame, flip, X0, Y0, w, h,
// clip, st | at } in world rp. Stations act on themselves; seats, tables and decor walk to the tile
// under the tap when it is standable, else to the standable tile nearest them.
const hits = [];
function hitPush(name, frame, X, Y, flip, clip, what) {
  const m = maskOf(name, frame, flip);
  hits.push({ name: name, frame: frame | 0, flip: !!flip, X0: Math.round(X) - m.ax, Y0: Math.round(Y) - m.ay, w: m.w, h: m.h, clip: clip || null, st: what.st || null, at: what.at || null, seat: what.seat || null });
}
// v4.5: a guest's body box, with 3 rp of slack each side and above (a thumb is wider than a pixel).
const BODY_SLACK = 3;
function hitOne(h, X, Y) {
  if (h.box) return X >= h.box.x0 - BODY_SLACK && X < h.box.x1 + BODY_SLACK && Y >= h.box.y0 - BODY_SLACK && Y < h.box.y1 + 1;
  if (X < h.X0 || Y < h.Y0 || X >= h.X0 + h.w || Y >= h.Y0 + h.h) return false;
  if (h.clip && (X < h.clip[0] || X >= h.clip[1])) return false;
  const m = maskOf(h.name, h.frame, h.flip);
  return m.a[((Y - h.Y0) | 0) * m.w + ((X - h.X0) | 0)] >= 128;
}
// A tap at world rp (X, Y): the tutorial arrow, the order chips, people and sprites front to back,
// "+" marks by their tiles, then the ground. Returns { st }, { guest: id }, { tile } or { plus: id }.
// v4.5 (Joel 2026-10-20, "the touch sensor is confused as to where I am tapping"): a guest's body,
// head or chip, or their seat or table, is the guest (sim.walkToGuest), front most first.
function hitWorld(X, Y) {
  const ab = arrowBox();
  if (ab && X >= ab.X - 8 && X < ab.X + 8 && Y >= ab.Y - 20 && Y < ab.Y + 2) return { st: ab.st };
  const g = unIso(X / RS, Y / RS), tx = Math.floor(g.x / TILE), ty = Math.floor(g.y / TILE);
  const inMap = tx >= 0 && tx < MAP.W && ty >= 0 && ty < MAP.H;
  const standable = inMap && sim.standable(tx, ty);
  // v3.7: holding a plate, a tap on the seat, table or head of the guest who ordered it delivers it.
  const dg = inMap ? deliverTile(tx, ty) : null;
  if (dg !== null) return { guest: dg };
  // The order chips draw over everything: a chip is its guest.
  for (let i = orderBubbles.length - 1; i >= 0; i--) {
    const b = orderBubbles[i], r = b.rect;
    if (X >= r.x0 - 1 && X < r.x1 + 1 && Y >= r.y0 - 1 && Y < r.y1 + ORDER_BUB.tail + 1 && guestLive(b.id)) return { guest: b.id };
  }
  // v4.5: the front most thing under the point, when it is a guest, wins over the register floor.
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (!hitOne(h, X, Y)) continue;
    if (h.guest !== undefined && guestLive(h.guest)) return { guest: h.guest };
    if (h.guest === undefined) break;
  }
  // v3.9: the counter sprite covers most of the register's floor, so a tap on that floor rings up.
  if (inMap) {
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (st.type === 'register' && owned(st) && hasTile(st.tiles, tx, ty)) return { st: st };
    }
  }
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (!hitOne(h, X, Y)) continue;
    if (h.guest !== undefined) { if (guestLive(h.guest)) return { guest: h.guest }; continue; }
    if (h.st) return { st: h.st };
    // A seat, bench, chair or table: the guest sitting there (the seat nearest the tap).
    const sg = seatGuestNear(h, g.x, g.y);
    if (sg !== null) return { guest: sg };
    if (standable) return { tile: { x: tx, y: ty } };
    const dvh = deliverNear(tx, ty);
    if (dvh) return { tile: dvh };
    return { tile: nearestWalkable(h.at[0], h.at[1]) };
  }
  const sale = saleShown() ? forSale() : [];
  for (let i = 0; i < sale.length; i++) if (!idOwned(sale[i].id) && hasTile(sale[i].tiles, tx, ty)) return { plus: sale[i].id };
  if (inMap) {
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (owned(st) && st.tiles.some(function (t) { return t.x === tx && t.y === ty && owned(t); })) return { st: st };
    }
  }
  if (inMap) {
    const og = seatGuestAt(tx, ty);
    if (og !== null) return { guest: og };
  }
  if (standable) return { tile: { x: tx, y: ty } };
  const dv = deliverNear(tx, ty);
  if (dv) return { tile: dv };
  return { tile: nearestWalkable(g.x, g.y) };
}
// A guest still in the yard (not a passer by on the street).
function guestLive(id) {
  const cs = sim.state.customers;
  for (let i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i].mode !== 'passing';
  return false;
}
// The guest who holds seat `se` now (walking to it, sitting, eating), or null.
function seatHolder(se) {
  const v = sim.state.seats ? sim.state.seats[se.id] : null;
  if (v === null || v === undefined) return null;
  const c = sim.state.customers.find(function (o) { return o.id === v; });   // a host seat held for a guest still at the counter is not theirs yet
  return c && c.seat === se.id && c.mode !== 'passing' ? v : null;
}
// The guest on the seat at tile (tx, ty), or on the seat right behind the table tile (tx, ty).
function seatGuestAt(tx, ty) {
  const all = seatsNow();
  for (let i = 0; i < all.length; i++) {
    const se = all[i];
    if (se.x !== tx || (se.y !== ty && se.y !== ty - 1)) continue;
    if (se.y === ty - 1 && !(se.host || seatTable(se))) continue;   // a lawn chair has no table in front
    const id = seatHolder(se);
    if (id !== null) return id;
  }
  return null;
}
// A tap on furniture sprite h at sim point (x, y): the taken seat of that piece nearest the tap.
function seatGuestNear(h, x, y) {
  const all = seatsNow();
  let best = null, bd = Infinity;
  for (let i = 0; i < all.length; i++) {
    const se = all[i];
    if (h.seat ? se.id !== h.seat : !h.at || Math.abs(se.x * TILE + 8 - h.at[0]) > 24 || Math.abs(se.y * TILE + 8 - h.at[1]) > 24) continue;
    const id = seatHolder(se);
    if (id === null) continue;
    const d = Math.pow(se.x * TILE + 8 - x, 2) + Math.pow(se.y * TILE + 8 - y, 2);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}
// Joel 2026-10-20 ("I can't leave the pit area to deliver food"): with a plate in hand, a tap off the
// patio (the guest's body or head, the picnic table, a bench, the lawn) meant the patio tile nearest
// it, so the pitmaster walked to the patio edge and stopped. Only the exact ground diamond of the
// seat, the table in front of it or the tile behind it delivered. Now any tap that is not on the
// patio or a station carries the plate to the waiting guest of that meat whose seat is nearest the
// tap. Returns that guest's seat tile (sim.walkTo on it delivers), or null.
function deliverNear(tx, ty) {
  const s = sim.state, h = s.player && s.player.carrying;
  if (!h || h.kind !== 'plates' || !Array.isArray(s.customers)) return null;
  let best = null, bd = Infinity, bp = Infinity;
  for (let i = 0; i < s.customers.length; i++) {
    const c = s.customers[i];
    const st = waitsPlate(c) && !c.togo && c.want === h.meat ? seatOf(c) : null;
    if (!st) continue;
    const d = Math.pow(st.x - tx, 2) + Math.pow(st.y - ty, 2), pa = Number(c.paidAt) || 0;
    if (d < bd || (d === bd && pa < bp)) { bd = d; bp = pa; best = { x: st.x, y: st.y }; }
  }
  return best;
}
function deliverTile(tx, ty) {
  const s = sim.state, h = s.player && s.player.carrying;
  if (!h || h.kind !== 'plates' || !Array.isArray(s.customers)) return null;
  let best = null, bp = Infinity;
  for (let i = 0; i < s.customers.length; i++) {
    const c = s.customers[i];
    const st = waitsPlate(c) && !c.togo && c.want === h.meat ? seatOf(c) : null;
    if (!st || st.x !== tx || Math.abs(st.y - ty) > 1) continue;
    const pa = Number(c.paidAt) || 0;
    if (pa < bp) { bp = pa; best = c.id; }
  }
  return best;
}
function clientToWorld(cx, cy) {
  const r = el.cv.getBoundingClientRect(), k = r.width > 0 ? r.width / cam.vw : 1, o = camOrigin();
  return { X: o[0] + (cx - r.left) / k, Y: o[1] + (cy - r.top) / k, r: r, k: k, o: o };
}
// The client point of tile (tx, ty): its centre, or the nearest point that a tap there acts on the
// tile (a station's own sprite, a walkable tile's diamond). Pans first unless opts.pan is false;
// null when the point is off the canvas and pan is false.
// The client point where the last frame drew the pitmaster's feet (harness: key directions on screen).
let playerDrawn = null;
function playerClient() {
  if (!playerDrawn) return null;
  const w = clientToWorld(0, 0);
  return { x: w.r.left + (playerDrawn[0] - w.o[0]) * w.k, y: w.r.top + (playerDrawn[1] - w.o[1]) * w.k, X: playerDrawn[0], Y: playerDrawn[1] };
}
function tileToClient(tx, ty, opts) {
  if (!(opts && opts.pan === false)) camReveal(tx, ty);
  const w = clientToWorld(0, 0);
  const c = tileRp(tx, ty);
  let X = c[0], Y = c[1];
  const st = MAP.stations.find(function (q) { return owned(q) && q.tiles.some(function (t) { return t.x === tx && t.y === ty && owned(t); }); });
  const inMap = tx >= 0 && tx < MAP.W && ty >= 0 && ty < MAP.H;
  const want0 = st ? function (h) { return h.st === st; } : function (h) { return !!(h.tile && h.tile.x === tx && h.tile.y === ty); };
  // A point a tap acts on, with 2 rp of the same answer around it, so a pixel of camera or finger
  // drift does not land on the neighbour (the register's nearest pixel sat on the counter's edge).
  // Falls back to any point that acts on it when nothing has that margin.
  let wantM = true;
  const want = function (h, x, y) {
    if (!want0(h)) return false;
    if (!wantM || x === undefined) return true;
    return want0(hitWorld(x - 2, y)) && want0(hitWorld(x + 2, y)) && want0(hitWorld(x, y - 2)) && want0(hitWorld(x, y + 2));
  };
  if ((st || (inMap && sim.standable(tx, ty))) && !want(hitWorld(X + 0.5, Y + 0.5), X + 0.5, Y + 0.5)) for (let pass = 0; pass < 2; pass++) {
    wantM = pass === 0;
    let best = null, bd = Infinity;
    const vis = function (x, y) { return x >= w.o[0] + 2 && x < w.o[0] + cam.vw - 2 && y >= w.o[1] + 2 && y < w.o[1] + cam.vh - 2; };
    if (st) {
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (h.st !== st) continue;
        for (let yy = h.Y0; yy < h.Y0 + h.h; yy++) for (let xx = h.X0; xx < h.X0 + h.w; xx++) {
          const d = (xx - X) * (xx - X) + (yy - Y) * (yy - Y);
          if (d < bd && vis(xx, yy) && hitOne(h, xx + 0.5, yy + 0.5) && want(hitWorld(xx + 0.5, yy + 0.5), xx + 0.5, yy + 0.5)) { bd = d; best = [xx, yy]; }
        }
      }
    } else {
      for (let yy = -11; yy <= 11; yy++) for (let xx = -23; xx <= 23; xx++) {
        if (Math.abs(xx) / 24 + Math.abs(yy) / 12 >= 0.92) continue;
        const d = xx * xx + yy * yy;
        if (d < bd && vis(X + xx, Y + yy) && want(hitWorld(X + xx + 0.5, Y + yy + 0.5), X + xx + 0.5, Y + yy + 0.5)) { bd = d; best = [X + xx, Y + yy]; }
      }
    }
    if (best) { X = best[0]; Y = best[1]; break; }
  }
  const px = w.r.left + (X + 0.5 - w.o[0]) * w.k, py = w.r.top + (Y + 0.5 - w.o[1]) * w.k;
  if (opts && opts.pan === false && (px < w.r.left || px >= w.r.right || py < w.r.top || py >= w.r.bottom)) return null;
  return { x: px, y: py };
}

// The sim tile nearest the sim point (x, y) that the player can stand on.
function nearestWalkable(x, y) {
  let best = null, bd = Infinity;
  for (let ty = 0; ty < MAP.H; ty++) {
    for (let tx = 0; tx < MAP.W; tx++) {
      if (!sim.standable(tx, ty)) continue;
      const d = Math.pow(tx * TILE + 8 - x, 2) + Math.pow(ty * TILE + 8 - y, 2);
      if (d < bd) { bd = d; best = { x: tx, y: ty }; }
    }
  }
  return best;
}

// ---------------------------------------------------------------- drawing primitives

function size(name) {
  let s = SIZE[name];
  if (!s && /^till_/.test(name)) return (SIZE[name] = size('buddy_' + name.slice(5)));   // v3.6: art3 only, the buddy's box
  if (!s && /^pit_/.test(name)) return (SIZE[name] = size('buddy_' + name.slice(4)));    // v4.3: the PIT card too
  if (!s) {
    const sp = art.SPRITES ? art.SPRITES[name] : null;
    s = SIZE[name] = sp ? [sp.w, sp.h, Math.max(1, art.frames(name))] : [16, 16, Math.max(1, art.frames(name))];
  }
  return s;
}

// Wholly outside: never drawn. Crossing an edge: drawn only for the D15 step 33 exceptions.
function inView(name, x, y, w, h) {
  if (x >= VW || y >= VH || x + w <= 0 || y + h <= 0) return false;
  if (x >= 0 && y >= 0 && x + w <= VW && y + h <= VH) return true;
  return OVERFLOW_OK.test(name);
}

function normFrame(frame, n) {
  const f = Math.trunc(Number(frame) || 0);
  return ((f % n) + n) % n;
}

// v3.4 playtest: a guest's food bubble draws wherever the iso yard puts it (a guest at the counter
// sits near the legacy top edge, so its bubble never showed); its capture record stays legacy bounded.
const CUE_ANY = /^(bubble|icon_|plate_|mark_x)/;
function D(name, x, y, frame, flip) {
  const sz = size(name);
  const vis = inView(name, x, y, sz[0], sz[1]);
  if (!vis && !(B3 && CUE_ANY.test(name))) return;
  const f = normFrame(frame, sz[2]);
  if (!(B3 && B3.draw(octx, name, x, y, sz[0], sz[1], f, flip === true))) { if (vis) art.draw(octx, name, x, y, f, flip === true); }
  if (capturing && vis) recs.push({ name: name, frame: f, x: x, y: y, w: sz[0], h: sz[1] });
}

// The capture record D() would make, with no draw.
function recOnly(name, x, y, frame) {
  if (!capturing) return;
  const sz = size(name);
  if (!inView(name, x, y, sz[0], sz[1])) return;
  recs.push({ name: name, frame: normFrame(frame, sz[2]), x: x, y: y, w: sz[0], h: sz[1] });
}

function DS(name, x, y, w, h, frame, flip) {
  if (!inView(name, x, y, w, h)) return;
  const f = normFrame(frame, size(name)[2]);
  if (!(B3 && B3.draw(octx, name, x, y, w, h, f, flip === true))) art.drawScaled(octx, name, x, y, w, h, f, flip === true);
  if (capturing) recs.push({ name: name, frame: f, x: x, y: y, w: w, h: h });
}

function glyphFrame(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 65 && c <= 90) return 10 + (c - 65);
  if (ch === '+') return 36;
  if (ch === ':') return 37;
  if ((ch === '.' || ch === ',') && size('font')[2] >= 40) return ch === '.' ? 38 : 39;
  if ((ch === "'" || ch === '-') && size('font')[2] >= 42) return ch === "'" ? 40 : 41;   // W16.2
  return -1;
}

// captureFrame records for text drawn by sprites.js itself (textFit): font advances 5, font_s 4.
function recordGlyphs(fontName, str, x, y) {
  if (!capturing) return;
  const fs = size(fontName);
  const s = String(str).toUpperCase();
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') { cx += fs[0] + 1; continue; }
    const g = glyphFrame(ch);
    if (g < 0) continue;
    recs.push({ name: fontName, frame: g, x: cx, y: y, w: fs[0], h: fs[1] });
    cx += fs[0] + 1;
  }
}

// W16.5: the pit name on the yard sign as textFit draws it (upper case, font or font_s, centered).
function signInfo() {
  const st = MAP.signText;
  if (!st || !sim) return null;
  const text = pitName(sim.state).toUpperCase();
  const wf = art.textWidth(text);
  if (wf <= (st.w | 0)) return { text: text, font: 'font', x: st.x + Math.floor((st.w - wf) / 2), width: wf };
  let ws = 0;
  if (typeof art.textWidthS === 'function') ws = art.textWidthS(text);
  else { let n = 0; for (let i = 0; i < text.length; i++) if (text[i] === ' ' || glyphFrame(text[i]) >= 0) n++; ws = n ? n * 4 - 1 : 0; }
  return { text: text, font: 'font_s', x: st.x + Math.floor((st.w - ws) / 2), width: ws };
}

function drawSign(s) {
  const st = MAP.signText;
  const info = signInfo();
  if (!info) return;
  if (B3 && B3.signText(octx, pitName(s))) {
    recordGlyphs(info.font, info.text, info.x, info.font === 'font_s' ? st.y + 1 : st.y);
  } else if (typeof art.textFit === 'function') {
    art.textFit(octx, pitName(s), st.x, st.y, st.w);
    recordGlyphs(info.font, info.text, info.x, info.font === 'font_s' ? st.y + 1 : st.y);
  } else {
    // sprites.js before v3.0: the name only when it fits the font, else the v2 words.
    const t = info.font === 'font' ? info.text : 'YOUR PIT';
    T(t, st.x + Math.max(0, Math.floor((st.w - art.textWidth(t)) / 2)), st.y);
  }
}

// W7.4: what the rail shows now (the getter and pass 8 share it); null when no rail is drawn.
function railNow() {
  if (!sim) return null;
  const s = sim.state;
  if (s.phase !== 'service' || !s.today) return null;
  const kind = s.today.kind;
  if (kind !== 'booking' && kind !== 'yard') return null;
  const rail = s.today.rail || {}, sold = s.today.sold || {};
  const items = [];
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const m = MEAT_IDS[i];
    const want = rail[m] | 0, so = sold[m] | 0;
    if (kind === 'booking' ? want > 0 : so > 0) items.push({ meat: m, want: want, sold: so, left: Math.max(0, want - so) });
  }
  return { kind: kind, items: items };
}

// The rail across the top in place of the clock box: an umber box from (1, 1), 11 tall. R-13: a
// clock glyph before the seconds, and on a booking each count of plates left sits on a cream ticket
// (dark digits, green once that meat's tickets are done), so it never reads as the chips' stock.
const CLOCK_GLYPH = ['.ccc.', 'c.c.c', 'c.cc.', 'c...c', '.ccc.'];   // 5 by 5, cream
// Joel's phone playtest (2026-10-19): the clock gets its own box and the meat tickets start in a second
// box 2 px to its right, so "17" never runs into a sausage icon and a count. railBoxes keeps the last
// layout for the harness: { clock: [x, w], items: [x, w] or null }, in overlay sim px.
let railBoxes = null;
function drawClockBox(clock) {
  const bw = 6 + art.textWidth(clock) + 4;
  octx.fillStyle = COLOR.U;
  octx.fillRect(1, 1, bw, 11);
  octx.fillStyle = COLOR.C;
  for (let gy = 0; gy < CLOCK_GLYPH.length; gy++) {
    for (let gx = 0; gx < CLOCK_GLYPH[gy].length; gx++) if (CLOCK_GLYPH[gy][gx] === 'c') octx.fillRect(3 + gx, 3 + gy, 1, 1);
  }
  T(clock, 9, 3, null);
  railBoxes = { clock: [1, bw], items: null };
  return 1 + bw + 2;
}
function drawRail(r, s) {
  const clock = clockStr(s);
  const booking = r.kind === 'booking';
  const strs = [];
  const x0 = drawClockBox(clock);
  let w = 0;
  for (let i = 0; i < r.items.length; i++) {
    const it = r.items[i];
    const str = String(booking ? it.left : it.sold);
    strs.push(str);
    w += 2 + 8 + 1 + art.textWidth(str) + (booking ? 2 : 0);
  }
  const bw = Math.min(176 - x0, w + 2);
  if (r.items.length && bw > 12) {
    octx.fillStyle = COLOR.U;
    octx.fillRect(x0, 1, bw, 11);
    railBoxes.items = [x0, bw];
  }
  let x = x0 - 1;
  for (let i = 0; i < r.items.length; i++) {
    const it = r.items[i];
    const tw = art.textWidth(strs[i]);
    if (x + 2 + 8 + 1 + tw + (booking ? 2 : 0) > x0 + bw) break;
    x += 2;
    D('icon_' + it.meat, x, 2);
    x += 9;
    if (booking) {
      octx.fillStyle = it.left > 0 ? COLOR.C : COLOR.lawnA;
      octx.fillRect(x, 2, tw + 2, 9);
      T(strs[i], x + 1, 3, 'K');
      x += tw + 2;
    } else {
      T(strs[i], x, 3, 'white');
      x += tw;
    }
  }
  // Q-4: booked guests waiting off canvas for a line spot, in a small box under the rail.
  const wait = booking && typeof sim.gateWaiting === 'function' ? sim.gateWaiting() | 0 : 0;
  if (wait > 0) {
    const ws = '+' + wait;
    const pm = PIX.people.map;
    octx.fillStyle = COLOR.U;
    octx.fillRect(1, 13, 2 + pm[0].length + 2 + art.textWidth(ws) + 2, 11);
    octx.fillStyle = COLOR.C;
    for (let gy = 0; gy < pm.length; gy++) {
      for (let gx = 0; gx < pm[gy].length; gx++) if (pm[gy][gx] !== '.') octx.fillRect(3 + gx, 15 + gy, 1, 1);
    }
    T(ws, 3 + pm[0].length + 2, 15, null);
  }
}

// Canvas text: cream through art.text, any other color through art.textTinted.
function T(str, x, y, colorKey) {
  if (!colorKey || colorKey === 'C') art.text(octx, str, x, y);
  else art.textTinted(octx, str, x, y, colorKey);
  recT(str, x, y);
}

// captureFrame records for a T() string at (x, y), in the v2 font's advances, whichever font drew it.
// v3.6: the overlay is taller than the v3.5 canvas; its lower half records where that canvas had it
// (SH 144), and a glyph past the sim yard (a number over the barn) keeps no record.
function recY(y) { return ovRec && y > SH / 2 ? y - SH + 144 : y; }
function recT(str, x, y) {
  if (!capturing) return;
  const fs = size('font');
  const s = String(str).toUpperCase();
  let cx = x;
  y = recY(y);
  if (y < 0 || y + fs[1] > VH) return;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') { cx += fs[0] + 1; continue; }
    const g = glyphFrame(ch);
    if (g < 0) continue;
    if (cx >= 0 && cx + fs[0] <= VW) recs.push({ name: 'font', frame: g, x: cx, y: y, w: fs[0], h: fs[1] });
    cx += fs[0] + 1;
  }
}

// Floating number: the string in the outline color at four 1 px offsets, then in its color on
// top (round 2; no box). Only the colored pass is recorded by captureFrame.
const FLOAT_KIND = { yellow: 'cash', white: 'tip', pink: 'fan' };
function popText(str, x, y, colorKey) {
  const m = octx.getTransform();
  const lo = VIEW.x0 - m.e / m.a, hi = lo + VIEW.w;
  if (B3 && B3.floatNum(octx, str, x, y, FLOAT_KIND[colorKey] || 'plain', [lo, hi])) { recT(str, x, y); return; }
  art.textTinted(octx, str, x - 1, y, 'outline');
  art.textTinted(octx, str, x + 1, y, 'outline');
  art.textTinted(octx, str, x, y - 1, 'outline');
  art.textTinted(octx, str, x, y + 1, 'outline');
  T(str, x, y, colorKey);
}

// Canvas text in an umber box: the box 1 px up and left of the text, width + 3 by 8.
function boxText(str, x, y, colorKey) {
  if (B3 && B3.ready) {
    // The art3 font at 2x (5 by 7 sim px caps) in an umber box with an outline edge.
    const w3 = Math.ceil(B3.textWidth(str, { scale: 2 }));
    octx.fillStyle = COLOR.outline;
    octx.fillRect(x - 1, y - 1, w3 + 3, 10);
    octx.fillStyle = COLOR.U;
    octx.fillRect(x - 0.5, y - 0.5, w3 + 2, 9);
    B3.text(octx, str, x + 0.5, y + 1, 'K', { scale: 2 });
    B3.text(octx, str, x + 0.5, y + 0.5, colorKey || 'C', { scale: 2 });
    recT(str, x + 1, y + 1);
    recT(str, x, y);
    return;
  }
  octx.fillStyle = COLOR.U;
  octx.fillRect(x - 1, y - 1, art.textWidth(str) + 3, 8);
  T(str, x + 1, y + 1, 'K');
  T(str, x, y, colorKey);
}


// A piece's timer (spec C): a bar w rp wide and 1 rp tall on a dark 3 rp tray at world rp (x, y),
// filled left to right by frac.
// v3.4 playtest: the bar is 2 rp tall in a 4 rp outline (was 1 in 3), easier to read at a glance.
function drawRing(x, y, w, frac, color) {
  const n = Math.max(0, Math.min(w, Math.round(frac * w)));
  onWorld(function () {
    octx.fillStyle = COLOR.outline;
    octx.fillRect(x - 1, y - 2, w + 2, 4);
    if (n === 0) return;
    octx.fillStyle = color;
    octx.fillRect(x, y - 1, n, 2);
  });
}

// ---------------------------------------------------------------- render: ground

function lawnTile(x, y, clover) {
  const alt = (clover && clover.has(x + ',' + y)) || (x * 5 + y * 3) % 3 === 0;
  D(MAP.stripe(x) === 'a' ? 'lawn_a' : 'lawn_b', x * TILE, y * TILE, alt ? 1 : 0);
}
function paverTile(x, y) {
  D('paver', x * TILE, y * TILE, (x * 7 + y * 3) % 2);
}

// Paver drawn on this tile: PAVER ground, or a lawn tile on the customer route.
function paverAt(x, y) {
  return MAP.at(x, y) === MAP.T.PAVER || PATH_TILES.has(x + ',' + y);
}

// v3.6: the world behind everything (bridge stage: sky, ground, back fence, barn, sign), then the
// "+" marks on unbought spots (spec D), a ground mark under every object and person, hidden while
// someone stands on the spot.
function drawGround(s) {
  octx.fillStyle = SKY;
  octx.fillRect(0, 0, SW, SH);
  if (B3) {
    const door = MAP.props.find(function (p) { return p.id === 'shed'; });
    const sign = MAP.props.find(function (p) { return p.id === 'sign'; });
    let sg = null;
    if (sign) { const ts = tilesOf(sign).concat(sign.tiles ? sign.tiles.map(ptOf) : []), b = spanOf(ts); sg = [b.x0, b.x1 > b.x0 ? b.x1 : b.x0 + 1]; }
    B3.stage(octx, MAP, { walk: wornTiles(), door: door ? ptOf(door.tile).x : null, sign: sg, name: pitName(s) });
    if (sign && MAP.signText) { const info = signInfo(); if (info) recordGlyphs(info.font, info.text, info.x, info.font === 'font_s' ? MAP.signText.y + 1 : MAP.signText.y); }
  }
  const sale = saleShown() ? forSale() : [];
  const people = [s.player, s.buddy, s.tender, s.prep, s.cashier || null, s.pitCard || null].concat(s.customers.filter(function (c) { return c.mode !== 'eating' && c.mode !== 'seated'; }));
  const onTile = function (tiles) {
    return people.some(function (m) { return m && hasTile(tiles, Math.round(m.px / TILE), Math.round(m.py / TILE)); });
  };
  for (let i = 0; i < sale.length; i++) {
    const e = sale[i];
    if (idOwned(e.id) || onTile(e.tiles)) continue;
    const c = tilesRp(e.tiles);
    if (B3) B3.plus(octx, c[0], c[1]);
    if (capturing) { const t = e.tiles[0]; recs.push({ name: 'plus', id: e.id, frame: 0, x: t.x * TILE, y: t.y * TILE, w: TILE, h: TILE }); }
  }
  dressBarn();
  drawActRings(s);
}

// An art3 sprite on the footprint `tiles`, anchored on their centroid, in the depth pass. A long one
// draws one slice per tile, clipped to that tile's column band (between the midpoints to its
// neighbours' centres) and keyed by that tile, so someone beside one end sorts right against each part.
// o: { flip, adj (depth adjust), rec [name, x, y, frame], hit { st } or { at }, top (drawn on top) }.
function pushArt(push, name, frame, tiles, o) {
  o = o || {};
  const c = tilesRp(tiles), X = c[0], Y = c[1], adj = o.adj || 0;
  let recd = false;
  const rec = function () { if (!recd && o.rec) { recd = true; recOnly(o.rec[0], o.rec[1], o.rec[2], o.rec[3]); } };
  const cs = tiles.map(function (t) { return { t: t, c: tileRp(t.x, t.y) }; }).sort(function (a, b) { return a.c[0] - b.c[0]; });
  let front = -Infinity;
  cs.forEach(function (e, i) {
    const xa = i === 0 ? -1e4 : (cs[i - 1].c[0] + e.c[0]) / 2, xb = i === cs.length - 1 ? 1e4 : (e.c[0] + cs[i + 1].c[0]) / 2;
    front = Math.max(front, e.t.x + e.t.y);
    push(e.t.x + e.t.y + adj, 1, e.c[0], function () {
      if (cs.length === 1) (o.outline ? put3o : put3)(name, frame, X, Y, o.flip);
      else onWorld(function () {
        octx.save();
        octx.beginPath();
        octx.rect(xa, -1e4, xb - xa, 2e4);
        octx.clip();
        (o.outline && A3.drawAtOutlined ? A3.drawAtOutlined : A3.drawAt)(octx, name, Math.round(X), Math.round(Y), frame | 0, o.flip === true);
        octx.restore();
      });
      if (o.hit) hitPush(name, frame, X, Y, o.flip, cs.length > 1 ? [xa, xb] : null, o.hit);
      rec();
    });
  });
  if (o.top || o.badge) push(front + adj, 1.5, X, function () { if (o.badge) drawBadge(o.badge, name, frame, X, Y); if (o.top) o.top(X, Y); });
  return { X: X, Y: Y };
}

// Meat on the grate (spec C): the spots and the piece scale come from the rule sprite's grate
// (A3.rule.meta(name).grate, [x, y, rx, ry] rp from its anchor): the slots split the grate into a
// grid, each piece drawn scaled to fit its cell with its opaque foot on the grate. A kettle with meat
// on draws its open frame (the grate showing, the lid hung on its side); the drum's sits on its lid
// rack. Each piece's timer is a short bar over it, as wide as the piece.
const GRATE_DEF = Object.freeze({ kettle: [0, -15, 9, 3], drum: [0, -23, 8, 3] });
function artMeta(name) {
  try { return A3 && A3.rule && A3.rule.has && A3.rule.has(name) ? A3.rule.meta(name) || {} : {}; } catch (e) { return {}; }
}
function grateOf(name) {
  let g = null;
  try { const m = A3 && A3.rule && A3.rule.has && A3.rule.has(name) ? A3.rule.meta(name) : null; g = m && m.grate; } catch (e) { g = null; }
  return Array.isArray(g) && g.length === 4 ? g : (GRATE_DEF[name] || GRATE_DEF.kettle);
}
function grateSpots(name, n) {
  const mt = artMeta(name);
  // v4.1: the ladder cookers list a spot a slot on their own grate or racks.
  if (Array.isArray(mt.grateSpots) && mt.grateSpots.length >= n) return { spots: mt.grateSpots.slice(0, n), cell: mt.grateCell || 6, custom: true };
  const g = grateOf(name), cols = Math.max(1, Math.min(2, n)), rows = Math.max(1, Math.ceil(n / cols));
  const cw = 2 * g[2] / cols, out = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = (i / cols) | 0;
    out.push([g[0] + (c - (cols - 1) / 2) * cw * 0.95, g[1] + (r - (rows - 1) / 2) * g[3] * 1.2]);
  }
  return { spots: out, cell: cw };
}
function drawPieces(st, ck, name, X, Y, flip) {
  const sx = flip ? -1 : 1;   // v4.7: a turned cooker's grate spots mirror with its art
  const n = Math.max(1, st.slotPx ? st.slotPx.length : 2), G = grateSpots(name, n), spots = G.spots;
  const list = ck.pieces.slice().sort(function (a, b) { return (spots[a.slot] ? spots[a.slot][1] : 0) - (spots[b.slot] ? spots[b.slot][1] : 0); });
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const late = p.state === 'done' && p.warn === true;
      if (late !== (pass === 1)) continue;
      let q = spots[p.slot] || spots[0], cell = G.cell;
      const pos = piecePos(st, p), f = pieceFrame(p), nm = 'piece_' + p.meat;
      // Feedback audit item 18: on the drum a piece that takes k slots (a 4 slot brisket) sits in
      // the middle of its k cells and is scaled to their width, so it fills the drum's mouth.
      const span = name === 'drum' || G.custom ? Math.max(1, Math.min(n - (p.slot | 0), p.size | 0)) : 1;
      if (span > 1 && artMeta(name).grateSpan === 'stack') {
        // v4.1: on the cabinet's racks a 2 slot piece lies on the lower of its racks.
        q = spots[Math.min(n - 1, (p.slot | 0) + span - 1)] || q;
      } else if (span > 1) {
        let sx = 0, sy = 0;
        for (let k = 0; k < span; k++) { const sp = spots[(p.slot | 0) + k] || q; sx += sp[0]; sy += sp[1]; }
        q = [sx / span, sy / span];
        cell = G.custom ? G.cell * 1.6 : G.cell * Math.min(span, 2) + 4;
      }
      const me = MEATS[p.meat];
      if (!A3 || !A3.has(nm)) { D(nm, pos.x, pos.y, f); continue; }
      const m0 = maskOf(nm, 0, false), m = maskOf(nm, f, false);
      const ow = m0.x1 >= m0.x0 ? m0.x1 - m0.x0 + 1 : m0.w;
      const sc = Math.max(0.25, Math.min(1, Math.floor(cell * 4 / ow) / 4));
      const foot = m.y1 >= 0 ? m.y1 + 1 : m.ay, top = m.y1 >= 0 ? m.y0 : 0;
      const PX = Math.round(X + sx * q[0]), PY = Math.round(Y + q[1] + 1 + (m.ay - foot) * sc);
      onWorld(function () {
        octx.save();
        octx.translate(PX, PY);
        octx.scale(sc, sc);
        A3.drawAt(octx, nm, 0, 0, f);
        octx.restore();
      });
      recOnly(nm, pos.x, pos.y, f);
      if (!me) continue;
      const bw = Math.max(G.custom ? 8 : 10, Math.round((m.x1 >= m.x0 ? m.x1 - m.x0 + 1 : ow) * sc));   // v3.4: at least 10 rp (v4.1: 8 on a ladder cooker)
      const bx = Math.round(PX + (m.x0 - m.ax) * sc + ((m.x1 - m.x0 + 1) * sc - bw) / 2), by = Math.round(PY + (top - m.ay) * sc) - 4;
      if (p.state === 'cooking') drawRing(bx, by, bw, Math.min(1, p.prog / me.cook), COLOR.O);
      else if (p.state === 'done') drawRing(bx, by, bw, Math.max(0, 1 - (p.prog - me.cook) / me.window), late ? COLOR.red : COLOR.lawnA);
      else drawRing(bx, by, bw, 1, COLOR.K);
    }
  }
}

// The fire gauge beside a lit cooker: a 2 rp bar, 16 tall, right of the sprite (an out fire shows
// on the cooker itself).
function drawGauge(ck, X, Y, flip) {
  if (!(ck.fire > 0)) return;
  onWorld(function () {
    const gx = flip ? Math.round(X) - 16 : Math.round(X) + 14, top = Math.round(Y) - 20, h = 16;
    octx.fillStyle = COLOR.outline;
    octx.fillRect(gx - 1, top - 1, 4, h + 2);
    const inner = h;
    const f = Math.max(0, Math.min(1, ck.fire / C.FIRE_MAX));
    const fh = Math.round(f * inner);
    octx.fillStyle = COLOR.K;
    octx.fillRect(gx, top, 2, h);
    if (fh > 0) { octx.fillStyle = bandColor(PitSim.fireBand(ck.fire)); octx.fillRect(gx, top + (inner - fh), 2, fh); }
    octx.fillStyle = COLOR.C;
    const t1 = top + inner - Math.round(C.FIRE_GOOD / C.FIRE_MAX * inner), t2 = top + inner - Math.round(C.FIRE_HOT / C.FIRE_MAX * inner);
    octx.fillRect(gx - 1, t1, 1, 1); octx.fillRect(gx + 2, t1, 1, 1);
    octx.fillRect(gx - 1, t2, 1, 1); octx.fillRect(gx + 2, t2, 1, 1);
  });
}

function drawStack(meat, count, x, y, max) {
  const n = Math.min(count, max);
  const name = 'plate_' + meat;
  for (let k = 0; k < n; k++) D(name, x, y - k);
}

// Plate spots on the board's top (rp from its anchor), the stacks' v2 spots kept for the records.
const BOARD_RP = [[-7, -17], [5, -18], [-4, -12], [8, -13], [0, -15]];
function stationItems(st, s, push) {
  const a = stationArt(st), d = drawOf(st), hit = { st: st };
  const ck = st.type === 'cooker' ? s.stations[st.id] : null;
  if (st.type === 'cooker') {
    const band = PitSim.fireBand(ck ? ck.fire : 0);
    const open = ck && ck.pieces.length > 0 && (a.name === 'kettle' || artMeta(a.name).open > 0);
    // v4.1: a ladder cooker with meat on opens its door or lid (frames 4 to 7, the fire band kept).
    const frame = open ? (a.name === 'kettle' ? 4 : artMeta(a.name).open + (BAND_FRAME[band] || 0)) : (BAND_FRAME[band] || 0);
    pushArt(push, a.name, frame, a.tiles, { outline: true, flip: a.flip, rec: [st.sprite || a.name, d.x, d.y, BAND_FRAME[band] || 0], hit: hit, top: function (X, Y) {
      if (!ck) return;
      drawGauge(ck, X, Y, a.flip);
      drawPieces(st, ck, a.name, X, Y, a.flip);
    } });
  } else if (st.type === 'board') {
    const b = s.stations.board;
    pushArt(push, 'board', b && b.slicing ? 1 : 0, a.tiles, { outline: true, badge: 'knife', rec: ['board', d.x, d.y, b && b.slicing ? 1 : 0], hit: hit, top: function (X, Y) {
      if (b && b.stacks) {
        for (let j = 0; j < b.stacks.length && j < BOARD_OFFS.length; j++) {
          const stack = b.stacks[j];
          if (!stack || !stack.times || !stack.times.length) continue;
          const n = Math.min(stack.times.length, BOARD_DRAW_MAX), q = BOARD_RP[j];
          for (let k = 0; k < n; k++) drawRp('plate_' + stack.meat, 0, X + q[0], Y + q[1] - k, d.x + BOARD_OFFS[j][0], d.y + BOARD_OFFS[j][1] - k);
        }
      }
      // X13.7: up to two pieces left for the PREP card, at the board's two ends.
      if (b && Array.isArray(b.waiting)) {
        for (let j = 0; j < b.waiting.length && j < 2; j++) {
          const w = b.waiting[j];
          if (w && MEATS[w.meat]) drawRp('hand_cooked_' + w.meat, 0, X + (j === 0 ? -9 : 9), Y - 13, d.x + (j === 0 ? -1 : 9), d.y + 4);
        }
      }
    } });
  } else if (st.type === 'cooler') {
    const f = s.gear.cooler ? (sim.reach() === 'cooler' ? 2 : 1) : 0;
    pushArt(push, 'cooler', f, a.tiles, { outline: true, badge: 'snow', rec: ['cooler', d.x, d.y, f], hit: hit });
  } else if (st.type === 'table') {
    const big = a.name === 'counter_long';
    const recs2 = function () { if (big && extTile) { const e = extRect(); recOnly('counter_ext', e.x, e.y, 0); } };
    pushArt(push, a.name, 0, a.tiles, { outline: true, badge: 'plate', rec: ['counter', d.x, d.y, big ? 1 : 0], hit: hit, top: recs2 });
    // Plates on the counter top, one spot per tile (two on the extension), each over its own tile.
    const spots = s.stations.table ? s.stations.table.spots : [];
    const slots = A3.rule.slots(a.name), an = A3.anchor(a.name, 0);
    const byY = a.tiles.slice().sort(function (u, v) { return u.y - v.y; });
    for (let i = 0; i < spots.length && i < slots.length; i++) {
      const stack = spots[i];
      if (!stack || !stack.times || !stack.times.length) continue;
      if (i >= 3 && !big) continue;
      const t = byY[Math.min(i, byY.length - 1)], sl = slots[i];
      const leg = st.spotPx && st.spotPx[i] ? st.spotPx[i] : { x: t.x * TILE + 4, y: t.y * TILE + 4 };
      const name = 'plate_' + stack.meat, n = Math.min(stack.times.length, C.TABLE_STACK);
      push(t.x + t.y, 1.5, a.X, function () {
        for (let k = 0; k < n; k++) { put3o(name, 0, a.X - an.ax + sl[0], a.Y - an.ay + sl[1] - k); recOnly(name, leg.x, leg.y - k, 0); }
      });
    }
  } else if (st.type === 'register') {
    // v3.6: frame 1 (a coin on top) while a guest waits to pay (v3.7: at the front of the line).
    const tk = s.customers.some(function (c) { return c.queueIndex === 0 && c.mode === 'waiting'; }) ? 1 : 0;
    const nm = A3 && A3.has('register') ? 'register' : a.name, f = tk > 0 ? 1 : 0;
    try { const rb = boxRp(nm, 0, a.X, a.Y); regClear = { x0: rb.x0 - 1, x1: rb.x1 + 1, y0: rb.y0 - 1, y1: rb.y1 }; } catch (e) { regClear = null; }
    // Joel 2026-10-20: the coin badge only while a guest waits to pay.
    pushArt(push, nm, f, a.tiles, { outline: true, badge: tk ? 'coin' : null, rec: ['register', d.x, d.y, f], hit: hit });
  } else if (st.type === 'pile') {
    const n = s.charcoal | 0, f = n >= 5 ? 0 : n >= 3 ? 1 : n >= 1 ? 2 : 3;
    pushArt(push, 'pile', f, a.tiles, { outline: true, badge: 'bag', rec: ['pile', d.x, d.y, f], hit: hit });
  } else if (st.type === 'woodrack') {
    // v4.9: the wood rack shows the splits it holds: full from 5, low from 1, the empty rails at 0.
    const n = s.wood | 0, f = n >= 5 ? 0 : n >= 1 ? 1 : 2;
    pushArt(push, 'woodpile', f, a.tiles, { outline: true, badge: 'log', rec: ['woodpile', d.x, d.y, f], hit: hit });
  } else {
    pushArt(push, a.name, 0, a.tiles, { outline: true, rec: [st.sprite || a.name, d.x, d.y, 0], hit: hit });
  }
}

// v4.4 (Joel 2026-10-20: "this just looks too blah. The 8 bit had all sorts of cool stuff"): set
// dressing on the fringe tiles (the barn apron row 0, the fence aprons column 0, row 11 and column
// 10, none of which a guest, the crew or Arrange can use) and on the street past the gate. Drawn in
// the depth pass with no tap box and no capture record, so taps still land on stations and seats.
// [art name, frame, tile x, tile y]. Column 0 row 7 stays clear for the light post.
const DRESS = Object.freeze([
  ['barrel_planter', 0, 6, 0], ['drink_tub', 0, 9, 0], ['barrel_planter', 1, 10, 0], ['barrel_planter', 2, 1, 0],
  ['pot', 1, 0, 2], ['hay_bale', 0, 0, 3], ['pumpkins', 0, 0, 4], ['pot', 0, 0, 5], ['woodpile', 0, 0, 8], ['woodpile', 1, 0, 9], ['barrel_planter', 1, 0, 10],
  ['hay_bale', 1, 1, 11], ['pumpkins', 0, 2, 11], ['pot', 1, 4, 11], ['barrel_planter', 0, 7, 11], ['barrel_planter', 2, 9, 11],
  ['pot', 1, 10, 1], ['pot', 0, 10, 5], ['hay_bale', 0, 10, 8], ['pot', 0, 10, 10],
  // art review 2026-10-20: the cornhole pair moved out to the side lawn past the front-right fence (x 11),
  // where the low boards read whole; on column 10 the picket hid all but their top edge.
  ['cornhole', 0, 11, 4], ['cornhole', 1, 11, 7],
  ['aframe', 0, 7, 12], ['mailbox', 1, 5, 12], ['bush', 1, 11, 3], ['bush', 2, 11, 8], ['bush', 0, 4, 13], ['bush', 2, 1, 13]
]);
// Row 0 pieces stand against the barn, behind everything else, so they draw with the ground (before
// the canopy, whose roof covers that stretch of wall); the rest go in the depth pass.
function dressItems(push) {
  if (!A3) return;
  for (let i = 0; i < DRESS.length; i++) {
    const d = DRESS[i];
    if (d[3] === 0 || !A3.has(d[0])) continue;
    pushArt(push, d[0], d[1], [{ x: d[2], y: d[3] }], {});
  }
}
function dressBarn() {
  if (!A3) return;
  for (let i = 0; i < DRESS.length; i++) {
    const d = DRESS[i];
    if (d[3] !== 0 || !A3.has(d[0])) continue;
    const c = tileRp(d[2], d[3]);
    put3(d[0], d[1], c[0], c[1]);
  }
}
// The dog (art3 yard 'dog', side view facing left): walk frames 0 to 3, sit 4, nap 5 and 6.
function drawDog(dx, dy) {
  if (!A3 || !A3.has('dog') || MAP.at(Math.round(dx / TILE), Math.round(dy / TILE)) === MAP.T.PAVER) return;
  let f;
  if (dog.frame === 3) f = reduced ? 5 : 5 + (Math.floor(tAnim / 1.2) % 2);
  else if (dog.frame === 2) f = 4;
  else f = reduced ? 0 : Math.floor(tAnim * 8) % 4;
  put3('dog', f, isoX(dx + 8, dy + 8) * RS, isoY(dx + 8, dy + 8) * RS + 4, dog.flip === true);
}
// A lawn tile next to (or on) an owned station tile.
function nearStation(x, y) {
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (!owned(st)) continue;
    for (let j = 0; j < st.tiles.length; j++) if (Math.abs(st.tiles[j].x - x) <= 1 && Math.abs(st.tiles[j].y - y) <= 1) return true;
  }
  return false;
}

// v4.5: a booking's host folding chairs and tables (sim.hostSeating), drawn like the yard's own
// chairs; a tap on one is a tap on its seat.
function hostItems(push) {
  if (!A3 || !A3.has('fold_chair') || !A3.has('fold_table')) return;
  const h = hostNow();
  for (let i = 0; i < h.seats.length; i++) {
    const se = h.seats[i], at = [se.x * TILE + 8, se.y * TILE + 8];
    pushArt(push, 'fold_chair', 0, [{ x: se.x, y: se.y }], { hit: { at: at, seat: se.id } });
    pushArt(push, 'fold_table', 0, [{ x: se.table.x, y: se.table.y }], { hit: { at: at, seat: se.id } });
  }
}
// What each prop draws (rule art names), by its v2 sprite. Wall pieces (door, sign) are in the stage.
const PROP_FRAME = { pot1: 0, pot2: 1, pot3: 0, pot4: 0, planter: 2, planter2: 1, woodpile: 0, woodpile2: 1, woodpile3: 1, woodpile4: 0 };
// v3.4 playtest: no decorative props in the work area (on the pavers or next to a station tile).
let WORK = null;
function inWork(tiles) {
  if (!WORK) {
    WORK = Object.create(null);
    MAP.stations.forEach(function (st) {
      st.tiles.forEach(function (t) { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) WORK[(t.x + dx) + ',' + (t.y + dy)] = true; });
    });
  }
  const PV = MAP.T && MAP.T.PAVER !== undefined ? MAP.T.PAVER : null;
  return tiles.some(function (t) { return WORK[t.x + ',' + t.y] || (PV !== null && typeof MAP.at === 'function' && MAP.at(t.x, t.y) === PV); });
}
// Joel 2026-10-20: the hose reel too (the stray green thing on the lawn right of the picnic table).
const CLUTTER = Object.freeze({ pot: 1, planter: 1, mailbox: 1, woodpile: 1, tree: 1, shelf: 1, hose: 1 });
function propItems(p, push) {
  if (p.id === 'shed' || p.id === 'sign' || p.sprite === 'shed' || p.sprite === 'sign' || p.sprite === 'picnic_bench') return;
  const tiles = tilesOf(p), d = drawOf(p);
  if (!tiles.length) return;
  if (p.sprite !== 'picnic' && inWork(tiles)) return;
  // v3.4 review: the decor that competed with the stations stays off the yard (its record stays for
  // the harness): pots, planters, the mailbox, the log piles, the tree and the shelf.
  if (CLUTTER[p.sprite]) { recOnly(p.sprite, d.x, d.y, p.frame | 0); return; }
  if (p.sprite === 'picnic') { picnicItems(tiles, push, ['picnic', d.x, d.y, p.frame | 0]); return; }
  const name = p.sprite === 'planter' ? 'pot' : p.sprite;
  if (!A3.has(name)) return;
  const f = p.id in PROP_FRAME ? PROP_FRAME[p.id] : (p.frame | 0);
  // A prop on more than one tile (blocks) anchors on its first; one tile props on their tile.
  pushArt(push, name, f, name === 'tree' || tiles.length === 1 ? [tiles[0]] : tiles, { rec: [p.sprite, d.x, d.y, p.frame | 0] });
}
// A picnic table: the far bench at the seat row's depth (drawn before its sitters), then the table
// and the near bench.
function picnicItems(tiles, push, rec) {
  const c = tilesRp(tiles), at = [c[0], c[1]];
  const g = unIso(c[0] / RS, c[1] / RS);
  pushArt(push, 'picnic_bench', 0, tiles, { adj: -1, rec: rec ? ['picnic_bench', rec[1], rec[2], 0] : null, hit: { at: [g.x, g.y] } });
  pushArt(push, 'picnic', 0, tiles, { rec: rec, hit: { at: [g.x, g.y] } });
  return at;
}
function decorItems(spot, s, push) {
  const tiles = spot.tiles.map(ptOf), d0 = spot.draws && spot.draws[0] ? spot.draws[0] : drawOf(spot);
  const g = tilesRp(tiles), gs = unIso(g[0] / RS, g[1] / RS), hit = { at: [gs.x, gs.y] };
  const rec = function (name) { const dr = spot.draws ? spot.draws.find(function (q) { return q.sprite === name; }) : null; return dr ? [name, dr.x, dr.y, dr.frame | 0] : [name, d0.x, d0.y, 0]; };
  if (spot.id === 'picnic2' || (spot.draws && spot.draws.some(function (q) { return q.sprite === 'picnic'; }))) { picnicItems(tiles, push, rec('picnic')); return; }
  if (spot.id === 'chair1' || spot.id === 'chair2') { pushArt(push, 'chair', 0, tiles, { rec: rec('chair'), hit: hit }); return; }
  if (spot.id === 'flowers') { pushArt(push, 'flower_box', 0, tiles, { rec: rec('bed'), hit: hit }); return; }
  if (spot.id === 'birdbath') {
    const birdOn = birdUntil >= 0 && birdUntil > tAnim && !reduced;
    pushArt(push, 'birdbath', birdOn ? 1 : 0, tiles, { rec: rec('birdbath'), hit: hit });
    return;
  }
  if (spot.id === 'lights') { pushArt(push, 'lights_post', 0, [lightsHooks().post], { rec: rec('lights_post') }); return; }
  const dr = spot.draws ? spot.draws.find(function (q) { return !q.overhead && A3.has(q.sprite); }) : null;
  if (dr) pushArt(push, dr.sprite, dr.frame | 0, tiles, { rec: [dr.sprite, dr.x, dr.y, dr.frame | 0], hit: hit });
}

// v3.6: one depth sorted pass (spec F): key the footprint's front tile x + y, then the layer
// (objects 1, what sits on them 1.5, people 2, what people hold 2.5), then X, then push order.
function drawSorted(s) {
  const items = [];
  let order = 0, label = null;   // label: what drawLog names this item (the harness reads the order)
  const push = function (d, l, X, fn) { items.push({ d: d, l: l, x: X, o: order++, f: fn, n: label }); };
  peopleBoxes = peopleNext; peopleNext = []; badgeLog = []; regClear = null; custBoxes.clear();
  const T_ = MAP.T;
  const open = gateOpen(s);

  // Fence records (v2 names, sim px), then the front pickets and the gate on the two front edges.
  for (let y = 0; y < MAP.H; y++) {
    for (let x = 0; x < MAP.W; x++) {
      const t = MAP.at(x, y), px = x * TILE;
      if (t === T_.FENCE && y === 0) recOnly('fence_back', px, 0, x === 0 || x === MAP.W - 1 ? 1 : 0);
      else if (t === T_.FENCE) { const n = fenceName(x, y); recOnly(n, px, (y + 1) * TILE - size(n)[1], 0); }
      else if (t === T_.GATE) recOnly('gate', px, (y + 1) * TILE - size('gate')[1], open ? 1 : 0);
    }
  }
  const mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  for (let ty = 0; ty < MAP.H; ty++) {
    const m = mid(vtxRp(MAP.W, ty), vtxRp(MAP.W, ty + 1));
    push(MAP.W - 1 + ty + 0.95, 1, m[0], function () { put3('fence_side', ty === 0 ? 1 : 0, m[0], m[1]); });
  }
  const gx = MAP.gate ? MAP.gate.x : -1;
  for (let tx = 0; tx < MAP.W; tx++) {
    const m = mid(vtxRp(tx, MAP.H), vtxRp(tx + 1, MAP.H));
    push(tx + MAP.H - 1 + 0.95, 1, m[0], function () { put3(tx === gx ? 'gate' : 'fence_front', tx === gx && open ? 1 : 0, m[0], m[1]); });
  }

  for (let i = 0; i < MAP.props.length; i++) propItems(MAP.props[i], push);
  dressItems(push);
  for (let i = 0; i < MAP.stations.length; i++) if (owned(MAP.stations[i])) { label = MAP.stations[i].id; stationItems(MAP.stations[i], s, push); }
  label = null;
  canopyItems(s, push);
  for (let i = 0; i < MAP.decor.length; i++) if (s.decor[MAP.decor[i].id] === true) decorItems(MAP.decor[i], s, push);
  hostItems(push);

  // People (layer 2): the player, the RUN, FIRE and PREP cards' movers, then customers by id.
  const staff = [['player', s.player, ''], ['buddy', s.buddy, 'run'], ['tender', s.tender, 'fire'], ['prep', s.prep || null, 'prep'], ['till', s.cashier || null, 'till'], ['pit', s.pitCard || null, 'pit']];
  for (let i = 0; i < staff.length; i++) {
    const m = staff[i][1], role = staff[i][2];
    if (!m) continue;
    let kind = staff[i][0];
    if (role) {
      const card = moverCard(m);
      if (card && card.look) ensureCrewLook(role, card.look);
      if (kind === 'prep' && !art.has('prep_down')) kind = 'buddy';
      if (kind === 'till' && !B3) kind = 'buddy';   // v3.6: the TILL card draws through art3
      if (kind === 'pit' && !B3) kind = 'buddy';    // v4.3: so does the PIT card
    }
    const mx = Math.round(m.px), my = Math.round(m.py);
    if (kind === 'player') playerDrawn = [isoX(mx + 8, my + 8) * RS, isoY(mx + 8, my + 8) * RS];
    label = kind;
    push((mx + my) / TILE, 2, isoX(mx + 8, my + 8) * RS, function () { withShift(moverShift(mx, my), function () { drawMover(kind, m, s); }); keepPerson(null); });
    label = null;
  }
  const custs = s.customers.slice().sort(byId);
  eatPlates.clear();
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    const seat = c.mode === 'eating' || c.mode === 'seated' ? seatOf(c) : null;   // v3.7: seated, waiting for the plate
    if (seat) {
      const q = seatRp(seat);
      push(seat.x + seat.y, 2, q[0], function () { drawSeated(c, seat); keepPerson(c.id); });
      // The eater's plate: on the table top in front of the seat, or in the lap on a chair.
      const tb = seatTable(seat), sx = seat.x * TILE, sy = seat.y * TILE;
      const px = sx + 4, py = tb || seat.host ? sy + 17 : sy + 9;
      if (c.mode !== 'eating') { /* v3.7: no plate on the table yet */ } else if (seat.host) {
        const tq = tileRp(seat.table.x, seat.table.y);   // v4.5: on the host's folding table top
        eatPlates.set(c.id, { X: tq[0], Y: tq[1] - 9, name: 'plate_' + c.want });
        push(seat.table.x + seat.table.y, 1.5, tq[0], function () { drawRp('plate_' + c.want, 0, tq[0], tq[1] - 9, px, py); });
      } else if (tb) {
        eatPlates.set(c.id, { X: q[0] + 1, Y: q[1] + 4, name: 'plate_' + c.want });
        push(seat.x + seat.y + 1, 1.5, q[0], function () { drawRp('plate_' + c.want, 0, q[0] + 1, q[1] + 4, px, py); });
      } else {
        eatPlates.set(c.id, { X: q[0] + 1, Y: q[1] - 9, name: 'plate_' + c.want });
        push(seat.x + seat.y, 2.5, q[0], function () { drawRp('plate_' + c.want, 0, q[0] + 1, q[1] - 9, px, py); });
      }
    } else {
      const cx = Math.round(c.px), cy = Math.round(c.py);
      label = 'cust' + c.id;
      push((cx + cy) / TILE, 2, isoX(cx + 8, cy + 8) * RS, function () { withShift(moverShift(cx, cy), function () { drawMover('cust', c, s); }); keepPerson(c.id); });
    }
  }
  const dx = Math.round(dog.px), dy = Math.round(dog.py);
  // v3.4 review: the dog no longer draws in the work area (its record stays for the harness).
  // v4.4 (Joel 2026-10-20, the 8-bit yard's dog): the dog draws again on the lawn, and only roams
  // the lawn away from the stations (dogPick), so it never stands in front of one.
  push((dx + dy) / TILE, 2, isoX(dx + 8, dy + 8) * RS, function () { recOnly('dog', dx, dy, dog.frame); drawDog(dx, dy); });

  label = null;
  items.sort(function (a, b) { return (a.d - b.d) || (a.l - b.l) || (a.x - b.x) || (a.o - b.o); });
  for (let i = 0; i < items.length; i++) { if (items[i].n) drawLog.push(items[i].n); items[i].f(); }
  drawCarrySparks(s);   // v4.9: over the depth pass, so a load's sparks read over whoever stands in front
  return custs;
}

function drawSeated(c, seat) {
  const sx = seat.x * TILE, sy = seat.y * TILE;
  const f = c.eat > 0 ? (reduced ? 0 : Math.floor(tAnim / FX.EAT_FRAME_S) % 2) : 2;
  const q = seatRp(seat), name = 'cust' + (((c.body | 0) % 4 + 4) % 4) + '_sit';
  if (B3) B3.person(c.id, false);
  drawRp(name, f, q[0], q[1], sx, sy - 6);
}

// ---------------------------------------------------------------- render: overhead (spec A)

// The string lights from the post along the back fence top to the back corner, then along the barn
// eave to the hook; one smoke column per lit cooker at 70 percent (over the canopy roof, which draws
// right after the depth pass, drawCanopyRoof).
const BULBS = ['#f6d26a', '#ef6b4a', '#8fd25c', '#6fc3f0'];
function drawOverhead(s) {
  if (s.decor.lights === true) {
    const fr = reduced ? 0 : Math.floor(tAnim / FX.TWINKLE_S) % 2;
    const h = lightsHooks(), p0 = tileRp(h.post.x, h.post.y), b = vtxRp(0, 0), e = vtxRp(h.hook.x, h.hook.y);
    const cA = [p0[0] + 2, p0[1] - 66], cB = [b[0], b[1] - 76], cC = [e[0] + 12, e[1] + 6 - 76];
    onWorld(function () {
      [[cA, cB, 14], [cB, cC, 6]].forEach(function (seg, si) {
        const a = seg[0], z = seg[1], n = Math.round(Math.hypot(z[0] - a[0], z[1] - a[1]));
        for (let i = 0; i <= n; i++) {
          const u = i / n, x = Math.round(a[0] + (z[0] - a[0]) * u), y = Math.round(a[1] + (z[1] - a[1]) * u + seg[2] * 4 * u * (1 - u));
          octx.fillStyle = '#3a2a20'; octx.fillRect(x, y, 1, 1);
          if (i % 14 === 7) {
            octx.fillStyle = 'rgba(255, 226, 140, 0.28)'; octx.fillRect(x - 3, y, 7, 5); octx.fillRect(x - 2, y - 1, 5, 7);   // v4.4: the glow
            octx.fillStyle = BULBS[((i / 14 | 0) + si + fr) % 4]; octx.fillRect(x - 1, y + 1, 3, 3);
          }
        }
      });
    });
    const L = MAP.overhead && MAP.overhead.lights;
    recOnly('lights_string', L && typeof L.x === 'number' ? L.x : h.post.x * TILE, L && typeof L.y === 'number' ? L.y : h.post.y * TILE, fr);
  }
  drawBirds();
  if (A3 && A3.fx && typeof A3.fx.drawAt === 'function') {
    const fr = reduced ? 0 : Math.floor(tAnim * 3) % 3;
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (st.type !== 'cooker' || !owned(st)) continue;
      const ck = s.stations[st.id];
      if (!ck || PitSim.fireBand(ck.fire) === 'out') continue;
      const a = stationArt(st), v = ventRp(a);
      // Feedback audit items 18 and 19: the overhead smoke is lighter (0.45, was 0.7) and squashed to
      // 60 percent of its height (the short column on every cooker), so it no longer hides the meat on
      // the next cooker, the cutting board or a station badge behind it.
      octx.save();
      octx.globalAlpha = 0.45;
      onWorld(function () {
        octx.translate(Math.round(v[0]), Math.round(v[1]));
        octx.scale(1, 0.6);
        A3.fx.drawAt(octx, 'smoke_column_short', 0, 0, (fr + i) % 3);
      });
      octx.restore();
    }
  }
}
// v4.4: life in the sky. Two birds sit on the barn ridge (one hops now and then) and a small flock
// crosses the sky, high over the yard (never over a station). Reduced motion keeps the sitters only.
const BIRD_UP = ['o...o', '.o.o.', '..o..'], BIRD_DN = ['.....', '.ooo.', 'o.o.o'];
function birdAt(x, y, rows, col) {
  octx.fillStyle = col;
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === 'o') octx.fillRect(Math.round(x) + i - 1, Math.round(y) + j, 1, 1);
}
function drawBirds() {
  onWorld(function () {
    // the ridge (wall_barn: P(u, -40, 120) from the back corner)
    const r0 = vtxRp(0, 0);
    [[64, 0], [150, 1.7]].forEach(function (b) {
      const hop = !reduced && (Math.floor(tAnim / 0.25 + b[1] * 7) % 23) === 0 ? 1 : 0;
      const x = r0[0] + 40 + b[0], y = r0[1] + (b[0] - 40) / 2 - 120 - 3 - hop;
      octx.fillStyle = '#2a2a33'; octx.fillRect(x - 2, y, 4, 2); octx.fillRect(x + 1, y - 1, 2, 1); octx.fillStyle = '#f2a33a'; octx.fillRect(x + 3, y - 1, 1, 1);
    });
    if (reduced) return;
    for (let k = 0; k < 3; k++) {
      const per = 26 + k * 3, t = ((tAnim + k * 2.1) % per) / per, x = -20 + t * (WORLD.W + 40), y = 30 + k * 9 + Math.sin(t * 9 + k) * 4;
      if (t > 0.98) continue;
      birdAt(x, y, Math.floor(tAnim * 5 + k) % 2 ? BIRD_UP : BIRD_DN, '#3a3a44');
    }
  });
}
// The canopy over the line. Joel 2026-10-23 (week 6: the board drew over the striped roof and the
// roof sat under the counter): a tall roof on four posts. Each post (frame 3, its column clipped)
// sorts in the depth pass by its own tile; the roof (frame 4) draws after the depth pass, 64 rp up,
// so it covers everything under and behind it that stands lower (the board, the counter end, guests
// in the line), while anything in front of its footprint never reaches its pixels (it would have to
// stand taller than 64). Bubbles, numbers and smoke still draw over it.
const CANOPY_POSTS = [[3, 3, 0, 0], [93, 3, 1, 0], [3, 45, 0, 1], [93, 45, 1, 1]];   // u, v in the art, then the corner (x, y)
function canopyItems(s, push) {
  if (s.gear.canopy !== true || !A3) return;
  const tiles = canopyTiles(), b = spanOf(tiles), c = tilesRp(tiles), top = vtxRp(b.x0, b.y0);
  CANOPY_POSTS.forEach(function (q) {
    const tx = q[2] ? b.x1 : b.x0, ty = q[3] ? b.y1 : b.y0, px = top[0] + q[0] - q[1];
    push(tx + ty, 1, px, function () {
      onWorld(function () {
        octx.save();
        octx.beginPath();
        octx.rect(px - 8, -1e4, 16, 2e4);
        octx.clip();
        A3.drawAt(octx, 'canopy', Math.round(c[0]), Math.round(c[1]), 3, false);
        octx.restore();
      });
      drawLog.push('canopy_post');
    });
  });
}
function drawCanopyRoof(s) {
  if (s.gear.canopy !== true) return;
  const tiles = canopyTiles(), c = tilesRp(tiles), cp = MAP.overhead && MAP.overhead.canopy, b = spanOf(tiles);
  const roof = A3 ? boxRp('canopy', 4, c[0], c[1]) : null;
  // The pitmaster under or behind the roof sees through it (the roof at 55 percent while his drawn
  // box meets it), so he never vanishes at a station it covers.
  const p = s.player, pt = p ? (Math.round(p.px) + Math.round(p.py)) / TILE : 0;
  const pb = playerDrawn ? { x0: playerDrawn[0] - 12, x1: playerDrawn[0] + 12, y0: playerDrawn[1] - 47, y1: playerDrawn[1] } : null;
  const see = !!(roof && pb && pt < b.x1 + b.y1 + 1 && overlaps(pb, roof));
  if (see) octx.globalAlpha = 0.55;
  try { put3('canopy', 4, c[0], c[1]); } finally { octx.globalAlpha = 1; }
  drawLog.push(see ? 'canopy_roof_see' : 'canopy_roof');
  // A station's icon chip under the roof draws again over it, so a covered board still shows.
  if (roof) lateBadges.forEach(function (e) { if (!e.by && overlaps(e.chip, roof)) drawBadge(e.a[0], e.a[1], e.a[2], e.a[3], e.a[4], true); });
  recOnly('canopy', cp && typeof cp.x === 'number' ? cp.x : tiles[0].x * TILE, cp && typeof cp.y === 'number' ? cp.y : tiles[0].y * TILE, 0);
}
function ventRp(a) {
  const mt = artMeta(a.name), ck = a.id && sim && sim.state.stations ? sim.state.stations[a.id] : null;
  const v = ck && ck.pieces && ck.pieces.length && mt.ventOpen ? mt.ventOpen : mt.vent;   // v4.1: the ladder cookers' stack tops (the lid up moves it)
  const sx = a.flip ? -1 : 1;   // v4.7: the stack mirrors with a turned cooker
  if (Array.isArray(v) && a.name !== 'kettle' && a.name !== 'drum') return [a.X + sx * v[0], a.Y + v[1]];
  return a.name === 'drum' ? [a.X + sx * 5, a.Y - 38] : [a.X, a.Y - 21];
}
// The v2 vent a cooker's puffs start from (sim px), as updateFx spawns them.
function ventSim(st) {
  const t = st.tiles[0], tx = t.x * TILE, ty = t.y * TILE;
  if (st.sprite === 'cabinet') return { x: tx + 8, y: ty - 18 };   // v4.1
  if (st.sprite === 'stick_burner' || st.sprite === 'trailer_rig') return { x: tx + 4, y: ty - 18 };
  return st.sprite === 'drum' || st.id === 'drum' ? { x: tx + 7, y: ty - 4 } : { x: tx + 11, y: ty - 10 };
}

// Puffs: every one keeps its capture record; the dark ones (a piece about to burn, burnt bursts and
// columns) draw from their cooker's vent. The chimney smoke itself is the overhead column.
function drawSmokeAndFire(s) {
  const warnSet = Object.create(null);
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (st.type === 'cooker' && cookerWarns(s.stations[st.id])) warnSet[st.id] = true;
  }
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    const age = tAnim - p.at;
    if (age < 0 || age >= p.life) continue;
    let x = p.x0 + p.vx * age;
    if (p.sway) x += Math.sin(age * 2 * Math.PI / p.life) * FX.BURNT_COLUMN_SWAY_PX;
    const y = p.y0 - p.rise * age;
    const dark = p.dark || (p.src !== null && warnSet[p.src] === true);
    const name = dark ? 'smoke_dark' : 'smoke', f = Math.min(2, Math.floor(3 * age / p.life));
    const st = p.src ? MAP.station(p.src) : null;
    if (!dark || !st || !owned(st)) { recOnly(name, Math.round(x), Math.round(y), f); continue; }
    const v = ventRp(stationArt(st)), vs = ventSim(st);
    drawRp(name, f, v[0] + (x - vs.x) * 1.5, v[1] + (y - vs.y) * 1.5, Math.round(x), Math.round(y));
  }
}

function bandColor(band) {
  if (band === 'hot') return COLOR.O;
  if (band === 'good') return COLOR.lawnA;
  if (band === 'low') return COLOR.woodL;
  return COLOR.smokeD;
}

// The tap ring: a tile's diamond outline on the ground, then its four corners.
// v4.5: the tap ring is green where the tap will act and red where nothing can be done, on a dark
// edge so it reads on the lawn as well as the patio.
const TAP_OK = '#7ed957', TAP_NO = '#ff5a4a';
function ringRp(tx, ty, color, corners) {
  const t = vtxRp(tx, ty);
  onWorld(function () {
    for (const pass of [0, 1]) {
      octx.fillStyle = pass ? color : '#1b1410';
      for (let r = 0; r <= 24; r++) {
        const w = r <= 12 ? r * 2 : (24 - r) * 2;
        if (corners && r > 2 && r < 22 && w < 42) continue;
        if (pass) { octx.fillRect(t[0] - w, t[1] + r, 2, 1); octx.fillRect(t[0] + w - 2, t[1] + r, 2, 1); }
        else { octx.fillRect(t[0] - w - 1, t[1] + r - 1, 4, 3); octx.fillRect(t[0] + w - 3, t[1] + r - 1, 4, 3); }
      }
    }
  });
}

// ---------------------------------------------------------------- render: the y-sorted pass

function fenceName(x, y) {
  const edgeX = x === 0 || x === MAP.W - 1, edgeY = y === 0 || y === MAP.H - 1;
  if (edgeX && edgeY) return 'fence_corner';
  if (edgeY) return 'fence_h';
  return 'fence_v';
}

function gateOpen(s) {
  if (s.phase !== 'service') return false;
  return (s.clock >= tGate(s) && s.clock < tLast(s)) || s.customers.length > 0;
}

function pieceFrame(p) {
  if (p.state === 'burnt') return 3;
  if (p.state === 'done') return (p.warn === true && size('piece_' + p.meat)[2] >= 5) ? 4 : 2;
  const cook = MEATS[p.meat] ? MEATS[p.meat].cook : 1;
  return p.prog < cook / 2 ? 0 : 1;
}




function staffBody(kind, m, s) {
  const wf = m.walking ? 1 + (Math.floor((m.anim || 0) * 8) % 2) : 0;
  if (kind === 'player' && s.player.busy) return ['player_slice', Math.floor((s.player.busy.t || 0) * 6) % 2, false];
  // X13.7: the PREP card at the board while its slice runs (prep_slice, knife up and down).
  if (kind === 'prep') {
    const sl = s.stations.board ? s.stations.board.slicing : null;
    if (sl && sl.who === 'prep' && m.task === 'slice' && art.has('prep_slice')) return ['prep_slice', reduced ? 0 : Math.floor((sl.t || 0) * 6) % 2, false];
  }
  if (m.face === 'up') return [kind + '_up', wf, false];
  if (m.face === 'left' || m.face === 'right') return [kind + '_side', wf, m.face === 'right'];
  return [kind + '_down', wf, false];
}

function custBody(c) {
  const n = 'cust' + (((c.body | 0) % 4 + 4) % 4);
  const wf = 1 + (Math.floor((c.anim || 0) * 8) % 2);
  const unhappy = c.mood === 'unhappy';
  if (c.face === 'up') return [n + '_up', c.walking ? wf : 0, false];
  if (c.face === 'left' || c.face === 'right') return [n + '_side', c.walking ? wf : (unhappy ? 3 : 0), c.face === 'right'];
  return [n + '_down', c.walking ? (unhappy ? wf + 2 : wf) : 0, false];
}

function staffHand(kind, m, s) {
  const c = m.carrying;
  if (!c) return (kind === 'player' && s.gear.tray && !s.player.busy) ? 'hand_tray' : null;
  if (c.kind === 'charcoal') return 'hand_charcoal';
  if (c.kind === 'wood') return B3 ? 'hand_split' : 'hand_charcoal';   // v4.9: the split (art3 only)
  if (c.kind === 'raw') return 'hand_raw_' + c.meat;
  if (c.kind === 'cooked') return 'hand_cooked_' + c.meat;
  if (c.kind === 'burnt') return 'hand_burnt';
  if (c.kind === 'plates') return (c.times && c.times.length >= 2 ? 'hand_tray_' : 'hand_plate_') + c.meat;
  return null;
}

// v3.7: a guest waiting on the plate (paid, walking to a seat, seated or at a to go spot).
function waitsPlate(c) {
  return c.paid === true && c.fed !== true && (c.mode === 'toSeat' || c.mode === 'seated' || c.mode === 'togo');
}

function custHand(c) {
  if (c.mode === 'toSeat' && c.fed === true) return 'hand_plate_' + c.want;
  if (c.mode === 'leaving' && c.reason === 'togo') return 'hand_togo';
  return null;
}

function hopOffset(c) { return (c.hop > 0 && !reduced) ? -2 : 0; }

// ---- v4.9 pick-up and put-down (Joel 2026-10-24: "picking up logs isn't shown. Much like the
// charcoal the logs should be moveable and have an animation when being picked up or put down").
// A bag or a split that comes into a hand rises from the station into the hands over CARRY_S of
// sim time (the body dips a pixel for the first half); one that leaves a hand moves from the hands
// into the station faced (the cooker's fire box, the rack, the pile) over CARRY_S, and a load into a
// cooker throws a short burst of sparks and ash over it (SPARK_S). Keyed by the mover object, timed
// on the sim clock (advance() moves it, so the harness draws the frames it wants). Reduced motion:
// the item swaps at once, no tween, no sparks. Each tween frame logs 'carry_up:<kind>' or
// 'carry_down:<kind>:<station type>' into drawLog after its mover, and a burst 'sparks:<cooker>'.
const CARRY_S = 0.2, SPARK_S = 0.5;
const FUEL_HAND = Object.freeze({ charcoal: 'hand_charcoal', wood: 'hand_split' });
const FUEL_OF = Object.freeze({ hand_charcoal: 'charcoal', hand_split: 'wood' });
const FACE_D = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
const carryFx = new WeakMap();   // mover -> { hand, up: { hand, t0 } | null, down: { hand, t0, into } | null }
let sparkFx = [];                // { st, t0 }
function fuelHand(m) {
  const c = m ? m.carrying : null;
  if (!c || !FUEL_HAND[c.kind]) return '';
  return c.kind === 'wood' && !B3 ? 'hand_charcoal' : FUEL_HAND[c.kind];
}
function facedStation(m) {
  const d = FACE_D[m.face];
  if (!d) return null;
  const tx = m.x + d[0], ty = m.y + d[1];
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (owned(st) && st.tiles.some(function (t) { return t.x === tx && t.y === ty && owned(t); })) return st;
  }
  return null;
}
function watchCarry(s) {
  const now = s.clock;
  const movers = [s.player, s.tender, s.pitCard || null];
  for (let i = 0; i < movers.length; i++) {
    const m = movers[i];
    if (!m) continue;
    const h = fuelHand(m);
    const r = carryFx.get(m);
    if (!r) { carryFx.set(m, { hand: h, up: null, down: null }); continue; }
    if (h === r.hand) continue;
    if (s.phase === 'service' && !reduced) {
      const st = facedStation(m);
      if (h && !r.hand) { r.up = { hand: h, t0: now }; r.down = null; }
      else if (!h && r.hand) {
        r.down = { hand: r.hand, t0: now, into: st ? st.type : '' };
        r.up = null;
        if (st && st.type === 'cooker') { if (sparkFx.length >= 6) sparkFx.shift(); sparkFx.push({ st: st.id, t0: now }); }
      }
    }
    r.hand = h;
  }
  sparkFx = sparkFx.filter(function (f) { return s.phase === 'service' && now >= f.t0 && now - f.t0 < SPARK_S; });
}
// The tween now: { k (0 to 1), hand, mode, into } or null.
function carryTween(m, s) {
  const r = m ? carryFx.get(m) : null;
  if (!r || reduced || s.phase !== 'service') return null;
  const now = s.clock;
  const live = function (e) { return e && now >= e.t0 && now - e.t0 < CARRY_S; };
  if (live(r.up) && r.hand === r.up.hand) return { k: (now - r.up.t0) / CARRY_S, hand: r.up.hand, mode: 'up', into: '' };
  if (live(r.down) && !r.hand) return { k: (now - r.down.t0) / CARRY_S, hand: r.down.hand, mode: 'down', into: r.down.into };
  return null;
}
// Sparks and ash over a cooker just loaded: a few embers fly up and fall back, grey flecks drift.
const SPARK_V = Object.freeze([[-14, -46], [-6, -58], [3, -64], [10, -52], [16, -40], [-10, -34], [7, -30]]);
function drawCarrySparks(s) {
  if (!sparkFx.length || reduced || !A3) return;
  const now = s.clock;
  for (let i = 0; i < sparkFx.length; i++) {
    const f = sparkFx[i], st = MAP.station(f.st), ck = s.stations[f.st];
    if (!st || !owned(st)) continue;
    const a = stationArt(st);
    let b;
    try { b = boxRp(a.name, 0, a.X, a.Y, a.flip); } catch (e) { continue; }
    const t = now - f.t0, u = t / SPARK_S;
    const cx = Math.round((b.x0 + b.x1) / 2), cy = Math.round(b.y0 + (b.y1 - b.y0) * 0.55);
    drawLog.push('sparks:' + f.st);
    onWorld(function () {
      for (let j = 0; j < SPARK_V.length; j++) {
        const v = SPARK_V[j], ash = j >= 5;
        const x = Math.round(cx + v[0] * t), y = Math.round(cy + v[1] * t + (ash ? 20 : 90) * t * t);
        const col = ash ? (u < 0.6 ? '#9a9088' : '#6f6a64') : (u < 0.35 ? '#fff1a8' : u < 0.7 ? '#ffb43a' : '#e0561c');
        octx.fillStyle = '#1b1410';
        octx.fillRect(x - 1, y - 1, 4, 4);
        octx.fillStyle = col;
        octx.fillRect(x, y, 2, 2);
      }
      if (ck && ck.fire > 0 && u < 0.5) {   // a quick flare at the mouth
        octx.fillStyle = '#ffd35a';
        octx.fillRect(cx - 3, cy - 2, 6, 3);
        octx.fillStyle = '#f2702a';
        octx.fillRect(cx - 2, cy - 4, 4, 2);
      }
    });
  }
}

function drawMover(kind, m, s) {
  const bx = Math.round(m.px), by = Math.round(m.py);
  const isCust = kind === 'cust';
  const yo = isCust ? hopOffset(m) : 0;
  const body = isCust ? custBody(m) : staffBody(kind, m, s);
  const hand = isCust ? custHand(m) : staffHand(kind, m, s);
  const bh = size(body[0])[1];
  const feet = by + TILE;
  D('shadow', bx + 2, by + 13);
  // v4.9: a bag or a split on its way into the hands or out of them (carryTween).
  const tw = isCust ? null : carryTween(m, s);
  // Facing up, a hand item hides behind the back; the charcoal scoop instead rides over the head
  // (round 1) so picking it up at the pile shows, 1 px clear of the hair (round 2). v4.9: the split too.
  const overHead = (hand === 'hand_charcoal' || hand === 'hand_split') && m.face === 'up';
  const lifting = !!(tw && tw.mode === 'up' && hand === tw.hand);
  const dip = tw && ((tw.mode === 'up' && tw.k < 0.5) || (tw.mode === 'down' && tw.k >= 0.5)) ? 1 : 0;
  const who3 = function () { if (B3) B3.person(isCust ? m.id : null, (!!hand && !overHead) || (!!tw && tw.mode === 'down' && tw.k < 0.5 && m.face !== 'up')); };
  if (hand && m.face === 'up' && !overHead && !lifting) D(hand, bx + 4, by - 1 + yo);
  const sq = (kind === 'player' && squashAt >= 0 && !reduced) ? tAnim - squashAt : -1;
  if (sq >= 0 && sq < FX.SQUASH_S) {
    who3();
    if (sq < FX.SQUASH_S / 2) DS(body[0], bx - 1, feet - 22, 18, 22, body[1], body[2]);
    else DS(body[0], bx + 1, feet - 26, 14, 26, body[1], body[2]);
  } else {
    who3();
    D(body[0], bx, feet - bh + yo + dip, body[1], body[2]);
  }
  if (tw && (lifting || tw.mode === 'down')) { drawCarryTween(tw, m, bx, by, feet, bh); if (lifting) return; }
  if (hand && m.face !== 'up') D(hand, bx + 4, by + 4 + yo);
  if (overHead) D(hand, bx + 4, feet - bh - 9 + yo);
}
// v4.9: where the held item rests (sim px, before the iso shift) and where it comes from or goes to:
// toward the station faced, low (the rack, the pile) or into the fire box (a cooker, where it is
// gone for the last fifth). Facing up the item rides over the head, so it rises from behind the head.
function drawCarryTween(tw, m, bx, by, feet, bh) {
  const d = FACE_D[m.face] || [0, 1];
  const rest = m.face === 'up' ? [bx + 4, feet - bh - 9] : [bx + 4, by + 4];
  const far = m.face === 'up' ? [bx + 4, by - 2] : [bx + 4 + d[0] * 9, by + 4 + d[1] * 5 + (tw.into === 'cooker' ? 0 : 7)];
  const e = tw.k * tw.k * (3 - 2 * tw.k);   // smooth step
  const u = tw.mode === 'up' ? 1 - e : e;    // 0 at the hands, 1 at the station
  const x = Math.round(rest[0] + (far[0] - rest[0]) * u), y = Math.round(rest[1] + (far[1] - rest[1]) * u);
  const kind = FUEL_OF[tw.hand] || 'item';
  drawLog.push(tw.mode === 'up' ? 'carry_up:' + kind : 'carry_down:' + kind + ':' + (tw.into || 'none'));
  if (tw.mode === 'down' && tw.into === 'cooker' && u > 0.8) return;   // gone into the fire box
  D(tw.hand, x, y);
}


function seatOf(c) { return c.seat ? SEAT_BY_ID[c.seat] || hostNow().byId[c.seat] || null : null; }
// v4.5: today's host folding tables and chairs (a booking only), read from the sim once a frame.
let hostCache = null, hostAt = -1;
function hostNow() {
  if (hostCache && hostAt === tAnim) return hostCache;
  const h = sim && typeof sim.hostSeating === 'function' ? sim.hostSeating() : { tables: [], seats: [] };
  const byId = Object.create(null);
  for (let i = 0; i < h.seats.length; i++) byId[h.seats[i].id] = h.seats[i];
  hostCache = { tables: h.tables, seats: h.seats, byId: byId };
  hostAt = tAnim;
  return hostCache;
}
// Every seat a guest can take now: the yard's owned ones and today's host seats.
function seatsNow() {
  const s = sim.state, out = [];
  for (let i = 0; i < MAP.seats.length; i++) if (PitSim.tileOwned(MAP.seats[i], s.gear, s.decor)) out.push(MAP.seats[i]);
  return out.concat(hostNow().seats);
}



// ---------------------------------------------------------------- render: the passes after the sort





// v3.4 playtest: food bubbles drawn half again as big, scaled about the bubble's tail (its bottom
// left, legacy px x, y + 14 for the 14 tall v2 bubble), so each still points at its guest.
const BUBBLE_K = 1.5;
// The warn bubble drawn 2x about its foot (legacy px X, Y, after the iso shift).
function bigWarn(X, Y, fn) {
  const px = X, py = Y;
  octx.save();
  octx.translate(px, py);
  octx.scale(2, 2);
  octx.translate(-px, -py);
  try { fn(); } finally { octx.restore(); }
}
function bigBubble(x, y, fn) {
  const ty = y + 14;
  octx.save();
  octx.translate(x, ty);
  octx.scale(BUBBLE_K, BUBBLE_K);
  octx.translate(-x, -ty);
  try { fn(); } finally { octx.restore(); }
}
// Joel's phone playtest (2026-10-19): the order bubble was counter sized (the 34 by 33 art3 bubble at
// 1.5x) and sat on the counter top. Now it is a small chip (ORDER_BUB, about a third as wide) with the
// plate, or the walk out X, and the patience bar along its foot, its tail on the guest's head (the body
// box drawn this frame, custBoxes), slid sideways or up the least it takes to stay off every counter's
// drawn box. orderBubbles keeps this frame's chips for the harness (world rp).
const ORDER_BUB = Object.freeze({ w: 22, h: 19, tail: 3 });
let orderBubbles = [];
function counterBoxes() {
  const out = [];
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (st.type !== 'table' || !owned(st)) continue;
    const a = stationArt(st);
    out.push(boxRp(a.name, 0, a.X, a.Y, a.flip));
  }
  return out;
}
function smallOrderBubble(c, showMark, s) {
  const head = custBoxes.get(c.id);
  if (!head || !A3) return false;
  const W = ORDER_BUB.w, H = ORDER_BUB.h, hx = Math.round((head.x0 + head.x1) / 2), hy = Math.round(head.y0);
  const counters = counterBoxes();
  // Joel 2026-10-20: a guest in line keeps the chip off the counter, but a seated (or to go) guest's
  // chip sits right on its own head, over the counter if need be, so it never slides off toward the
  // kettle; it only steps aside for another guest's chip.
  const line = c.mode === 'arriving' || c.mode === 'waiting';
  const avoid = (line ? counters : []).concat(orderBubbles.map(function (b) { return b.rect; }));
  let best = null;
  for (let up = 0; up <= 24 && !best; up += 4) {
    for (let k = 0; k <= 64; k += 2) {   // v3.7: 64, a guest seated in front of the counter slides past its end
      for (const dx of k ? [k, -k] : [0]) {
        const r = { x0: hx - W / 2 + dx, x1: hx + W / 2 + dx, y0: hy - ORDER_BUB.tail - H - up, y1: hy - ORDER_BUB.tail - up };
        if (!avoid.some(function (b) { return overlaps(r, b); })) { best = r; break; }
      }
      if (best) break;
    }
  }
  if (!best) return false;
  const r = best;
  const tailX = Math.max(Math.round(r.x0) + 3, Math.min(Math.round(r.x0) + W - 5, hx - 1));
  const lead = Math.abs(tailX + 1 - hx) > 2 || hy - ORDER_BUB.tail - r.y1 > 2;
  const frac = c.patienceMax > 0 ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
  const blink = !showMark && frac <= C.PATIENCE_WARN_FRAC && !reduced && Math.floor(tAnim * 4) % 2 === 1;
  const mid = typeof C.PATIENCE_MID_FRAC === 'number' ? C.PATIENCE_MID_FRAC : 0.5;
  onWorld(function () {
    const x0 = Math.round(r.x0), y0 = Math.round(r.y0);
    octx.fillStyle = '#1b1410';
    octx.fillRect(x0 + 1, y0, W - 2, H); octx.fillRect(x0, y0 + 1, W, H - 2);
    octx.fillStyle = '#ffffff';
    octx.fillRect(x0 + 1, y0 + 1, W - 2, H - 2);
    // The tail from the chip's foot toward the head, kept inside the chip's width.
    const tx = Math.max(x0 + 3, Math.min(x0 + W - 5, hx - 1)), ty = y0 + H;
    octx.fillStyle = '#1b1410';
    octx.fillRect(tx - 1, ty - 1, 4, 1); octx.fillRect(tx, ty, 2, ORDER_BUB.tail);
    octx.fillStyle = '#ffffff';
    octx.fillRect(tx, ty - 1, 2, 1);
    // Joel 2026-10-20: a chip slid off the counter gets a leader from its tail down to its own guest's
    // head (ink with a white edge) and a small arrow head there, so it never reads as the kettle's.
    if (lead) {
      const ax = tx + 1, ay = ty + ORDER_BUB.tail, bx = hx, by = hy - 2;
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
      for (const pass of [0, 1]) {
        octx.fillStyle = pass ? '#1b1410' : '#ffffff';
        for (let i = 0; i <= n; i++) {
          const lx = Math.round(ax + (bx - ax) * i / n), ly = Math.round(ay + (by - ay) * i / n);
          if (pass) octx.fillRect(lx, ly, 1, 1); else octx.fillRect(lx - 1, ly - 1, 3, 3);
        }
      }
      octx.fillStyle = '#ffffff'; octx.fillRect(bx - 3, by - 3, 7, 2); octx.fillRect(bx - 2, by - 1, 5, 2);
      octx.fillStyle = '#1b1410'; octx.fillRect(bx - 2, by - 2, 5, 1); octx.fillRect(bx - 1, by - 1, 3, 1); octx.fillRect(bx, by, 1, 1);
    }
    if (showMark) A3.drawAt(octx, 'mark_x', x0 + W / 2, y0 + 14, 0, false);
    else if (!blink) (A3.drawAtOutlined || A3.drawAt)(octx, 'plate_' + c.want, x0 + W / 2, y0 + 10, 0, false);
    if (!showMark) {
      octx.fillStyle = COLOR.K;
      octx.fillRect(x0 + 2, y0 + H - 4, W - 4, 2);
      octx.fillStyle = frac <= C.PATIENCE_WARN_FRAC ? COLOR.red : (frac <= mid ? COLOR.yellow : COLOR.lawnA);
      const bw = Math.max(frac > 0 ? 1 : 0, Math.round((W - 4) * frac));
      if (bw > 0) octx.fillRect(x0 + 2, y0 + H - 4, bw, 2);
    }
  });
  orderBubbles.push({ id: c.id, mode: c.mode, rect: r, head: head, counters: counters, day: s.day, lead: lead, tip: lead ? { x: hx, y: hy - 2 } : { x: tailX + 1, y: Math.round(r.y1) + ORDER_BUB.tail } });
  return true;
}
// v4.6 (Joel 2026-10-21, "The eating icon blocks the serving table"): no bubble over an eater any
// more. The eater bobs fork to mouth (drawSeated) and a tiny steam puff, 7 by 9 rp, rises off their
// own plate on their own seat or table, drawn before every chip so chips, coins and tips stay on top.
// A puff that would touch a counter or the register is not drawn. eatCues keeps this frame's puffs
// for the harness (world rp).
const EAT_PUFF = Object.freeze({ w: 7, h: 9 });
const eatPlates = new Map();   // guest id -> their plate's art3 anchor this frame (world rp)
let eatCues = [];
function registerBoxes() {
  const out = [];
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (st.type !== 'register' || !owned(st)) continue;
    const a = stationArt(st);
    out.push(boxRp(a.name, 0, a.X, a.Y, a.flip));
  }
  return out;
}
function drawEatPuffs(custs) {
  eatCues = [];
  if (!A3) return;
  const keepOff = counterBoxes().concat(registerBoxes());
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (c.mode !== 'eating' || !(c.eat > 0)) continue;
    const p = eatPlates.get(c.id);
    if (!p) continue;
    const pb = A3.has(p.name) ? boxRp(p.name, 0, p.X, p.Y) : { x0: p.X - 5, x1: p.X + 5, y0: p.Y - 5, y1: p.Y };
    const cx = Math.round((pb.x0 + pb.x1) / 2), top = Math.round(pb.y0);
    const r = { x0: cx - 3, x1: cx - 3 + EAT_PUFF.w, y0: top - EAT_PUFF.h, y1: top };
    const hit = keepOff.some(function (b) { return overlaps(r, b); });
    eatCues.push({ id: c.id, rect: r, plate: pb, drawn: !hit, keepOff: keepOff });
    if (hit) continue;
    // Two wisps that rise and fade, out of step with each other and with the next eater.
    const ph = reduced ? 0.4 : ((tAnim / 1.2) + (c.id % 5) * 0.21) % 1;
    onWorld(function () {
      for (let k = 0; k < 2; k++) {
        const f = (ph + k * 0.5) % 1;
        const wy = r.y1 - 2 - Math.round(f * (EAT_PUFF.h - 3));
        const wx = r.x0 + (k ? 4 : 1) + (f > 0.5 ? (k ? 1 : -1) : 0);
        octx.globalAlpha = reduced ? 0.9 : 1 - f * 0.45;
        octx.fillStyle = '#ffffff';
        octx.fillRect(wx, wy, 2, 2);
        if (f < 0.6) octx.fillRect(wx + (k ? -1 : 1), wy + 2, 1, 1);
      }
      octx.globalAlpha = 1;
    });
  }
}
function drawCues(s, custs) {
  orderBubbles = [];
  drawEatPuffs(custs);
  // Bubbles: order icon or walk out mark, then food bubbles.
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    const inLine = c.mode === 'arriving' || c.mode === 'waiting' || waitsPlate(c);   // v3.7: the chip stays up until the plate arrives
    const until = markX.get(c.id);
    const showMark = until !== undefined && until > tAnim;
    const px = Math.round(c.px), py = Math.round(c.py) + hopOffset(c);
    const seatC = c.mode === 'eating' || c.mode === 'seated' ? seatOf(c) : null;
    octx.save();
    const csh = seatC ? seatShift(seatC) : moverShift(Math.round(c.px), Math.round(c.py));
    octx.translate(csh.dx, csh.dy);
    if ((inLine || showMark) && smallOrderBubble(c, showMark, s)) {
      recOnly('bubble', px + 14, py - 22, 0);
    } else if (inLine || showMark) {
      bigBubble(px + 14, py - 22, function () {
        D('bubble', px + 14, py - 22);
        if (showMark) {
          D('mark_x', px + 18, py - 20);
        } else {
          const frac = c.patienceMax > 0 ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
          const blink = frac <= C.PATIENCE_WARN_FRAC && !reduced && Math.floor(tAnim * 4) % 2 === 1;
          if (!blink) D('icon_' + c.want, px + 18, py - 20);
        }
      });
    }   // v4.6: an eater gets no bubble (drawEatPuffs)
    octx.restore();
  }
  // "!" bubbles over cookers with a piece about to burn ([T 3.4]); one per cooker.
  if (art.has('bubble_warn')) {
    const blink = FX.WARN_BLINK_S > 0 ? FX.WARN_BLINK_S : 0.25;
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (st.type !== 'cooker' || !owned(st) || !cookerWarns(s.stations[st.id])) continue;
      const bp = warnBubblePos(st);
      const a3 = stationArt(st), bx = boxRp(a3.name, 0, a3.X, a3.Y, a3.flip);
      // v3.4 playtest: the burn "!" at twice the size, so it is easy to spot.
      const wz = size('bubble_warn'), wf = reduced ? 0 : Math.floor(tAnim / blink) % 2;
      withShift(rpShift(bx.x0 - 2, bx.y0 - 2, bp.x + wz[0] / 2, bp.y + wz[1]), function () {
        bigWarn(bp.x + wz[0] / 2, bp.y + wz[1], function () { D('bubble_warn', bp.x, bp.y, wf); });
      });
    }
  }
  // Patience bars.
  const mid = typeof C.PATIENCE_MID_FRAC === 'number' ? C.PATIENCE_MID_FRAC : 0.5;
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (c.mode !== 'arriving' && c.mode !== 'waiting' && !waitsPlate(c)) continue;
    if (orderBubbles.some(function (b) { return b.id === c.id; })) continue;
    const px = Math.round(c.px), py = Math.round(c.py) + hopOffset(c);
    const frac = c.patienceMax > 0 ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
    const bx = px + 15, by = py - 26;
    if (bx >= VW || by < 0) continue;
    const bs = moverShift(Math.round(c.px), Math.round(c.py));
    octx.save();
    octx.translate(bs.dx, bs.dy);
    octx.fillStyle = COLOR.K;
    octx.fillRect(bx, by, 14, 3);
    octx.fillStyle = frac <= C.PATIENCE_WARN_FRAC ? COLOR.red : (frac <= mid ? COLOR.yellow : COLOR.lawnA);
    const w = Math.max(frac > 0 ? 1 : 0, Math.round(14 * frac));
    if (w > 0) octx.fillRect(bx, by, w, 3);
    octx.restore();
  }
  // Sweat drops. (Fire gauges draw with their cooker in the y-sorted pass, round 2.)
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (!sweating(c)) continue;
    const px = Math.round(c.px) + 12, py = Math.round(c.py) - 6 + hopOffset(c);
    withShift(moverShift(Math.round(c.px), Math.round(c.py)), function () {
      if (reduced) { D('sweat', px, py, 0); return; }
      const t0 = sweatAt.has(c.id) ? sweatAt.get(c.id) : tAnim;
      const t = Math.max(0, tAnim - t0) % FX.SWEAT_EVERY;
      if (t < FX.SWEAT_SLIDE_S) D('sweat', px, py + Math.round(FX.SWEAT_SLIDE_PX * t / FX.SWEAT_SLIDE_S), 0);
      else if (t < FX.SWEAT_SLIDE_S + FX.SWEAT_SPLASH_S) D('sweat', px, py + FX.SWEAT_SLIDE_PX, 1);
    });
  }
  // zzz over an idle buddy.
  const b = s.buddy;
  if (b && zzzAt >= 0) {
    const zx = Math.round(b.px) + 10, zy = Math.round(b.py) - 14;
    const zs = moverShift(Math.round(b.px), Math.round(b.py));
    octx.save();
    octx.translate(zs.dx, zs.dy);
    if (reduced) {
      D('zzz', zx, zy, 2);
    } else {
      const cycle = FX.ZZZ_FRAME_S * 3;
      const t = Math.max(0, tAnim - zzzAt);
      D('zzz', zx, zy - Math.round(FX.ZZZ_DRIFT_PX * (t % cycle) / cycle), Math.floor(t / FX.ZZZ_FRAME_S) % 3);
    }
    octx.restore();
  }
  // Hearts.
  for (let i = 0; i < hearts.length; i++) {
    const h = hearts[i];
    const age = tAnim - h.at;
    if (age < 0 || age >= FX.HEART_S) continue;
    const hs = ptShift(h.x + 8, h.y);
    if (reduced) { withShift(hs, function () { DS('heart', h.x, h.y, 16, 16, 0); }); continue; }
    const rise = Math.round(FX.HEART_RISE_PX * easeOut(age / FX.HEART_S));
    const fadeFrom = FX.HEART_S - FX.HEART_FADE_S;
    octx.globalAlpha = age > fadeFrom ? Math.max(0, (FX.HEART_S - age) / FX.HEART_FADE_S) : 1;
    withShift(hs, function () { DS('heart', h.x, h.y - rise, 16, 16, age < FX.HEART_FRAME_S ? 0 : 1); });
    octx.globalAlpha = 1;
  }
}

// A floating number's shift: it rides above the feet of whoever earned it (CASH_ABOVE_PX over the
// customer's tile top), clamped so the text stays on the canvas.
// A number's drawn box on screen (canvas units) with its text top left at (x, y) in shift sh.
function numBox(str, x, y, color, coin, sh) {
  const b = B3 && B3.ready && B3.floatBox ? B3.floatBox(str, FLOAT_KIND[color] || 'plain') : null;
  const w = b ? b.w : art.textWidth(str), h = b ? b.h : 7, iw = b ? b.iw : (coin ? 9 : 0);
  return { x0: x - iw + sh.dx - 1, x1: x + w + sh.dx + 1, y0: y + sh.dy - 1, y1: y + h + sh.dy + 1 };
}
function numShift(n) {
  if (!n.sh) n.sh = moverShift(n.x - 4, n.y + CASH_ABOVE_PX);
  return n.sh;
}
function numAlpha(age) {
  if (age < FX.NUMBER_FADE_AT) return 1;
  return Math.max(0, 1 - (age - FX.NUMBER_FADE_AT) / (FX.NUMBER_S - FX.NUMBER_FADE_AT));
}
function numRise(age) {
  return reduced ? 0 : Math.round(FX.NUMBER_RISE_PX * easeOut(age / FX.NUMBER_S));
}

function drawTop(s) {
  // Slice bar over the board.
  const b = s.stations.board;
  if (b && b.slicing && b.slicing.total > 0) {
    const a3 = stationArt(MAP.station('board')), bx = boxRp(a3.name, 0, a3.X, a3.Y, a3.flip);
    const frac = Math.max(0, Math.min(1, b.slicing.t / b.slicing.total));
    onWorld(function () {
      const x = Math.round(a3.X) - 16, y = bx.y0 - 9;
      octx.fillStyle = COLOR.K; octx.fillRect(x, y, 32, 6);
      octx.fillStyle = COLOR.C;
      const w = Math.round(28 * frac);
      if (w > 0) octx.fillRect(x + 2, y + 2, w, 2);
    });
  }
  // Floating numbers, then their coins.
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    const age = tAnim - n.at;
    if (age < 0 || age >= FX.NUMBER_S) continue;
    octx.globalAlpha = numAlpha(age);
    withShift(numShift(n), function () { popText(n.str, n.x, n.y - numRise(age), n.color); });
    octx.globalAlpha = 1;
  }
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    if (!n.coin) continue;
    const age = tAnim - n.at;
    if (age < 0 || age >= FX.NUMBER_S) continue;
    octx.globalAlpha = numAlpha(age);
    // art3.floatNum draws the cash coin with the number; the v2 coin keeps its capture record.
    if (B3 && B3.ready) recOnly('coin', n.x - 9, n.y - numRise(age), reduced ? 0 : Math.floor(tAnim * 8) % 2);
    else withShift(numShift(n), function () { D('coin', n.x - 9, n.y - numRise(age), reduced ? 0 : Math.floor(tAnim * 8) % 2); });
    octx.globalAlpha = 1;
  }
  // Sparkles.
  for (let i = 0; i < sparkles.length; i++) {
    const sp = sparkles[i];
    const age = tAnim - sp.at;
    if (age < 0 || age >= FX.SPARKLE_S) continue;
    withShift(ptShift(sp.x, sp.y), function () { DS('sparkle', sp.x - 3, sp.y - 3, 14, 14, Math.min(2, Math.floor(age / FX.SPARKLE_FRAME_S))); });
  }
  // Tap rings: the full ring, then its four corners. Reduced motion keeps the ring.
  if (s.phase === 'service') {
    for (let i = 0; i < rings.length; i++) {
      const m = rings[i];
      const age = tAnim - m.at;
      if (age < 0 || age >= FX.TAP_RING_S) continue;
      if (B3) {
        ringRp(Math.floor(m.x / TILE), Math.floor(m.y / TILE), m.ok ? TAP_OK : TAP_NO, !(reduced || age < FX.TAP_RING_S * 0.6));
        continue;
      }
      octx.fillStyle = m.ok ? COLOR.yellow : COLOR.O;
      if (reduced || age < FX.TAP_RING_S * 0.6) {
        octx.fillRect(m.x, m.y, 16, 1);
        octx.fillRect(m.x, m.y + 15, 16, 1);
        octx.fillRect(m.x, m.y, 1, 16);
        octx.fillRect(m.x + 15, m.y, 1, 16);
      } else {
        octx.fillRect(m.x, m.y, 1, 1);
        octx.fillRect(m.x + 15, m.y, 1, 1);
        octx.fillRect(m.x, m.y + 15, 1, 1);
        octx.fillRect(m.x + 15, m.y + 15, 1, 1);
      }
    }
  }
  drawArrow();
}

// Where the tutorial arrow draws this frame (K10 placement), or null when it does not draw. Round 2:
// it hides while the center of its 8x12 box falls on the player's drawn 16x24 body (it would sit on
// him; the pulse on #act carries the step then), above or below the station alike. A corner that only
// grazes his feet keeps it, so a step whose station is out of reach always has a pointer.
function arrowBox() {
  if (!art.has('arrow') || !A3) return null;
  const t = tutStep();
  const st = t ? targetStation(t.target) : null;
  if (!st) return null;
  const a = stationArt(st), b = boxRp(a.name, 0, a.X, a.Y, a.flip), d = drawOf(st), sz = size(st.sprite || 'kettle');
  const X = Math.round((b.x0 + b.x1) / 2), Y = b.y0 - 2;
  if (sim.state.phase === 'service') {
    const p = sim.state.player, px = isoX(p.px + 8, p.py + 8) * RS, py = isoY(p.px + 8, p.py + 8) * RS + 4;
    if (Math.abs(X - px) < 12 && Y - 10 > py - 51 && Y - 10 < py) return null;
  }
  return { st: st, x: d.x + Math.floor(sz[0] / 2) - 4, y: d.y - 12, X: X, Y: Y, above: true };
}

// The tutorial arrow over the target station, pointing down at it, last in pass 6 (K10). A tap on it
// is a tap on the station (round 2).
function drawArrow() {
  const a = arrowBox();
  if (!a) return;
  const bob = FX.ARROW_BOB_S > 0 ? FX.ARROW_BOB_S : 0.3;
  drawRp('arrow', reduced ? 0 : Math.floor(tAnim / bob) % 2, a.X, a.Y, a.x, a.y);
}

// The tutorial banner, last before the blit so nothing covers it ([T 2.6], deviation 19).
function drawBanner(b) {
  const st = targetStation(b.target);
  if (st && A3) { const a3 = stationArt(st), bx = boxRp(a3.name, 0, a3.X, a3.Y, a3.flip); bannerBottom = bx.y0 - camOrigin()[1] < cam.vh / 3; }
  const h = b.lines.length > 1 ? 21 : 11;
  const y = bannerBottom ? SH - 2 - h : 2;
  // The art3 font at 2x when every line fits the yard's width; the box grows to the widest line.
  let w3 = 0;
  if (B3 && B3.ready) for (let i = 0; i < b.lines.length; i++) w3 = Math.max(w3, B3.textWidth(b.lines[i], { scale: 2 }));
  if (w3 > 0 && w3 + 7 <= SW - 4) {
    const bw = Math.max(BANNER_W, Math.ceil(w3) + 7);
    octx.fillStyle = COLOR.outline;
    octx.fillRect(2, y, bw, h);
    octx.fillStyle = COLOR.C;
    octx.fillRect(2.5, y + 0.5, bw - 1, h - 1);
    octx.fillStyle = COLOR.K;
    octx.fillRect(3, y + 1, bw - 2, h - 2);
    for (let i = 0; i < b.lines.length; i++) {
      B3.text(octx, b.lines[i], 5, y + 2 + 8 * i, 'C', { scale: 2, shadow: 'outline' });
      recT(b.lines[i], 5, y + 3 + 8 * i);
    }
    return;
  }
  octx.fillStyle = COLOR.C;
  octx.fillRect(2, y, BANNER_W, h);
  octx.fillStyle = COLOR.K;
  octx.fillRect(3, y + 1, BANNER_W - 2, h - 2);
  for (let i = 0; i < b.lines.length; i++) T(b.lines[i], 5, y + 3 + 8 * i);
}

function drawRain() {
  octx.fillStyle = 'rgba(110, 104, 99, 0.55)';
  octx.fillRect(0, 0, SW, 10);
  octx.fillStyle = 'rgba(91, 184, 240, 0.10)';
  octx.fillRect(0, 0, SW, SH);
  if (reduced || !rainDrops) return;
  octx.fillStyle = COLOR.smokeL;
  for (let i = 0; i < rainDrops.length; i++) {
    const y = Math.floor(rainDrops[i].y);
    if (y < 0 || y > SH - 3) continue;
    octx.fillRect(rainDrops[i].x, y, 1, 3);
  }
}

function render() {
  const s = sim.state;
  const inService = s.phase === 'service';
  layoutSync();
  // Joel 2026-10-23: on desktop a new layout or new gear (seats, stations) reframes the action box,
  // except while a piece is being moved in Arrange.
  if (!cam.phone && !arr) {
    const sig = seenLK + '|' + JSON.stringify(s.gear) + '|' + JSON.stringify(s.decor);
    if (sig !== deskSig) { const first = deskSig === null; deskSig = sig; if (!first) { resize(); return; } }
  }
  hits.length = 0;
  // The world, 1 px per rp.
  octx = wctx;
  SW = WORLD.W / RS; SH = WORLD.H / RS;
  const o = camOrigin();
  VIEW.x0 = o[0] / RS; VIEW.w = cam.vw / RS;
  octx.setTransform(RS, 0, 0, RS, 0, 0);
  octx.globalAlpha = 1;
  drawGround(s);                      // 1. sky, ground, barn, back fence, "+" marks
  drawLog = []; lateBadges = [];
  const custs = drawSorted(s);        // 2. the depth pass (the canopy posts among it)
  drawCanopyRoof(s);                  // 2b. the canopy roof over everything under it
  drawOverhead(s);                    // 3. string lights, smoke columns
  drawSmokeAndFire(s);                // 4. dark puffs
  drawCues(s, custs);                 // 5. bubbles, bars, sweat, zzz, hearts
  drawFireCues(s);                    // 5b. the FIRE badge and feed puffs (deviation 75)
  drawTop(s);                         // 6. slice bar, numbers, coins, sparkles, tap rings, arrow
  drawArrange(s);                     // 6b. v3.9: the lifted piece's footprints in arrange mode

  // The overlay over the view, at least 352 rp across (its v3.5 size).
  octx = ovctx;
  SW = ov.width / RS; SH = ov.height / RS;
  VIEW.x0 = 0; VIEW.w = SW;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, ov.width, ov.height);
  octx.setTransform(RS, 0, 0, RS, 0, 0);
  ovRec = true;
  if (inService && s.rain) drawRain(); // 7. rain
  // 8. The tutorial banner in place of the clock and GATE OPENS IN, else canvas text in umber boxes.
  if (inService) {
    const banner = bannerNow();
    if (banner) {
      drawBanner(banner);
    } else {
      // W7.4: the rail on a booking or a Yard day, else the v2 clock box; W7.1 times throughout.
      const cv = compView(s);
      const rail = cv ? null : railNow();
      if (cv) drawCompRail(cv, s);
      else if (rail) drawRail(rail, s);
      else boxText(clockStr(s), 2, 2, null);
      // v3.3 integration: no gate and no last call at the competition, which has no guests.
      if (cv) { /* the turn-in rail says it */ }
      else if (s.clock < tGate(s)) boxText('GATE OPENS IN ' + Math.ceil(tGate(s) - s.clock), 2, SH - 9, 'yellow');
      else if (s.today && s.today.overtime) boxText('GATE CLOSED', 2, SH - 9, 'yellow');   // v3.8 overtime
      else if (lastCallUntil > nowMs) boxText('LAST CALL', 2, SH - 9, 'yellow');
    }
  } else {
    bannerBottom = false;
  }
  ovRec = false;
  octx = wctx;
  SW = WORLD.W / RS; SH = WORLD.H / RS;

  // 9. Blit the camera's view, then the overlay, with the burnt shake.
  const cw = el.cv.width, ch = el.cv.height, z = cam.z;
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.imageSmoothingEnabled = false;
  vctx.fillStyle = SKY;
  vctx.fillRect(0, 0, cw, ch);
  let ox = 0;
  if (!reduced && shakeUntil > nowMs) ox = (Math.floor(nowMs / 16) % 2 === 0 ? 1 : -1) * Math.max(1, Math.round(z));
  const sx0 = Math.max(0, o[0]), sy0 = Math.max(0, o[1]);
  const sx1 = Math.min(WORLD.W, o[0] + cam.vw), sy1 = Math.min(WORLD.H, o[1] + cam.vh);
  if (sx1 > sx0 && sy1 > sy0) {
    vctx.drawImage(off, sx0, sy0, sx1 - sx0, sy1 - sy0, (sx0 - o[0]) * z + ox, (sy0 - o[1]) * z, (sx1 - sx0) * z, (sy1 - sy0) * z);
    // Joel 2026-10-23: a desktop view wider or taller than the world (the zoom that fits the action
    // box) carries the world's edge pixels out to the canvas edge, not sky or a flat green band.
    const ty0 = (sy0 - o[1]) * z, th = (sy1 - sy0) * z;
    if (cam.phone) { if ((WORLD.H - o[1]) * z < ch) { vctx.fillStyle = '#5a9c3c'; vctx.fillRect(0, Math.floor((WORLD.H - o[1]) * z), cw, ch); } }
    else if (sx0 > o[0]) vctx.drawImage(off, sx0, sy0, 1, sy1 - sy0, ox, ty0, Math.ceil((sx0 - o[0]) * z), th);
    if (!cam.phone && sx1 < o[0] + cam.vw) { const x = Math.floor((sx1 - o[0]) * z) + ox; vctx.drawImage(off, sx1 - 1, sy0, 1, sy1 - sy0, x, ty0, cw - x, th); }
    if (!cam.phone && sy1 < o[1] + cam.vh) { const y = Math.floor((sy1 - o[1]) * z); vctx.drawImage(vctx.canvas, 0, y - 1, cw, 1, 0, y, cw, ch - y); }
  }
  vctx.drawImage(ov, 0, 0, ov.width, ov.height, ox, 0, ov.width * cam.kOv, ov.height * cam.kOv);
}

// ---------------------------------------------------------------- canvas

function setupCanvas() {
  A3 = PitSim.art3 || null;
  off = document.createElement('canvas');
  off.width = WORLD.W; off.height = WORLD.H;
  wctx = octx = off.getContext('2d');
  octx.setTransform(RS, 0, 0, RS, 0, 0);
  ov = document.createElement('canvas');
  ovctx = ov.getContext('2d');
  vctx = el.cv.getContext('2d');
  makeZoom();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
}

// v3.6 (spec C): phones (under 900 CSS px, the one column layout) get the near view, k = round(1.5
// dpr) device px per rp, the canvas edge to edge and as tall as the room above the controls; the
// two column layout fits the whole world at the largest whole k. The overlay takes the largest whole
// scale that keeps it at least 352 rp across.
function resize() {
  const vw = document.documentElement.clientWidth || window.innerWidth || 375;
  const vh = window.innerHeight || 0;
  const d = dpr();
  const was = cam.phone;
  cam.phone = vw < 900;
  el.root.classList.toggle('camnear', cam.phone);
  if (cam.phone) {
    cam.nearK = Math.max(1, Math.round(1.5 * d));
    const cssW = (el.wrap && el.wrap.clientWidth) || vw;
    const cssH = Math.max(240, (vh || 812) - 44 - CONTROLS_H);
    const rw = Math.max(64, Math.floor(Math.floor(cssW * d) / cam.nearK));
    let kb = null;
    try { kb = sim ? kitchenBox() : null; } catch (e) { kb = null; }
    const rhMax = kb ? Math.floor(2 * Math.min((kb.y0 + kb.y1) / 2, WORLD.H - (kb.y0 + kb.y1) / 2)) : WORLD.H + 24;
    const rh = Math.max(96, Math.min(WORLD.H + 24, rhMax, Math.floor(Math.floor(cssH * d) / cam.nearK)));
    el.cv.width = rw * cam.nearK;
    el.cv.height = rh * cam.nearK;
    if (cam.mode === 'fit') cam.mode = 'near';
    if (cam.mode === 'far') el.cv.height = Math.max(96, Math.min(el.cv.height, Math.ceil(WORLD.H * farZ(el.cv.width, 1e9) - 1e-6)));
  } else {
    // v3.4 playtest: the yard fills the window left of the side column (which shows only while a
    // panel is open), full height under the header and above the controls. The near view takes the
    // largest whole k that frames the kitchen, and never so small a k that the world leaves a band.
    const side = el.panels.hidden ? 0 : SIDE_W + 16;
    const cssW = Math.max(320, vw - 32 - side);
    const cssH = Math.max(240, (vh || 820) - 44 - CONTROLS_H_DESK - 28);   // 28: #foot under the controls
    // Joel 2026-10-23: the largest whole k that fits the action box (deskFrame: owned stations, the
    // line, owned seats, the whole sign) with DESK_PAD round it, or DESK_PAD_MIN when the full pad
    // would cost a whole step of zoom (1427 by 890: 3x with 4 rp, not 2x with 12).
    const hb = deskFrame() || homeBox();
    const fitK = function (pad) { return hb ? Math.floor(Math.min(cssW * d / (hb.x1 - hb.x0 + 2 * pad), cssH * d / (hb.y1 - hb.y0 + 2 * pad)) + 1e-6) : 1; };
    cam.nearK = Math.max(1, fitK(DESK_PAD) >= fitK(0) ? fitK(DESK_PAD) : (fitK(DESK_PAD_MIN) || fitK(0)));
    el.cv.width = Math.floor(cssW * d);
    el.cv.height = Math.floor(cssH * d);
    if (cam.mode === 'fit') cam.mode = 'near';
  }
  el.cv.style.width = (el.cv.width / d) + 'px';
  el.cv.style.height = (el.cv.height / d) + 'px';
  cam.kOv = Math.max(1, Math.floor(el.cv.width / (cam.phone ? OV_MIN_RW : OV_MIN_RW_DESK)));   // v3.4: desktop caps the overlay so the clock does not shout
  ov.width = Math.ceil(el.cv.width / cam.kOv);
  ov.height = Math.ceil(el.cv.height / cam.kOv);
  camView();
  // A resize keeps a view the player moved; otherwise the home view, framed for the new size.
  // Desktop always reframes the action box (a panel opening or closing, a new size, service).
  if (!cam.homed || was !== cam.phone || !cam.moved || (!cam.phone && cam.mode === 'near')) camHome(); else camClamp();
  syncZoom();
  snapCanvas(d);
  vctx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;
  if (sim) { try { render(); } catch (e) { fail(e); } }
  if (currentPanel === 'creator') { drawCrSign(); drawCreatorScene(); }
  if (currentPanel === 'week') fitWeek();
}

// ---------------------------------------------------------------- DOM per frame

function statusText(s) {
  if (saveOffUntil > nowMs) return 'Saving is off in this browser.';
  if (noticeUntil > nowMs) return U(noticeKey);
  if (blockedUntil > nowMs) return STRINGS.cantGetThere;
  const atComp = s.phase === 'service' && !!compView(s);   // v3.3 integration: no gate or last call at the competition
  if (s.phase === 'service' && !atComp && s.clock < tGate(s) && !tutRunning()) {
    // Q-4: before the gate on a booking that mixes a two slot and a one slot meat, the cook order tip.
    const big = todayKind(s) === 'booking' && s.today ? mixBig(s.today.rail) : '';
    return STRINGS.gateOpensIn + Math.ceil(tGate(s) - s.clock) + (big ? '. ' + U('mixShort', { big: big }) : '');
  }
  if (lastCallUntil > nowMs && !atComp) return STRINGS.lastCall;
  return sim.holding();
}

function updateDom() {
  const s = sim.state;
  if (s.phase !== lastPhase) {
    lastPhase = s.phase;
    el.root.setAttribute('data-phase', s.phase);
    syncPanels();
  }
  const paused = s.paused === true;
  if (paused !== lastPaused) {
    lastPaused = paused;
    if (paused) el.root.setAttribute('data-paused', '1');
    else el.root.removeAttribute('data-paused');
  }
  if (wantHowto() !== lastHow) syncPanels();

  // W17.1: Week {w} in every season loop, Day {n} on the tutorial day.
  const dayT = inSeason(s) && s.season ? U('hudWeek', { w: s.season.week }) : 'Day ' + s.day;
  if (dayT !== lastHud.day) { lastHud.day = dayT; el['hud-day'].textContent = dayT; }
  // Q-1: the header names the pit once the creator has run; YOUR PIT (the game's name) before that.
  const pitT = s.profile ? pitName(s).toUpperCase() : 'YOUR PIT';
  if (pitT !== lastHud.pit) { lastHud.pit = pitT; el.title.textContent = pitT; }
  const cashT = 'Cash ' + s.cash;
  if (cashT !== lastHud.cash) { lastHud.cash = cashT; el['hud-cash'].textContent = cashT; }
  // P-17: in the season the header shows word of mouth as a heart and its number, since stars now mean
  // the hosts' client stars; the tutorial day keeps the v2.1 stars.
  const fansHud = inSeason(s);
  const repT = (fansHud ? '♥ ' : stars(s.rep) + ' ') + s.rep;
  if (repT !== lastHud.rep) {
    lastHud.rep = repT;
    el['hud-rep'].textContent = repT;
    el['hud-rep'].classList.toggle('fans', fansHud);
    el['hud-rep'].setAttribute('aria-label', 'Word of mouth ' + s.rep);
  }

  const st = statusText(s);
  if (st !== lastStatus) {
    lastStatus = st; el.status.textContent = st;
    // v3.4 review: the gate countdown under the desktop canvas repeats the one on the yard (CSS hides it there).
    el.status.classList.toggle('gate', st.indexOf(STRINGS.gateOpensIn) === 0);
  }

  const v = sim.verbAt();
  if (v.label !== lastAct) { lastAct = v.label; el.act.textContent = v.label; }
  const dis = !v.enabled;
  if (dis !== lastActDis) { lastActDis = dis; el.act.disabled = dis; }
  // v3.4 review: no grey "Nothing to do here" bar; the bar keeps its room so the yard never jumps.
  el.act.classList.toggle('idle', dis && v.label === STRINGS.nothing);
  syncPulse(v);

  // W17.6: charcoal first, then the meat chips; during a booking only its rail meats show.
  const bags = s.charcoal | 0;
  if (String(bags) !== lastChips.charcoal && chipEls.charcoal) {
    lastChips.charcoal = String(bags);
    chipEls.charcoal.cnt.textContent = String(bags);
    chipEls.charcoal.b.setAttribute('aria-label', 'Charcoal, ' + bags + ' bags');
  }
  const l = loopOf(s);
  const rail = (l === 'prep' || l === 'cook' || l === 'report') && s.today && s.today.kind === 'booking' ? s.today.rail : null;
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const id = MEAT_IDS[i];
    const n = s.stock[id] | 0;
    const sel = s.selected === id;
    const hide = !!rail && (rail[id] | 0) === 0;
    const sig = n + (sel ? 's' : '') + (hide ? 'h' : '');
    if (sig === chipSig[id]) continue;
    chipSig[id] = sig;
    const ch = chipEls[id];
    ch.cnt.textContent = String(n);
    ch.b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    ch.b.setAttribute('aria-label', MEATS[id].label + ', ' + n + ' in stock');
    ch.b.disabled = n <= 0;
    ch.b.hidden = hide;
  }

  syncMusic(s);
  syncSfx(s);
  flushLive();
}

// ---------------------------------------------------------------- start

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
