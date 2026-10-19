// game.js: input, canvas rendering, DOM panels, aria-live, save hooks, pause, feedback, the dog.
// Contract v3.1: docs/superpowers/specs/2026-10-19-pit-sim-v3-1-contract.md (X1, X4 to X10 reads, X12 calls
//           only, X13, X14, X17, with the X18 Overseer's calls); design [S 6], [S 8], [S 12.3]; mocks
//           docs/superpowers/mocks/pit-sim-v3/screen-2-crew (.png and .html), screen-3-week, screen-4-report.
//
// v3.1 deviations (PitSim.game is X13.8: every W17.7 member, version '0.6.0', crew, hiringPage):
// 43. #card and the crew sheet stand in place of the panel that opened them (panels are exclusive, as
//     the sheets were in v3.0); Back or Escape rebuilds that panel and focuses the opener. While #card
//     is open over #hiring or the crew sheet, the hidden panel is rebuilt after every action, so its
//     ids (#hire-tryouts, #hire-round, #crew-slots) always read the live state.
// 44. A successful hire (card-hire) closes #card: a Hiring Day hire returns to #hiring with focus on the
//     hired card (the round is over and other outfits have picked), a walk-in hire returns to the crew
//     sheet with focus on the new card. Letting a card go returns to the panel under the card sheet.
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
// 47. The application cards and crew cards keep their aria-label to X10 (ui.appAria or ui.appTaken);
//     a card you hired adds ", On your crew", a held card adds its ui.moodAria sentence. The mood face
//     on each card carries data-mood and its own ui.moodAria label.
// 48. #hire-go and #hire-crew wear the mock's blue framed button with the white border (screen-2-crew)
//     over the hub's orange primary; #hire-go keeps the class primary. #hiring-foot (the payroll box
//     and the bottom bar) is sticky at the bottom of the screen on a phone, as the creator's footer is.
// 49. The crew sheet lists each card beside a column of its Bring and Train buttons, its XP meter
//     (xp-{id}, ui.xp) and, while it has levels banked, ui.banked (banked-{id}); the walk-ins sit in
//     the Hiring Day grid's two columns. Train buttons keep ui.train and are disabled once anyone
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
// 57. Hiring Day: the round and the tryouts sit in the UI font in the top row (no tryouts once every
//     round is done); #hire-news shows the last round_done sentence and ui.tryoutTaken lines; a page
//     arrow toward cards just taken carries hire-page-taken; #hire-go shows PASS, and a pass with an
//     empty crew asks once (hire-pass-yes, hire-pass-no); the done bar drops Hires left.
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
//     tip that overlaps another number sits 9 px higher per number, and tips keep 6 px off the fence.
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
//     c. Unowned gear and decor footprints draw a ghost of what will stand there at GHOST_ALPHA
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
//     c. Ghosts of unowned gear and decor draw only in the morning and evening, at GHOST_ALPHA
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
  // v3.1 (X14): Hiring Day and the card sheet.
  'hiring', 'hiring-h', 'hiring-top', 'hiring-body', 'hiring-foot', 'card', 'card-h', 'card-body'
];
const PANEL_IDS = ['clipboard', 'till', 'pause', 'newgame', 'broke', 'week', 'sheet', 'creator', 'season-end', 'hiring', 'card'];
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
const ROLE_FALLBACK = ['run', 'fire', 'prep'];
const ROLE_KIND = { run: 'buddy', fire: 'tender', prep: 'prep' };   // the in-yard sprite prefix of each role (X12.2)
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
const KEY_HELP = [
  ['Arrow keys, W A S D', 'Move one tile a press. Hold a key to keep walking. Walking into a station turns you to face it.'],
  ['Space, E', 'Do what the action button says.'],
  ['1 to 5', 'Pick sausage, chicken, ribs, pork butt or brisket.'],
  ['Q, Shift+Q', 'Next or previous meat.'],
  ['Escape, P', 'Pause and resume.'],
  ['Tap the yard', 'Walk there. Tap a station to walk over and use it.']
];
const BOARD_OFFS = [[1, 3], [8, 3], [1, 9], [8, 9], [4, 6]];   // board stacks, from the board's draw px (R-2: a fifth)
const BOARD_DRAW_MAX = 8;                                  // R-2: plates drawn a stack, whatever C.BOARD_STACK holds
const SPARKLE_OFFS = [[-3, -4], [6, -7], [2, 2]];          // from the served plate spot
const BURST_OFFS = [[-3, 0], [0, -2], [3, 0]];             // from the burnt piece
const FX_LOG_MAX = 500;
const LAWN_FROM_ROW = 6;                                   // fence, hedge and bed tiles sit on lawn from this row down
const OVERFLOW_OK = /^(shadow|hand_|player_|buddy_|tender_|prep_|cust[0-9]_)/;
const GHOST_ALPHA = 0.5;                                   // unowned gear and decor, morning and evening only
const CONTROLS_H = 24 + 48 + 52 + 8;                       // #status, #act, #chips with its margin, slack (D13 3x test)
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
const RING = (function () {
  const n = 12, pts = [];
  for (let x = 6; x < n; x++) pts.push([x, 0]);
  for (let y = 1; y < n; y++) pts.push([n - 1, y]);
  for (let x = n - 2; x >= 0; x--) pts.push([x, n - 1]);
  for (let y = n - 2; y >= 1; y--) pts.push([0, y]);
  for (let x = 0; x < 6; x++) pts.push([x, 0]);
  return pts;
})();

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
let recs = [];
const SIZE = Object.create(null);

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
let sheetFrom = 'week';         // the panel the sheet returns to: 'week' or 'hiring' (X13.1)
let hirePage = 1;               // the Hiring Day page on screen (X13.2)
let hireHelpOpen = false;       // hire-help is showing
let hireMsg = '';               // finishHiring's refusal, in #hire-why
let hireNews = null;            // review 1: the last round_done, shown in #hire-news: { line, idxs, tried }
let hirePassSure = false;       // review 1: the pass confirm is showing (the crew is empty)
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
function hiringData() {
  if (typeof sim.hiringView !== 'function') return null;
  try { return sim.hiringView() || null; } catch (e) { return null; }
}
// X7: "crew loops" (week or hiring, morning) and "week only".
function crewLoops() { const s = sim.state; const l = loopOf(s); return (l === 'week' || l === 'hiring') && s.phase === 'morning'; }
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
  const movers = [['run', s.buddy], ['fire', s.tender], ['prep', s.prep || null]];
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
function warnBubblePos(st) { return { x: st.draw.x - 2, y: st.draw.y - 11 }; }

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
  showLoop();
  pump();
  if (saveOff) noteSaveOff();
  if (migrated) {
    noticeUntil = nowMs + FX.NOTICE_S * 1000;
    announce(U(noticeKey));
    writeSave();
  }
  exposeGame();
  observe();
  rafId = requestAnimationFrame(frame);
}

function readSave() {
  migrated = false;
  let raw = null;
  try { raw = localStorage.getItem(PitSim.SAVE_KEY); } catch (e) { saveOff = true; return null; }
  if (!raw) return null;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { return null; }
  // W13.3, X11.3: any valid save with a raw v from 1 to one under C.SAVE_VERSION shows the notice once
  // (ui.noticeCrew when the migrated crew is not empty, else ui.notice); a current save loads silently.
  const cur = typeof C.SAVE_VERSION === 'number' ? C.SAVE_VERSION : 5;
  const old = !!(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Number.isInteger(parsed.v) && parsed.v >= 1 && parsed.v < cur);
  let valid = null;
  try { valid = PitSim.validateSave(parsed); } catch (e) { valid = null; }
  migrated = old && valid !== null;
  noticeKey = migrated && valid && Array.isArray(valid.crew) && valid.crew.length > 0 && STRINGS.ui.noticeCrew ? 'noticeCrew' : 'notice';
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
    // v3.4: the client x, y of tile (tx, ty)'s centre on the yard canvas, for the harness taps.
    tileToClient: function (tx, ty) {
      const r = el.cv.getBoundingClientRect();
      return { x: r.left + (tx + 0.5) * TILE / VW * r.width, y: r.top + (ty + 0.5) * TILE / VH * r.height };
    },
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
    get rail() { return railNow(); },
    get sign() { return signInfo(); },
    get panel() { return howtoOpen ? 'howto' : currentPanel; },
    // X13.8: the crew movers in the yard with art.crewKey(role), and the Hiring Day page on screen.
    get crew() { return crewNow(); },
    get hiringPage() { return hiringPageNow(); }
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
  return { run: one(s.buddy, 'run'), fire: one(s.tender, 'fire'), prep: one(s.prep || null, 'prep') };
}
function hiringPageNow() {
  if (loopOf(sim.state) !== 'hiring') return null;
  const onHiring = currentPanel === 'hiring' || (currentPanel === 'card' && cardCtx && cardCtx.from === 'hiring') ||
    (currentPanel === 'sheet' && sheetFrom === 'hiring');
  return onHiring ? (hirePage === 2 ? 2 : 1) : null;
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

function setupCanvas() {
  off = document.createElement('canvas');
  off.width = VW * RS; off.height = VH * RS;
  octx = off.getContext('2d');
  octx.setTransform(RS, 0, 0, RS, 0, 0);
  vctx = el.cv.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
}

// D13 (review round 2): the target CSS scale is 3 on desktop when the canvas and the controls
// under it fit, 2 on phones (8 px canvas gutters), the fit width below 368 px; the backing store
// takes floor(target * dpr) device pixels per game pixel and the CSS size follows from that, so
// every game pixel is a whole number of device pixels.
function resize() {
  const vw = document.documentElement.clientWidth || window.innerWidth || 375;
  const vh = window.innerHeight || 0;
  const dpr = window.devicePixelRatio || 1;
  // v3.4 (design 12.3): integer k device px per render px on the 352 by 384 yard, 4 CSS px gutters.
  const RW = VW * RS, RH = VH * RS;
  let target;
  // Phones fit the width; laptops take 2 CSS px per render px when the yard and controls fit the
  // height, else 1 (the yard never grows past the column the panels and controls share).
  target = Math.max(0.25, (vw - 8) / RW);
  if (vw >= 900) target = Math.min(target, vh - 44 - 16 - CONTROLS_H >= RH * 2 ? 2 : 1);
  kpx = Math.max(1, Math.floor(target * dpr + 1e-6));
  const css = kpx / dpr;
  el.cv.width = RW * kpx;
  el.cv.height = RH * kpx;
  el.cv.style.width = (RW * css) + 'px';
  el.cv.style.height = (RH * css) + 'px';
  snapCanvas(dpr);
  vctx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;
  if (sim) { try { render(); } catch (e) { fail(e); } }
  if (currentPanel === 'creator') { drawCrSign(); drawCreatorScene(); }
  if (currentPanel === 'week') fitWeek();
}

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
  if (held.size && !currentPanel && !s.paused && s.phase === 'service') {
    held.forEach(function (d) { sim.move(d); });
  }
  sim.step(dt);
  pump();
  observe();
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

function pump() {
  const evs = sim.drainEvents();
  for (let i = 0; i < evs.length; i++) onEvent(evs[i]);
}

function onEvent(ev) {
  const L = ev.meat && MEATS[ev.meat] ? MEATS[ev.meat].label : '';
  const K = ev.cooker && STRINGS.cooker[ev.cooker] ? STRINGS.cooker[ev.cooker] : '';
  switch (ev.type) {
    case 'yard_open': {
      const s = sim.state;
      const kind = ev.kind || todayKind(s);
      const secs = Math.max(0, Math.ceil(tGate(s) - s.clock));
      if (kind === 'booking' && s.today && s.today.booking) {
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
    case 'seat_taken': break;
    case 'to_go': announce('No free seat. They took it to go.'); break;
    case 'seat_done': onSeatDone(ev); break;
    case 'walk_out': {
      announce('A customer walked out.');
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
      announce('Last call. No more customers today.');
      lastCallUntil = nowMs + 3000;
      break;
    case 'day_over':
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
    // v3.1 (X9): crew cards and Hiring Day.
    case 'hiring_open': announce(SAY('hiringOpen', { n: ev.n | 0 })); break;
    case 'tryout': announce(SAY('tryout', { name: ev.name || '', n: half(ev.potential) })); break;
    case 'crew_hired': announce(SAY('hired', { name: ev.name || '' })); break;
    case 'round_done': {
      // Review 1: the sentence also shows on the Hiring Day screen (#hire-news), with a line for any
      // card you tried out that went elsewhere, and the page arrows count the takes.
      const names = Array.isArray(ev.names) ? ev.names : [];
      const idxs = Array.isArray(ev.taken) ? ev.taken : [];
      if (names.length) {
        const line = SAY('roundDone', { r: ev.round | 0, list: andList(names) });
        announce(line);
        const hv = hiringData();
        const tried = [];
        if (hv && Array.isArray(hv.pool)) for (let i = 0; i < hv.pool.length; i++) if (idxs.indexOf(hv.pool[i].idx) >= 0 && hv.pool[i].tried) tried.push(hv.pool[i].name);
        for (let i = 0; i < tried.length; i++) announce(U('tryoutTaken', { name: tried[i] }));
        hireNews = { line: line, idxs: idxs.slice(), tried: tried };
      } else hireNews = null;
      break;
    }
    case 'hiring_done': announce(SAY('hiringDone')); break;
    case 'crew_let_go': announce(SAY('letGo', { name: ev.name || '' })); break;
    case 'trained': announce(SAY('trained', { name: ev.name || '', xp: ev.xp | 0 })); break;
    case 'level_ready': announce(SAY('levelReady', { name: ev.name || '' })); break;
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
    case 'burn_warning': {
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
    announce(ev.tip > 0
      ? 'Served ' + L + ', ' + ev.price + ' plus ' + ev.tip + ' tip.'
      : 'Served ' + L + ', ' + ev.price + ', no tip.');
  }
  const x = Math.round(Number(ev.x) || 0), y = Math.round(Number(ev.y) || 0);
  // Over the served customer (round 2), falling back to the plate spot.
  const cu = custById(ev.id);
  const cashStr = '+' + ev.price;
  let nx = x, ny = y - 6;
  if (cu) {
    nx = Math.round(cu.px) + 9;     // the coin on the customer's left edge, the text after it
    ny = Math.round(cu.py) - CASH_ABOVE_PX;
  }
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
  const x0 = coin ? x - 9 : x, x1 = x + art.textWidth(str);
  let k = 0;
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    if (tAnim - n.at >= STAGGER_WINDOW_S || Math.abs(n.y - y) >= 8) continue;
    const n0 = n.coin ? n.x - 9 : n.x, n1 = n.x + art.textWidth(n.str);
    if (n0 < x1 && x0 < n1) k++;
  }
  const kk = Math.min(STAGGER_MAX, k);
  const yy = kind === 'tip' || kind === 'seatTip' ? Math.max(1, y - kk * 9) : y;
  nums.push({ kind: kind, str: str, x: x, y: yy, color: color, coin: coin, at: tAnim + kk * STAGGER_S });
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
    localStorage.setItem(PitSim.SAVE_KEY, JSON.stringify(sim.serialize()));
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
  if (name === 'pause') buildPauseBody();
  if (name === 'week' || name === 'sheet' || name === 'creator' || name === 'season-end' || name === 'till' || name === 'hiring' || name === 'card') dropClipboard();
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

function setInert(on) {
  if (!('inert' in HTMLElement.prototype)) return;
  el.stage.inert = on;
  el.hdr.inert = on;
  el.foot.inert = on;
}

function wantHowto() {
  const desktop = !!(mqDesktop && mqDesktop.matches);
  return howtoOpen || (!currentPanel && desktop && sim.state.phase === 'service');
}

function syncPanels() {
  const showHow = wantHowto();
  if (el.howto.hidden !== !showHow) el.howto.hidden = !showHow;
  if (howtoClose && howtoClose.hidden !== !howtoOpen) howtoClose.hidden = !howtoOpen;
  const hidePanels = !currentPanel && !showHow;
  if (el.panels.hidden !== hidePanels) el.panels.hidden = hidePanels;
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
  if (loop === 'hiring') { openHiring(true); return; }   // X8, X13.1
  if (loop === 'seasonEnd') { openSeasonEnd(); return; }
  if (loop === 'week') { if (s.broke) openBroke(); else openWeek(); return; }
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
  else if (currentPanel === 'hiring') rebuildKeepFocus(buildHiring, 'hiring');
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
  cardCtx = null; crewMsg = ''; hireMsg = ''; moneyMore = false; hirePage = 1; hireHelpOpen = false; hireNews = null; hirePassSure = false;
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
  const icon = !withIcon ? null : (item.kind === 'fuel' ? pileIcon() : iconCanvas('icon_' + item.id));
  return mk('span', { cls: 'name' }, [icon, item.label, mk('span', { cls: 'effect', text: item.effect })]);
}
function pileIcon() {
  const c = sprEl('pile', 0, 1, null);
  if (c) { c.style.marginRight = '6px'; c.style.verticalAlign = 'middle'; }
  return c;
}

function lockedBy(item, s) {
  const n = item.needs;
  if (!n) return false;
  if (n.gear && s.gear[n.gear] !== true) return true;
  if (n.decor && s.decor[n.decor] !== true) return true;
  if (typeof n.rep === 'number' && s.rep < n.rep) return true;
  // W22.12: in loop 'week' the buddy has no day gate (deviation 36).
  if (n.day && loopOf(s) !== 'week' && s.day < n.day) return true;
  return false;
}

// Cash a cart line may still spend: the deposit of the picked booking counts in the week (W5.2).
function cartRoom(s) {
  const se = s.season;
  const dep = loopOf(s) === 'week' && se && se.booking ? se.booking.deposit | 0 : 0;
  return s.cash + dep - sim.cartTotal();
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
  const row = mk('div', { cls: 'row' }, [name, price, step]);
  rowSink.push(function () {
    const s = sim.state;
    const q = isMeat ? (s.cart.meat[item.id] | 0) : (s.cart.charcoal | 0);
    const owned = isMeat ? (s.stock[item.id] | 0) : (s.charcoal | 0);
    const locked = lockedBy(item, s);
    const remaining = cartRoom(s);
    const cap = isMeat ? q + owned >= C.STEPPER_MAX || meatRoomNow() <= 0
      : q + owned >= (typeof C.CHARCOAL_MAX === 'number' ? C.CHARCOAL_MAX : C.STEPPER_MAX);
    if (priceNum) {
      priceNum.textContent = locked ? item.needsText : String(item.price);
      if (priceCoin) priceCoin.hidden = locked;
    } else {
      price.textContent = locked ? item.needsText : String(item.price);
    }
    price.classList.toggle('muted', locked || remaining < item.price);
    price.style.whiteSpace = locked ? 'normal' : '';
    qty.textContent = String(q);
    dec.disabled = locked || q <= 0;
    inc.disabled = locked || cap || remaining < item.price;
    if (inc5) inc5.disabled = inc.disabled;
    step.hidden = locked;
    if (have) {
      have.textContent = U('youHave', { n: owned });
      after.textContent = isMeat ? U('afterUnits', { n: owned + q }) : U('afterBags', { n: owned + q });
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
  const row = mk('div', { cls: 'row' }, [name, price]);
  let ctl = null, ctlOwned = null;
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
    const effText = (!isOwned && !locked && canPay && !booked && after < reserve)
      ? item.effect + ' Leaves ' + after + '. A day of meat and charcoal is about ' + reserve + '.'
      : item.effect;
    if (eff && eff.textContent !== effText) eff.textContent = effText;
    price.textContent = (locked && !isOwned) ? item.needsText : String(item.price);
    price.classList.toggle('muted', isOwned || locked || !canPay);
    price.style.whiteSpace = (locked && !isOwned) ? 'normal' : '';
    if (ctl === null || ctlOwned !== isOwned) {
      if (ctl) row.removeChild(ctl);
      if (isOwned) {
        ctl = mk('span', { id: 'buy-' + item.id, cls: 'muted', text: 'Owned' });
      } else {
        ctl = btn('buy-' + item.id, 'Buy', 'primary', function () { sim.buy(item.id, 1); afterAct(); });
        ctl.setAttribute('aria-label', 'Buy ' + item.label);
      }
      ctlOwned = isOwned;
      row.appendChild(ctl);
    }
    if (!isOwned) ctl.disabled = locked || !canPay;
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
  const done = s.season && s.season.results ? s.season.results.length : 0;
  return done >= (C.SEASON_WEEKS || 9) ? U('seeSeason') : U('nextWeek');
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
  if (kind === 'booking') buildBookingReport(t, head, body);
  else if (kind === 'yard') buildYardReport(t, head, body);
  else buildTutorialTill(t, head, body);
}

// W22.24: the header row above the title: week, pit name and cash.
function repTop(t) {
  const s = sim.state;
  const top = mk('div', { id: 'rep-top' });
  // Q-8: the week and the cash in the UI font, as the pit name beside them.
  top.appendChild(uiPut(mk('span', { cls: 'rw' }), U('hudWeek', { w: t.week || (s.season ? s.season.week : 1) }), 2, UI.cream));
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
  const costs = (t.foodCost | 0) + (t.rawWaste | 0) + (t.bags | 0) * C.CHARCOAL_PRICE + (t.spoilCost | 0) + C.DAILY_COSTS;
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
  if ((t.wages | 0) > 0) money.appendChild(repRow(U('rowWages'), t.wageNames && t.wageNames.length ? t.wageNames.join(', ') : '', minus(t.wages | 0)));
  money.appendChild(repRow(U('rowDaily'), 'ice and trash bags', minus(C.DAILY_COSTS)));
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
  money.appendChild(repRow('Served', plural(t.served | 0, 'plate', 'plates'), plus(t.revenue | 0)));
  money.appendChild(repRow(U('rowExtras'), '', plus((t.tips | 0) + (t.seatTips | 0))));
  money.appendChild(takeRow(t, 'Take today', 'sales and tips after wages and daily costs'));
  const gear = t.gearSpent | 0;
  if (gear > 0) money.appendChild(repRow(U('rowGear'), (t.gearBought || []).join(', '), minus(gear)));
  if (crewSpentOf(t) > 0) money.appendChild(crewPaidRow(t));
  if (typeof t.cashStart === 'number') money.appendChild(repRow(U('rowShop'), '', minus(t.cashStart + (t.net | 0) - gear - crewSpentOf(t) - (t.cashAfter | 0))));
  money.appendChild(repRow('Cash', cashDetail, fmt(t.cashAfter)));
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

// The v2.1 till rows (the tutorial day and the Yard day). R-4: the food, charcoal, spoiled, thrown
// out and grate rows are information (the shop took that money before the gate), and Gear bought and
// Paid at the shop sit above Cash, so cash at the start + Take - gear - shop = Cash.
function tutorialRows(box, t, cashDetail) {
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
  box.appendChild(repRow('Daily costs', 'ice and trash bags', minus(C.DAILY_COSTS)));
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
  let nextGear = '';
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'gear' && s.gear[CATALOG[i].id] !== true) { nextGear = CATALOG[i].id; break; }
  const g = sim.goal();
  const cl = typeof sim.canLoadUp === 'function' ? sim.canLoadUp() : { ok: false, reason: '' };
  return [(se.offers || []).map(function (x) { return x.id + (x.needs ? '!' : ''); }).join(','), o ? (o.type === 'yard' ? 'y' : 'b') : '', rl, meats,
    inv ? (inv.over > 0 || (inv.cap === 0 && inv.units > 0)) : '', inv ? inv.wood > 0 : '', nextGear, g ? g.id : '',
    !!s.comingNext, s.day >= C.RAIN_FROM_DAY, cl.ok ? '' : cl.reason, window.innerHeight, document.documentElement.clientWidth,
    rail ? !!mixHint(rail) : '', se.week | 0, !!s.gear.bigtable,   // R-7, R-3, Q-4: the hint line and the finale news lines
    typeof sim.fanThird === 'function' ? sim.fanThird() : 0,     // X13.6: #third-line and the notice lines
    crewList().filter(function (c) { return c.notice; }).map(function (c) { return c.id; }).join('.')].join('|');
}
function fitWeek() {
  const w = el.week;
  if (!w || w.hidden || el.panels.hidden) return;
  const sig = weekSig(sim.state);
  if (sig === weekFitSig) return;
  const a = document.activeElement;
  const id = a && a.id && w.contains(a) ? a.id : null;
  const lim = 2 * (window.innerHeight || 812);
  let lvl = 0;
  if (weekFit !== 0) buildWeekAt(0);
  while (w.scrollHeight > lim && lvl < 4) { lvl++; buildWeekAt(lvl); }
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
  for (let k = 1; k <= 4; k++) el.week.classList.toggle('fit' + k, level >= k);
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
  const tl = mk('p', { id: 'third-line', cls: 'muted t' + third, text: UA('thirdNow', third) });
  tl.hidden = !tl.textContent;
  top.appendChild(tl);

  // The season strip.
  const strip = mk('ol', { id: 'season-strip', attrs: { 'aria-label': U('stripAria', { y: se.year || 1 }) } });
  const n = C.SEASON_WEEKS || 9;
  for (let i = 1; i <= n; i++) strip.appendChild(stripTile(se, i, n));
  body.appendChild(strip);

  // The phone rings: this week's offers.
  const offers = mk('section', { id: 'offers', attrs: { 'aria-labelledby': 'offers-h' } });
  const oh = mk('div', { cls: 'offers-head' });
  oh.appendChild(uiPut(mk('h3', { id: 'offers-h' }), U('thisWeek').toUpperCase(), 3, UI.white, { bold: true, shadow: UI.ink }, U('thisWeek')));
  const list = se.offers || [];
  if (list.length > 1) oh.appendChild(mk('span', { cls: 'pick-one', text: U('pickOne') }));   // R-8
  offers.appendChild(oh);
  const grid = mk('div', { cls: 'offer-grid' });
  const pickedId = se.booking ? se.booking.id : null;
  for (let i = 0; i < list.length; i++) grid.appendChild(offerCard(list[i], pickedId, level, i));
  offers.appendChild(grid);
  body.appendChild(offers);

  // Next event and Load up and go.
  body.appendChild(nextCard(s, se));

  // The 2 by 2 grid of sheets.
  body.appendChild(hubGrid(s, se));

  // Inventory and Pit news.
  body.appendChild(invCard(s));
  body.appendChild(newsCard(s));

  // Event length, Controls, New game.
  foot.appendChild(lengthSection(s));
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
  const big = fitSign(pit, room, [3, 2], UI.signText, { bold: true, shadow: UI.woodX });
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
  const info = mk('div', { cls: 'oinfo' });
  info.appendChild(uiPut(mk('h4', { id: 'offer-' + o.id + '-t', cls: 'olabel' }), o.label, 2, UI.creamL, { shadow: UI.K }));
  if (!isYard && o.host) {
    const parts = (STRINGS.ui.host || 'Host {name}').split('{name}');
    info.appendChild(mk('p', { cls: 'ohost' }, [parts[0], mk('b', { text: o.host }), parts[1] || '']));
  }
  const lines = mk('div', { cls: 'olines' });
  // On one row (W22.25 step 2) the Yard day keeps every W15 line, set as wrapping inline items.
  const pad = row1 ? '' : 'pad';
  lines.appendChild(iconLine(peopleIcon(), isYard ? U('walkIns') : U('guests', { n: o.headcount | 0 })));
  if (isYard) lines.appendChild(iconLine(null, U('yourPick'), pad));
  else for (let i = 0; i < o.menu.length; i++) lines.appendChild(iconLine(sprEl('icon_' + o.menu[i], 0, 2, null), MEATS[o.menu[i]].plateLabel));
  lines.appendChild(iconLine(pinIcon(), (STRINGS.venue && STRINGS.venue[o.venue]) || 'Backyard'));
  const fl = mk('p', { cls: 'oline flames' });
  const fx = mk('span', { cls: 'ficons', attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < 3; i++) { const f = flameEl(i < (o.difficulty | 0), row1 ? 1 : 2); if (f) fx.appendChild(f); }
  fl.appendChild(fx);
  fl.appendChild(mk('span', { cls: 'fw d' + (o.difficulty | 0), text: STRINGS.flames ? STRINGS.flames[(o.difficulty | 0) - 1] || '' : '' }));
  lines.appendChild(fl);
  if (isYard) {
    lines.appendChild(iconLine(null, U('perPlate'), pad + ' gold'));
    lines.appendChild(iconLine(null, U('noFee'), pad));
  } else {
    lines.appendChild(payInto(mk('p', { cls: 'oline opay' }), o.pay | 0));
    lines.appendChild(iconLine(null, U('deposit', { d: o.deposit | 0 }), 'dep'));
  }
  info.appendChild(lines);
  const needs = mk('p', { id: 'offer-' + o.id + '-needs', cls: 'needs', text: o.needs || '' });
  needs.hidden = !o.needs;
  info.appendChild(needs);
  // R-3: the finale sized to the grate says what the drum smoker would make of it.
  if (o.type === 'finale' && sim.state.gear.drum !== true) {
    const big = drumFinale(sim.state);
    if (big && big.headcount > (o.headcount | 0)) info.appendChild(mk('p', { id: 'offer-finale-drum', cls: 'ohint', text: U('finaleDrum', { n: big.headcount, fee: big.pay }) }));
  }
  card.appendChild(info);
  card.appendChild(bookButton(o, picked, row1));
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
  if ((se.week | 0) > (C.SEASON_WEEKS || 9) - 1) return null;
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
    list = PitSim.genOffers({ seed: se.seed, year: se.year, week: C.SEASON_WEEKS || 9, rep: s.rep, cash: se.weekCash, gear: gear,
      length: s.settings && s.settings.length ? s.settings.length : 'normal' });
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
  b.addEventListener('click', function () { sim.bookOffer(o.id); afterAct(); });
  return b;
}

function nextCard(s, se) {
  const o = se.booking;
  const sec = mk('section', { id: 'next-event', cls: 'next-card', attrs: { 'aria-labelledby': 'next-h' } });
  const head = mk('div', { cls: 'next-head' });
  head.appendChild(uiPut(mk('h3', { id: 'next-h' }), U('nextEvent').toUpperCase(), 2, UI.gold, { bold: true, shadow: '#000000' }, U('nextEvent')));
  if (o) {
    const right = mk('span', { cls: 'next-pay' });
    if (o.type === 'yard') right.textContent = U('perPlate');
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
      txt.appendChild(iconLine(peopleIcon(), U('guests', { n: o.headcount | 0 })));
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
  const dep = o && o.type !== 'yard' ? U('depositLine', { d: o.deposit | 0 }) : U('yardLine');
  sec.appendChild(mk('p', { id: 'go-deposit', text: dep }));
  // Review 1: who comes along and what they cost, next to the pay (wages come off the take).
  const lineup = crewList().filter(function (c) { return c.bring; }).sort(byId);
  const wages = payrollNow().now | 0;
  sec.appendChild(mk('p', { id: 'next-crew', cls: 'ncrew', text: lineup.length
    ? U('crewNext', { names: andList(lineup.map(function (c) { return c.name; })), w: wages })
    : U('crewNone') }));
  const cl = typeof sim.canLoadUp === 'function' ? sim.canLoadUp() : { ok: false, reason: '' };
  const go = mk('button', { id: 'go', cls: 'primary big go', type: 'button' });
  const fl = flameEl(true, 2);
  if (fl) go.appendChild(fl);
  uiPut(go, U('loadUp').toUpperCase(), 2, UI.white, { bold: true, shadow: '#8a3a14' }, U('loadUp'));
  go.disabled = !cl.ok;
  go.addEventListener('click', onGo);
  sec.appendChild(go);
  sec.appendChild(mk('p', { id: 'go-why', cls: 'muted', text: cl.ok ? '' : String(cl.reason || '') }));
  return sec;
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
  let ownedN = 0, next = null;
  for (let i = 0; i < CATALOG.length; i++) {
    const it = CATALOG[i];
    if (it.kind !== 'gear') continue;
    if (s.gear[it.id] === true) ownedN++;
    else if (!next) next = it;
  }
  // P-14: the window shows the cooker you own (the drum once bought, else the kettles), as the mock
  // does; the next item to buy stays in the second line.
  const gearPics = s.gear.drum ? ['drum'] : (s.gear.kettle2 ? ['kettle', 'kettle'] : ['kettle']);
  g.appendChild(hubTile('card-gear', 't-gear', U('gear'), tileWin(gearPics, gearPics.map(function () { return 2; })),
    U('gearLine', { n: ownedN }), next ? U('gearNext', { label: next.label, price: next.price }) : U('gearAll')));
  // Menu.
  const o = se.booking;
  let l1, l2 = '', plates = [];
  if (!o || o.type === 'yard') {
    l1 = U('menuYard');
    for (let i = 0; i < MEAT_IDS.length; i++) if (MEAT_IDS[i] !== 'brisket' || s.gear.drum) plates.push('plate_' + MEAT_IDS[i]);
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
    let nextGear = null;
    for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'gear' && s.gear[CATALOG[i].id] !== true) { nextGear = CATALOG[i].id; break; }
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
  if (se && se.week >= 5 && se.week < (C.SEASON_WEEKS || 9) && s.gear.drum !== true) {
    const big = drumFinale(s);
    if (big) { nb.appendChild(mk('p', { id: 'news-finale', text: U('finaleNews', { n: big.headcount }) })); shown++; }
  }
  // Q-4: from week 5, the finale's line and the bigger table while it is not owned.
  if (se && se.week >= 5 && se.week < (C.SEASON_WEEKS || 9) && s.gear.bigtable !== true) {
    const fin = finaleWith(s, null);
    if (fin) { nb.appendChild(mk('p', { id: 'news-table', text: U('finaleTable', { n: fin.headcount }) })); shown++; }
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

function lengthSection(s) {
  const cur = s.settings && s.settings.length ? s.settings.length : 'normal';
  const sec = mk('section', { id: 'len', cls: 'len', attrs: { 'aria-labelledby': 'len-h' } });
  const lh = mk('div', { cls: 'len-head' });
  lh.appendChild(mk('h3', { id: 'len-h', text: U('lengthH') }));
  sec.appendChild(lh);
  const row = mk('div', { cls: 'lenrow', attrs: { role: 'group', 'aria-labelledby': 'len-h' } });
  const order = C.LENGTH_ORDER || ['short', 'normal', 'long'];
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const b = btn('len-' + id, STRINGS.lengthLabel ? STRINGS.lengthLabel[id] : id, 'alt', function () { sim.setLength(id); afterAct(); });
    b.setAttribute('aria-pressed', id === cur ? 'true' : 'false');
    row.appendChild(b);
  }
  sec.appendChild(row);
  const L = C.LENGTHS && C.LENGTHS[cur] ? C.LENGTHS[cur].seconds : C.DAY_SECONDS;
  lh.appendChild(mk('p', { id: 'len-help', cls: 'muted', text: U('lengthHelp', { s: L }) }));
  return sec;
}

// ---------------------------------------------------------------- sheets (W17.3)

function openSheet(kind, openerId, from) {
  sheetKind = kind;
  sheetOpener = openerId || null;
  sheetFrom = from === 'hiring' ? 'hiring' : 'week';
  sheetMsg = '';
  shopOther = false;
  crewMsg = '';
  cardCtx = null;
  buildSheet();
  openPanel('sheet');
}

// Back from a sheet: to the week hub, or to Hiring Day for the crew sheet opened there (X13.1).
function closeSheet() {
  const opener = sheetOpener;
  const from = sheetFrom;
  dropSheet();
  if (from === 'hiring' && loopOf(sim.state) === 'hiring') {
    openHiring(false);
  } else {
    openWeek();
  }
  const f = opener ? document.getElementById(opener) : null;
  if (f && typeof f.focus === 'function') f.focus();
}

function dropSheet() {
  sheetKind = null;
  sheetOpener = null;
  sheetRows = [];
  sheetMsg = '';
  if (el['sheet-body']) clear(el['sheet-body']);
  if (el['sheet-h']) clear(el['sheet-h']);
}

function buildSheet() {
  const s = sim.state;
  const se = s.season || {};
  const titles = { shop: U('shop'), gear: U('gear'), menu: U('menu'), crew: U('crew') };
  const title = titles[sheetKind] || '';
  const h = el['sheet-h'];
  clear(h);
  uiPut(h, title.toUpperCase(), 3, UI.white, { bold: true, shadow: UI.ink }, title);
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
    const rail = ob && ob.type !== 'yard' && typeof sim.railFor === 'function' ? sim.railFor(ob, se.addon || null) : null;
    const meats = CATALOG.filter(function (r) { return r.kind === 'meat'; });
    const onRail = rail ? meats.filter(function (r) { return (rail[r.id] | 0) > 0; }) : meats;
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
    const fuel = CATALOG.filter(function (r) { return r.kind === 'fuel'; });
    if (!(fuel.length === 1 && fuel[0].label === 'Charcoal')) card.appendChild(h3('Charcoal'));
    for (let i = 0; i < fuel.length; i++) card.appendChild(cartRow(fuel[i], true));
    card.appendChild(mk('p', { id: 'shop-room', cls: 'muted' }));
    card.appendChild(mk('p', { id: 'shop-spare', cls: 'muted' }));
    card.appendChild(mk('p', { id: 'cart' }));
    card.appendChild(mk('p', { cls: 'muted', text: 'Game numbers. Not real prices and not a cooking guide.' }));
  } else if (sheetKind === 'gear') {
    card.appendChild(h3('Gear'));
    for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'gear') card.appendChild(ownRow(CATALOG[i]));
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
        if (o.menu.indexOf(m) !== -1 || (m === 'brisket' && s.gear.drum !== true)) continue;
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
    if (week) {
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
    const line = tid === null ? U('trainLine', { xp: C.TRAIN_XP || 40 }) : (who ? U('trainedLine', { name: who }) : U('trainDone'));
    body.appendChild(mk('p', { id: 'crew-train-line', cls: 'muted', text: line }));
  }
  body.appendChild(mk('p', { id: 'crew-why', cls: 'muted', text: crewMsg }));
  if (!week) return;
  const wk = s.season && Array.isArray(s.season.walkins) ? s.season.walkins : [];
  const sec = mk('section', { cls: 'walkins', attrs: { 'aria-labelledby': 'walkins-h' } });
  sec.appendChild(mk('h3', { id: 'walkins-h', text: U('walkinsH') }));
  // Review 1: no walk-ins the week of Hiring Day (sim.js genWalkins), so week 1 says when they come.
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
function onTrain(id) {
  if (typeof sim.train !== 'function') return;
  const r = sim.train(id);
  crewMsg = r && r.ok === false && r.message ? String(r.message) : '';
  afterAct();
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

// d: { role, name, look, stars, potential (number or null), mood, wage, rookie, status, aria }.
function crewCardEl(id, d, onClick) {
  const role = roleOf(d.role);
  const st = d.status === 'taken' || d.status === 'mine' ? d.status : '';
  const b = mk('button', { id: id, cls: 'crewcard r-' + role + (st ? ' ' + st : ''), type: 'button', attrs: { 'aria-label': d.aria || d.name } });
  if (st === 'taken') b.setAttribute('aria-disabled', 'true');
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
  if (st) win.appendChild(mk('span', { cls: 'cc-band', text: U(st === 'taken' ? 'taken' : 'yours') }));
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

// ---------------------------------------------------------------- Hiring Day (X13.2)

function openHiring(fresh, focusId) {
  dropSheet();
  if (fresh) { hirePage = 1; hireHelpOpen = false; hireMsg = ''; hireNews = null; hirePassSure = false; }
  cardCtx = null;
  buildHiring();
  openPanel('hiring', focusId);
  if (focusId && document.activeElement !== document.getElementById(focusId)) el['hiring-h'].focus();
}

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

function buildHiring() {
  const s = sim.state;
  const hv = hiringData();
  const top = el['hiring-top'], body = el['hiring-body'], foot = el['hiring-foot'];
  clear(top); clear(body); clear(foot);
  const h = el['hiring-h'];
  clear(h);
  const ls = mk('span', { cls: 'hstars', attrs: { 'aria-hidden': 'true' } }), rs = mk('span', { cls: 'hstars', attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < 3; i++) { ls.appendChild(miniStar(i)); rs.appendChild(miniStar(2 - i)); }
  h.appendChild(ls);
  uiPut(h, U('hiringH').toUpperCase(), 3, '#ffffff', { bold: true, shadow: '#10215E' }, U('hiringH'));
  h.appendChild(rs);

  // The top row: cash, the round and the tryouts in the UI font (review 1: folded in from the old
  // status line, so the grid starts higher), and the info box.
  const round = hv ? hv.round | 0 : 4;
  const tries = hv ? hv.tryouts | 0 : 0;
  const cash = mk('div', { id: 'hire-cash', cls: 'pill mockpill' }, [mk('span', { cls: 'sr', text: U('cash') + ' ' }), coinEl(2),
    uiPut(mk('span', { cls: 'pv' }), fmt(s.cash), 2, '#ffffff', { bold: true, shadow: '#10215E' })]);
  const info = mk('button', { id: 'hire-info', cls: 'alt mockbtn hinfo', type: 'button', attrs: { 'aria-label': U('hireInfo'),
    'aria-expanded': hireHelpOpen ? 'true' : 'false', 'aria-controls': 'hire-help' } });
  info.appendChild(pixCanvas(PIX.info.map, PIX.info.pal, 2));
  info.addEventListener('click', function () {
    hireHelpOpen = !hireHelpOpen;
    const hp = document.getElementById('hire-help');
    if (hp) hp.hidden = !hireHelpOpen;
    info.setAttribute('aria-expanded', hireHelpOpen ? 'true' : 'false');
  });
  const stat = mk('div', { cls: 'hire-stat' });
  const rw = round <= 3 ? U('hireRound', { r: round }) : U('hireRoundsDone');
  stat.appendChild(pixLines(mk('span', { id: 'hire-round', cls: 'hst' }), rw, round <= 3 ? 16 : 12, 2, '#ffffff', { shadow: '#10215E' }, rw));
  if (round <= 3) {   // review 1: no tryouts line once every round is done
    const tw = U('tryoutsLeft', { n: tries });
    stat.appendChild(pixLines(mk('span', { id: 'hire-tryouts', cls: 'hst' }), tw, 16, 2, '#CFDEFF', { shadow: '#10215E' }, tw));
  }
  top.appendChild(mk('div', { cls: 'hire-toprow' }, [cash, stat, info]));
  const help = mk('p', { id: 'hire-help', cls: 'hhelp', text: U('hireHelp') });
  help.hidden = !hireHelpOpen;
  top.appendChild(help);

  // The page line, then nine cards a page. Review 1: an arrow toward a page where other outfits just
  // took cards carries a "2 taken" chip.
  const pool = hv && Array.isArray(hv.pool) ? hv.pool : [];
  const per = C.POOL_PAGE || 9;
  const pages = Math.max(1, Math.ceil(pool.length / per));
  hirePage = Math.max(1, Math.min(pages, hirePage));
  const takenOn = function (pg) {
    if (!hireNews) return 0;
    let n = 0;
    for (let i = 0; i < hireNews.idxs.length; i++) if (Math.floor(hireNews.idxs[i] / per) + 1 === pg) n++;
    return n;
  };
  const pg = mk('p', { id: 'hire-page' });
  const arrow = function (id, d, label) {
    const target = hirePage + d;
    const n = target >= 1 && target <= pages ? takenOn(target) : 0;
    const b = mk('button', { id: id, cls: 'pgarrow', type: 'button', attrs: { 'aria-label': label + (n ? '. ' + U('takenPageAria', { n: n, p: target }) : '') } });
    b.appendChild(pixCanvas(d < 0 ? PIX.arrowL.map : PIX.arrowR.map, d < 0 ? PIX.arrowL.pal : PIX.arrowR.pal, 2));
    b.disabled = target < 1 || target > pages;
    b.addEventListener('click', function () { turnPage(d); });
    return { b: b, n: n };
  };
  const prev = arrow('hire-page-prev', -1, U('pagePrev'));
  const next = arrow('hire-page-next', 1, U('pageNext'));
  const chip = function (n) {
    const w = U('takenBadge', { n: n });
    return uiPut(mk('span', { id: 'hire-page-taken', cls: 'tchip', attrs: { 'aria-hidden': 'true' } }), w.toUpperCase(), 2, '#FFD23F', { shadow: '#0B1640' }, w);
  };
  if (prev.n) pg.appendChild(chip(prev.n));
  pg.appendChild(prev.b);
  const pw = U('pageOf', { p: hirePage, n: pages });
  pg.appendChild(uiPut(mk('span', { cls: 'pgl' }), pw.toUpperCase(), 2, '#CFDEFF', { shadow: '#1E4CC4' }, pw));
  pg.appendChild(next.b);
  if (next.n) pg.appendChild(chip(next.n));
  body.appendChild(pg);
  const grid = mk('ol', { id: 'hire-grid', attrs: { 'aria-label': pw } });
  for (let k = (hirePage - 1) * per; k < Math.min(pool.length, hirePage * per); k++) grid.appendChild(mk('li', null, [appCard(pool[k])]));
  body.appendChild(grid);

  // The payroll box, then the last round's news and any refusal or confirm (review 1: above the bar,
  // next to the button they explain), then the bottom bar: Crew, Hires left, the arrow.
  foot.appendChild(payrollMeter('hire-payroll'));
  const news = mk('div', { id: 'hire-news', cls: 'hnews' });
  if (hireNews) {
    news.appendChild(mk('p', { text: hireNews.line }));
    for (let i = 0; i < hireNews.tried.length; i++) news.appendChild(mk('p', { cls: 'gold', text: U('tryoutTaken', { name: hireNews.tried[i] }) }));
  }
  news.hidden = !news.firstChild;
  foot.appendChild(news);
  if (hirePassSure && round <= 3) {
    foot.appendChild(mk('p', { id: 'hire-why', cls: 'muted', text: U('passEmpty', { r: round }) }));
    foot.appendChild(mk('div', { cls: 'hsure' }, [
      pixBtn('hire-pass-yes', U('yes'), 'primary', function () { hirePassSure = false; doPassRound(); }),
      pixBtn('hire-pass-no', U('no'), 'alt', function () {
        hirePassSure = false;
        buildHiring();
        focusOr('hire-go', el['hiring-h']);
      })
    ]));
  } else {
    foot.appendChild(mk('p', { id: 'hire-why', cls: 'muted', text: hireMsg }));
  }
  const done = round > 3;
  const bar = mk('div', { cls: 'hire-bar' + (done ? ' done' : '') });
  const crewB = mk('button', { id: 'hire-crew', cls: 'alt mockbtn hcrew', type: 'button' });
  crewB.appendChild(pixCanvas(PIX.crew2.map, PIX.crew2.pal, 2));
  uiPut(crewB, U('crewBtn').toUpperCase(), 2, '#ffffff', { bold: true, shadow: '#10215E' }, U('crewBtn'));
  crewB.addEventListener('click', function () { openSheet('crew', 'hire-crew', 'hiring'); });
  bar.appendChild(crewB);
  if (!done) {   // review 1: no Hires left box once the picks are spent; Start week 1 takes its room
    const left = mk('div', { id: 'hires-left' });
    // A canvas a word, so a narrow bar wraps HIRES over LEFT instead of running past the screen.
    const hl = mk('span', { cls: 'hl-l' });
    const hw = U('hiresLeft').split(' ');
    for (let i = 0; i < hw.length; i++) {
      const c = uiCanvas(hw[i].toUpperCase(), 2, '#ffffff', { shadow: '#10215E' });
      if (c) hl.appendChild(c);
    }
    if (hl.firstChild) hl.appendChild(mk('span', { cls: 'sr', text: U('hiresLeft') }));
    else hl.textContent = U('hiresLeft');
    left.appendChild(hl);
    left.appendChild(uiPut(mk('span', { id: 'hires-left-n', cls: 'hl-n' }), String(hv ? hv.picksLeft | 0 : 0), 2, '#ffffff', null));
    bar.appendChild(left);
  }
  const go = mk('button', { id: 'hire-go', cls: 'primary mockbtn hgo' + (done ? ' done' : ''), type: 'button' });
  go.appendChild(pixCanvas(PIX.arrowBig.map, PIX.arrowBig.pal, 2));
  // Review 1: the arrow says what it does, PASS while rounds are open (its label names the round),
  // START WEEK 1 once they are done.
  if (!done) {
    go.setAttribute('aria-label', U('passRound', { r: round }));
    const pc = uiCanvas(U('pass').toUpperCase(), 2, '#ffffff', { bold: true, shadow: '#10215E' });
    if (pc) go.appendChild(pc); else go.appendChild(mk('span', { cls: 'utf', text: U('pass') }));
  } else uiPut(go, U('startWeek').toUpperCase(), 2, '#ffffff', { bold: true, shadow: '#10215E' }, U('startWeek'));
  go.addEventListener('click', onHireGo);
  bar.appendChild(go);
  foot.appendChild(bar);
}

// An application card (X13.2): taken cards are greyed and aria-disabled but still open read only.
function appCard(e) {
  const idx = e.idx;
  const role = roleOf(e.role);
  const aria = e.status === 'taken' ? U('appTaken', { name: e.name })
    : U('appAria', { name: e.name, role: roleName(role), stars: starsText(e.stars), w: e.wage | 0 }) + (e.status === 'mine' ? ', ' + U('yours') : '');
  return crewCardEl('app-' + idx, {
    role: role, name: e.name, look: e.look, stars: e.stars, potential: typeof e.potential === 'number' ? e.potential : null,
    mood: e.mood, wage: e.wage | 0, rookie: false, status: e.status === 'open' ? '' : e.status, aria: aria
  }, function () { openCard({ mode: 'applicant', key: idx, from: 'hiring', opener: 'app-' + idx }); });
}

function turnPage(d) {
  const id = d < 0 ? 'hire-page-prev' : 'hire-page-next';
  hirePage += d;
  buildHiring();
  let f = document.getElementById(id);
  if (!f || f.disabled) f = document.getElementById(d < 0 ? 'hire-page-next' : 'hire-page-prev');
  if (f && !f.disabled) f.focus(); else el['hiring-h'].focus();
}

// The arrow: passes the round while picks are open, then starts week 1 (X13.2). Review 1: with
// nobody on the crew a pass asks once first (ui.passEmpty, Yes and No above the bar).
function onHireGo() {
  const hv = hiringData();
  if (hv && hv.round <= 3) {
    if (crewList().length === 0 && !hirePassSure) {
      hirePassSure = true;
      buildHiring();
      focusOr('hire-pass-yes', el['hiring-h']);
      announce(U('passEmpty', { r: hv.round | 0 }));
      return;
    }
    hirePassSure = false;
    doPassRound();
    return;
  }
  const r = typeof sim.finishHiring === 'function' ? sim.finishHiring() : null;
  pump();
  if (r && r.ok) {
    hireMsg = '';
    hireNews = null;
    showLoop();
    pump();
    updateDom();
    return;
  }
  hireMsg = r && r.message ? String(r.message) : '';
  rebuildKeepFocus(buildHiring, 'hiring');
  updateDom();
}

function doPassRound() {
  const r = typeof sim.passRound === 'function' ? sim.passRound() : null;
  hireMsg = r && r.ok === false && r.message ? String(r.message) : '';
  afterAct();
  if (currentPanel === 'hiring') focusOr('hire-go', el['hiring-h']);
}

// ---------------------------------------------------------------- the card sheet (X13.3)

// ctx: { mode: 'applicant' | 'walkin' | 'crew' | 'level', key, from: 'hiring' | 'sheet' | 'till', opener }.
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
  if (from === 'hiring' && l === 'hiring') {
    buildHiring();
    openPanel('hiring');
  } else if (from === 'sheet' && sheetKind) {
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
  if (c.from === 'hiring' && loopOf(sim.state) === 'hiring') buildHiring();
  else if (c.from === 'sheet' && sheetKind) buildSheet();
}

// The card's numbers by mode, or null when it is gone (a taken pool slot still reads).
function cardData(c) {
  if (!c) return null;
  if (c.mode === 'applicant') {
    const hv = hiringData();
    const e = hv && Array.isArray(hv.pool) ? hv.pool[c.key] : null;
    if (!e) return null;
    return { name: e.name, role: roleOf(e.role), look: e.look, skills: e.skills || [1, 1], stars: e.stars, wage: e.wage | 0,
      potential: typeof e.potential === 'number' ? e.potential : null, mood: e.mood | 0, rookie: false, contract: 2,
      status: e.status, tried: e.tried === true, round: hv.round | 0, tryouts: hv.tryouts | 0 };
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
    raised: v.raised === true, worked: v.worked | 0 };
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
  if (d.status === 'taken' || d.status === 'mine') pw.appendChild(mk('span', { cls: 'cc-band ' + d.status, text: U(d.status === 'taken' ? 'taken' : 'yours') }));
  body.appendChild(pw);

  const info = mk('div', { cls: 'card3 cp-info' });
  const rl = mk('div', { id: 'card-role', cls: 'cp-role' });
  rl.appendChild(mk('p', { cls: 'cp-rl' }, [roleBadge(role, ''), mk('span', { cls: 'cp-rn', text: roleName(role) })]));
  rl.appendChild(mk('p', { cls: 'muted', text: roleJob(role) }));
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
  if (c.mode === 'applicant') cardApplicantActs(act, d);
  else if (c.mode === 'walkin') cardWalkinActs(act, d);
  else if (c.mode === 'crew') cardCrewActs(act, d);
  else if (c.mode === 'level') cardLevelActs(act, d);
  body.appendChild(act);
}

function cardApplicantActs(act, d) {
  const c = cardCtx;
  if (!d.tried && d.status === 'open') {
    const tb = pixBtn('card-tryout', d.tryouts > 0 ? U('tryout') : U('tryoutNone'), 'alt', function () {
      const r = sim.tryout(c.key);
      c.msg = r && r.ok === false && r.message ? String(r.message) : '';
      afterAct();
      focusOr('card-hire', el['card-h']);
    });
    tb.disabled = d.tryouts <= 0;
    act.appendChild(tb);
  }
  const hire = pixBtn('card-hire', U('hire'), 'primary', function () {
    const k = c.key;
    const r = sim.hireApplicant(k);
    pump();
    if (r && r.ok) {
      cardCtx = null;
      buildHiring();
      openPanel('hiring');
      focusOr('app-' + k, el['hiring-h']);
      updateDom();
      return;
    }
    c.msg = r && r.message ? String(r.message) : '';
    afterAct();
  });
  hire.disabled = d.status !== 'open' || d.round > 3;
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
  if (weekOnly()) {
    const tid = trainedId();
    const tr = pixBtn('card-train', tid !== null ? U('trainDone') : U('train'), 'alt', function () {
      const r = sim.train(id);
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
const LEVEL_KEY = { run: ['runSpeed', 'runTip'], fire: ['fireSense', 'firePace'], prep: ['prepKnife', 'prepPace'] };
function curveWords(key, v) {
  if (!Number.isFinite(v)) return '';
  if (key === 'runTip') return String(Math.round((1 + v) * 100));
  if (key === 'prepKnife') return String(Math.round(v * 100));
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
      uiPut(out, word, 2, UI.gold, null, word);
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
  const c = fitSign(name, room, big ? [3, 2] : [2], '#fff0c8', { bold: true, shadow: '#120c08' });
  if (c) {
    sign.appendChild(c);
    sign.appendChild(mk('span', { cls: 'sr', text: name }));
  } else {
    uiPut(sign, name.toUpperCase(), 3, '#fff0c8', { shadow: '#120c08' }, name);
  }
}

// The backyard patch with the draft look (deviation 38), at an integer device pixel scale. Q-6: on a
// phone (the sticky preview) the patch is cropped to the panel's width at 4x (3x under 700 px of
// screen height) and 44 px tall, the pitmaster near the middle and the kettle at his right; the
// desktop column keeps the 64 by 56 patch at up to 5x.
function drawCreatorScene() {
  const cv = document.getElementById('cr-scene');
  if (!cv) return;
  const pvw = document.getElementById('cr-preview');
  const vw = document.documentElement.clientWidth || 375;
  const phone = vw < 900;
  // The preview's content width (its sticky phone padding is 12 a side), less the scene's frame.
  const avail = (pvw && pvw.clientWidth ? pvw.clientWidth : 300) - (phone ? 24 : 0) - 8;
  const css = phone ? ((window.innerHeight || 812) >= 700 ? 4 : 3) : Math.max(1, Math.min(5, Math.floor(avail / CR_SCENE_W)));
  const W = phone ? Math.max(48, Math.min(128, Math.floor(avail / css))) : CR_SCENE_W;
  const H = phone ? 44 : CR_SCENE_H;
  const dy = phone ? -10 : 0;                                 // the crop starts 10 px down the patch
  const px0 = phone ? Math.round(W * 0.42) - 8 : 8;           // the pitmaster's left
  const kx = phone ? Math.min(W - 12, px0 + 30) : 40;         // the kettle's left
  // v3.4: the preview is art3 at 2 render px per sim px, through the bridge (v2 art if art3 lacks one).
  if (!crOff) crOff = document.createElement('canvas');
  if (crOff.width !== W * RS || crOff.height !== H * RS) { crOff.width = W * RS; crOff.height = H * RS; }
  const g = crOff.getContext('2d');
  g.setTransform(RS, 0, 0, RS, 0, 0);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  g.fillStyle = COLOR.K;
  g.fillRect(0, 0, W, H);
  const draw = function (name, x, y, f) {
    if (!art.has(name)) return;
    const ff = Math.max(0, Math.min(art.frames(name) - 1, f | 0)), sz = size(name);
    if (B3 && B3.draw(g, name, x, y, sz[0], sz[1], ff, false)) return;
    art.draw(g, name, x, y, ff, false);
  };
  for (let x = 0; x < Math.ceil(W / TILE); x++) {
    draw('fence_back', x * TILE, dy, 0);
    draw('lawn_a', x * TILE, TILE + dy, (x * 5 + 3) % 3 === 0 ? 1 : 0);
    draw('paver', x * TILE, 2 * TILE + dy, (x * 7 + 6) % 2);
    draw('paver', x * TILE, 3 * TILE + dy, (x * 7 + 9) % 2);
  }
  // P-15: the pitmaster and the kettle with three puffs over its vent.
  draw('kettle', kx, 28 + dy, 2);
  const ph = reduced ? 0.15 : (crAnim % 1.2) / 1.2;
  for (let k = 0; k < 3; k++) {
    const age = (k + ph) / 3;
    draw('smoke', kx + 7 + Math.round(age * 4), Math.round(20 - age * 18) + dy, Math.min(2, Math.floor(age * 3)));
  }
  draw('shadow', px0 + 2, 49 + dy, 0);
  draw('player_down', px0, 28 + dy, 0);
  const d = dpr();
  const k = Math.max(1, Math.floor(css * d / RS + 1e-6));
  const RWc = W * RS, RHc = H * RS;
  if (cv.width !== RWc * k || cv.height !== RHc * k) { cv.width = RWc * k; cv.height = RHc * k; }
  cv.style.width = (RWc * k / d) + 'px';
  cv.style.height = (RHc * k / d) + 'px';
  const vg = cv.getContext('2d');
  vg.imageSmoothingEnabled = false;
  vg.drawImage(crOff, 0, 0, RWc, RHc, 0, 0, RWc * k, RHc * k);
  // R-14 and Q-6: focused rows scroll clear of the sticky preview and the sticky Fire it up.
  const foot = document.getElementById('cr-foot');
  if (el.creator) {
    el.creator.style.scrollPaddingTop = phone && pvw ? (pvw.offsetHeight + 8) + 'px' : '';
    el.creator.style.scrollPaddingBottom = phone && foot ? (foot.offsetHeight + 8) + 'px' : '';
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

// ---------------------------------------------------------------- the season end card (W17.5)

function openSeasonEnd() {
  buildSeasonEnd();
  if (currentPanel !== 'season-end') openPanel('season-end');
}

function buildSeasonEnd() {
  const s = sim.state;
  const pv = typeof sim.seasonEndPreview === 'function' ? sim.seasonEndPreview() : null;
  const year = pv ? pv.year : (s.season ? s.season.year : 1);
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
  const n = C.SEASON_WEEKS || 9;
  for (let i = 0; i < n; i++) {
    const r = res[i] || { type: 'yard', stars: 0 };
    const st = r.type === 'yard' ? 0 : r.stars | 0;
    const li = mk('li', { id: 'se-wk-' + (i + 1), cls: 'se-wk', attrs: { 'aria-label': U('wkDone', { w: i + 1, label: bookingLabel(r.type), stars: starsWord(st) }) } });
    const inner = mk('div', { cls: 'tin', attrs: { 'aria-hidden': 'true' } });
    inner.appendChild(uiPut(mk('span', { cls: 'tn' }), String(i + 1), 2, UI.K));
    const ic = sprEl('ev_' + r.type, 0, 2, null);
    if (ic) inner.appendChild(ic);
    const row = mk('span', { cls: 'tstars' });
    if (r.type !== 'yard') for (let k = 0; k < 5; k++) { const e = starEl(k < st, 1); if (e) row.appendChild(e); }
    inner.appendChild(row);
    li.appendChild(inner);
    ol.appendChild(li);
  }
  box.appendChild(ol);
  const P = pv || { cash: s.cash, repFrom: s.rep, repTo: s.rep, spoiled: {}, charcoal: s.charcoal };
  const meat = railList(P.spoiled, 'label');
  box.appendChild(mk('p', { id: 'se-cash', text: U('seCash', { c: fmt(P.cash) }) }));
  box.appendChild(mk('p', { id: 'se-rep', text: U('seRep', { b: P.repTo, a: P.repFrom }) }));
  box.appendChild(mk('p', { id: 'se-meat', text: meat ? U('seMeat', { list: meat }) : U('seMeatNone') }));
  box.appendChild(mk('p', { id: 'se-charcoal', text: U('seCharcoal', { n: P.charcoal }) }));
  // X5.9, X13.6: each card whose contract renews, at its new wage.
  const pc = pv && Array.isArray(pv.crew) ? pv.crew : [];
  for (let i = 0; i < pc.length; i++) {
    if (pc[i] && pc[i].renews) box.appendChild(mk('p', { id: 'se-crew-' + pc[i].id, cls: 'se-crew', text: U('seCrew', { name: pc[i].name, w: pc[i].wageTo }) }));
  }
  body.appendChild(box);
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

// ---------------------------------------------------------------- input

function setupInput() {
  el.cv.addEventListener('pointerdown', onPointer);
  el.cv.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  el.act.addEventListener('click', onAct);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', function () { held.clear(); });
  document.addEventListener('visibilitychange', onVisibility);
}

// The drawn boxes of a station: its sprite, plus the counter extension when owned (D13).
// With the art3 look the sprite's box is the art3 sprite's on screen, clipped to the yard.
function stationRects(st) {
  const sz = size(st.sprite);
  let r0 = { x: st.draw.x, y: st.draw.y, w: sz[0], h: sz[1] };
  const b3 = B3 && B3.bounds ? B3.bounds(st.sprite, st.draw.x, st.draw.y, sz[0], sz[1], 0) : null;
  if (b3) {
    const x0 = Math.max(0, b3.x), y0 = Math.max(0, b3.y);
    const x1 = Math.min(VW, b3.x + b3.w), y1 = Math.min(VH, b3.y + b3.h);
    if (x1 > x0 && y1 > y0) r0 = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const out = [r0];
  if (st.type === 'table' && extTile && owned(extTile)) out.push(extRect());
  return out;
}
function extRect() {
  const sz = size('counter_ext');
  return { x: extTile.x * TILE, y: (extTile.y + 1) * TILE - sz[1], w: sz[0], h: sz[1] };
}

// Active stations in y-sort draw order (key, draw x, list order); stations share one layer.
function stationsInDrawOrder() {
  const list = [];
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (!owned(st)) continue;
    list.push({ st: st, k: st.sortRow * TILE + 15, x: st.draw.x, o: i });
  }
  list.sort(function (a, b) { return (a.k - b.k) || (a.x - b.x) || (a.o - b.o); });
  return list;
}

function stationAt(vx, vy) {
  const list = stationsInDrawOrder();
  for (let i = list.length - 1; i >= 0; i--) {
    const rects = stationRects(list[i].st);
    for (let j = 0; j < rects.length; j++) {
      const r = rects[j];
      if (vx >= r.x && vx < r.x + r.w && vy >= r.y && vy < r.y + r.h) return list[i].st;
    }
  }
  return null;
}

function onPointer(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (currentPanel) return;
  const s = sim.state;
  if (s.paused || s.phase !== 'service') return;
  const r = el.cv.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return;
  const vx = (e.clientX - r.left) / r.width * VW;
  const vy = (e.clientY - r.top) / r.height * VH;
  // Round 2: a tap on the drawn tutorial arrow counts as a tap on its station, since the arrow sits
  // on a use tile or a tile above the station and tapping it is the natural first move.
  const ab = arrowBox();
  const onArrow = ab && vx >= ab.x - 2 && vx < ab.x + 10 && vy >= ab.y && vy < ab.y + 12;
  const hit = onArrow ? ab.st : stationAt(vx, vy);
  let tx, ty;
  if (hit) { tx = hit.tiles[0].x; ty = hit.tiles[0].y; }
  else { tx = Math.floor(vx / TILE); ty = Math.floor(vy / TILE); }
  const ok = sim.walkTo(tx, ty) === true;
  pump();
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

function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key || '';
  const lower = key.length === 1 ? key.toLowerCase() : key;
  if (howtoOpen) {
    if (key === 'Escape') { e.preventDefault(); closeHowto(); }
    return;
  }
  if (currentPanel) {
    if (currentPanel === 'pause' && (key === 'Escape' || lower === 'p')) {
      e.preventDefault();
      if (!e.repeat) resumeFromPause();
    } else if (currentPanel === 'newgame' && key === 'Escape') {
      e.preventDefault();
      confirmNo();
    } else if (currentPanel === 'sheet' && key === 'Escape') {
      e.preventDefault();
      closeSheet();
    } else if (currentPanel === 'card' && key === 'Escape') {
      e.preventDefault();
      cardBack();
    } else if (currentPanel === 'hiring' && key === 'Escape' && hireHelpOpen) {
      e.preventDefault();
      hireHelpOpen = false;
      const hp = document.getElementById('hire-help');
      if (hp) hp.hidden = true;
      const hi = document.getElementById('hire-info');
      if (hi) { hi.setAttribute('aria-expanded', 'false'); hi.focus(); }
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
  return c.mode === 'waiting' && c.patienceMax > 0 && c.patience <= c.patienceMax * C.SWEAT_FRAC;
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
          const vent = st.sprite === 'drum' ? { x: tx + 7, y: ty - 4 } : { x: tx + 11, y: ty - 10 };
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
      for (let i = 0; i < 40; i++) rainDrops.push({ x: Math.floor(crng() * VW), y: crng() * VH, v: 70 + crng() * 40 });
    }
    for (let i = 0; i < rainDrops.length; i++) {
      const d = rainDrops[i];
      d.y += d.v * dt;
      if (d.y > VH) { d.y = -3; d.x = Math.floor(crng() * VW); }
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
    if ((t.x !== dog.x || t.y !== dog.y) && !seatTakenBelow(t.x, t.y)) cands.push(t);
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
  for (let i = 0; i < MAP.seats.length; i++) {
    const st = MAP.seats[i];
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

// ---------------------------------------------------------------- drawing primitives

function size(name) {
  let s = SIZE[name];
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

function D(name, x, y, frame, flip) {
  const sz = size(name);
  if (!inView(name, x, y, sz[0], sz[1])) return;
  const f = normFrame(frame, sz[2]);
  if (!(B3 && B3.draw(octx, name, x, y, sz[0], sz[1], f, flip === true))) art.draw(octx, name, x, y, f, flip === true);
  if (capturing) recs.push({ name: name, frame: f, x: x, y: y, w: sz[0], h: sz[1] });
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
function drawRail(r, s) {
  const clock = String(Math.max(0, Math.ceil(tEnd(s) - s.clock)));
  const booking = r.kind === 'booking';
  const strs = [];
  let w = 6 + art.textWidth(clock);
  for (let i = 0; i < r.items.length; i++) {
    const it = r.items[i];
    const str = String(booking ? it.left : it.sold);
    strs.push(str);
    w += 2 + 8 + 1 + art.textWidth(str) + (booking ? 2 : 0);
  }
  const bw = Math.min(174, w + 4);
  octx.fillStyle = COLOR.U;
  octx.fillRect(1, 1, bw, 11);
  octx.fillStyle = COLOR.C;
  for (let gy = 0; gy < CLOCK_GLYPH.length; gy++) {
    for (let gx = 0; gx < CLOCK_GLYPH[gy].length; gx++) if (CLOCK_GLYPH[gy][gx] === 'c') octx.fillRect(3 + gx, 3 + gy, 1, 1);
  }
  T(clock, 9, 3, null);
  let x = 9 + art.textWidth(clock);
  for (let i = 0; i < r.items.length; i++) {
    const it = r.items[i];
    const tw = art.textWidth(strs[i]);
    if (x + 2 + 8 + 1 + tw + (booking ? 2 : 0) > 1 + bw) break;
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
function recT(str, x, y) {
  if (!capturing) return;
  const fs = size('font');
  const s = String(str).toUpperCase();
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') { cx += fs[0] + 1; continue; }
    const g = glyphFrame(ch);
    if (g < 0) continue;
    recs.push({ name: 'font', frame: g, x: cx, y: y, w: fs[0], h: fs[1] });
    cx += fs[0] + 1;
  }
}

// Floating number: the string in the outline color at four 1 px offsets, then in its color on
// top (round 2; no box). Only the colored pass is recorded by captureFrame.
const FLOAT_KIND = { yellow: 'cash', white: 'tip', pink: 'fan' };
function popText(str, x, y, colorKey) {
  if (B3 && B3.floatNum(octx, str, x, y, FLOAT_KIND[colorKey] || 'plain', VW)) { recT(str, x, y); return; }
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

// Dashed footprint outline: 1 px, 2 on and 2 off, clockwise from the top left pixel. Outline
// colored on pavers (cream would vanish on the paver tan), cream on the lawn and hedge.
function dashedBox(x, y, w, h) {
  octx.fillStyle = paverAt(Math.floor(x / TILE), Math.floor(y / TILE)) ? COLOR.outline : COLOR.C;
  let i = 0;
  for (let xx = x; xx < x + w; xx++, i++) if ((i & 3) < 2) octx.fillRect(xx, y, 1, 1);
  for (let yy = y + 1; yy < y + h; yy++, i++) if ((i & 3) < 2) octx.fillRect(x + w - 1, yy, 1, 1);
  for (let xx = x + w - 2; xx >= x; xx--, i++) if ((i & 3) < 2) octx.fillRect(xx, y + h - 1, 1, 1);
  for (let yy = y + h - 2; yy > y; yy--, i++) if ((i & 3) < 2) octx.fillRect(x, yy, 1, 1);
  if (capturing) recs.push({ name: '#outline', frame: 0, x: x, y: y, w: w, h: h });
}

function drawRing(x, y, frac, color) {
  const n = Math.max(0, Math.min(RING.length, Math.round(frac * RING.length)));
  if (n === 0) return;
  octx.fillStyle = color;
  for (let i = 0; i < n; i++) octx.fillRect(x + RING[i][0], y + RING[i][1], 1, 1);
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

function drawGround(s) {
  const T_ = MAP.T;
  const clover = new Set();      // unowned decor footprints take the clover frame (round 2)
  for (let i = 0; i < MAP.decor.length; i++) {
    const spot = MAP.decor[i];
    if (s.decor[spot.id] === true) continue;
    for (let j = 0; j < spot.tiles.length; j++) clover.add(spot.tiles[j].x + ',' + spot.tiles[j].y);
  }
  if (B3) {
    const path = [], cl = [];
    PATH_TILES.forEach(function (k) { const p = k.split(','); path.push({ x: +p[0], y: +p[1] }); });
    clover.forEach(function (k) { const p = k.split(','); cl.push({ x: +p[0], y: +p[1] }); });
    if (B3.ground(octx, MAP, path, cl)) return;
  }
  for (let y = 0; y < MAP.H; y++) {
    for (let x = 0; x < MAP.W; x++) {
      const t = MAP.at(x, y);
      if (t === T_.PAVER || PATH_TILES.has(x + ',' + y)) paverTile(x, y);
      else if (t === T_.LAWN || t === T_.GATE) lawnTile(x, y, clover);
      else if (y >= LAWN_FROM_ROW) lawnTile(x, y, clover);
      else paverTile(x, y);
    }
  }
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

function drawStack(meat, count, x, y, max) {
  const n = Math.min(count, max);
  const name = 'plate_' + meat;
  for (let k = 0; k < n; k++) D(name, x, y - k);
}

function drawStation(st, s) {
  const tx = st.tiles[0].x * TILE, ty = st.tiles[0].y * TILE;
  if (st.type === 'cooker') {
    const ck = s.stations[st.id];
    const band = PitSim.fireBand(ck ? ck.fire : 0);
    D(st.sprite, st.draw.x, st.draw.y, BAND_FRAME[band] || 0);
    if (!ck) return;
    drawGauge(st, ck);
    // The flame sits under the grate (round 1): drawn before the pieces so it never covers a
    // piece's charred warning edges or the top run of its ring.
    if (band === 'good' || band === 'hot') {
      D('fire', st.draw.x + 4, st.draw.y - 4, reduced ? 0 : Math.floor(tAnim * FX.FIRE_FPS) % 3);
    }
    // Kettle slots overlap by 4 px, so a piece about to burn draws after the others on its
    // cooker (round 1): its charred frame and red ring stay on top.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < ck.pieces.length; i++) {
        const p = ck.pieces[i];
        const late = p.state === 'done' && p.warn === true;
        if (late !== (pass === 1)) continue;
        const pos = piecePos(st, p);
        D('piece_' + p.meat, pos.x, pos.y, pieceFrame(p));
        const m = MEATS[p.meat];
        if (!m) continue;
        if (p.state === 'cooking') drawRing(pos.x - 1, pos.y - 1, Math.min(1, p.prog / m.cook), COLOR.O);
        else if (p.state === 'done') drawRing(pos.x - 1, pos.y - 1, Math.max(0, 1 - (p.prog - m.cook) / m.window), late ? COLOR.red : COLOR.lawnA);
        else drawRing(pos.x - 1, pos.y - 1, 1, COLOR.K);
      }
    }
  } else if (st.type === 'board') {
    const b = s.stations.board;
    D('board', st.draw.x, st.draw.y, b && b.slicing ? 1 : 0);
    if (b && b.stacks) {
      for (let j = 0; j < b.stacks.length && j < BOARD_OFFS.length; j++) {
        const stack = b.stacks[j];
        if (stack && stack.times && stack.times.length) {
          drawStack(stack.meat, stack.times.length, st.draw.x + BOARD_OFFS[j][0], st.draw.y + BOARD_OFFS[j][1], BOARD_DRAW_MAX);
        }
      }
    }
    // X13.7: up to two pieces left for the PREP card, at the board's left and right thirds.
    if (b && Array.isArray(b.waiting)) {
      for (let j = 0; j < b.waiting.length && j < 2; j++) {
        const w = b.waiting[j];
        if (w && MEATS[w.meat]) D('hand_cooked_' + w.meat, st.draw.x + (j === 0 ? -1 : 9), st.draw.y + 4);
      }
    }
  } else if (st.type === 'cooler') {
    D('cooler', st.draw.x, st.draw.y, s.gear.cooler ? (sim.reach() === 'cooler' ? 2 : 1) : 0);
  } else if (st.type === 'table') {
    const big = !!(extTile && owned(extTile));
    if (big) { const r = extRect(); D('counter_ext', r.x, r.y); }
    D('counter', st.draw.x, st.draw.y, big ? 1 : 0);
    const spots = s.stations.table ? s.stations.table.spots : [];
    const px = st.spotPx || [];
    for (let i = 0; i < spots.length && i < px.length; i++) {
      const stack = spots[i];
      if (!stack || !stack.times || !stack.times.length || !owned(px[i])) continue;
      drawStack(stack.meat, stack.times.length, px[i].x, px[i].y, C.TABLE_STACK);
    }
  } else if (st.type === 'pile') {
    const n = s.charcoal | 0;
    // Round 2: full at 5 bags or more (day 1's cart), half at 3 or 4, low at 1 or 2.
    D('pile', st.draw.x, st.draw.y, n >= 5 ? 0 : n >= 3 ? 1 : n >= 1 ? 2 : 3);
  } else if (st.type === 'trash') {
    D('trash', st.draw.x, st.draw.y);
  } else {
    D(st.sprite, tx, ty);
  }
}

// 4 connected runs of footprint tiles, one box each, top left first.
function runsOf(tiles) {
  const left = tiles.map(function (t) { return { x: t.x, y: t.y }; });
  const runs = [];
  while (left.length) {
    const comp = [left.shift()];
    for (let i = 0; i < comp.length; i++) {
      for (let j = left.length - 1; j >= 0; j--) {
        if (Math.abs(comp[i].x - left[j].x) + Math.abs(comp[i].y - left[j].y) === 1) comp.push(left.splice(j, 1)[0]);
      }
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < comp.length; i++) {
      x0 = Math.min(x0, comp[i].x); y0 = Math.min(y0, comp[i].y);
      x1 = Math.max(x1, comp[i].x); y1 = Math.max(y1, comp[i].y);
    }
    runs.push({ tx: x0, ty: y0, x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE, row: y1 });
  }
  runs.sort(function (a, b) { return (a.ty - b.ty) || (a.tx - b.tx); });
  return runs;
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
  if (c.kind === 'raw') return 'hand_raw_' + c.meat;
  if (c.kind === 'cooked') return 'hand_cooked_' + c.meat;
  if (c.kind === 'burnt') return 'hand_burnt';
  if (c.kind === 'plates') return (c.times && c.times.length >= 2 ? 'hand_tray_' : 'hand_plate_') + c.meat;
  return null;
}

function custHand(c) {
  if (c.mode === 'toSeat') return 'hand_plate_' + c.want;
  if (c.mode === 'leaving' && c.reason === 'togo') return 'hand_togo';
  return null;
}

function hopOffset(c) { return (c.hop > 0 && !reduced) ? -2 : 0; }

function drawMover(kind, m, s) {
  const bx = Math.round(m.px), by = Math.round(m.py);
  const isCust = kind === 'cust';
  const yo = isCust ? hopOffset(m) : 0;
  const body = isCust ? custBody(m) : staffBody(kind, m, s);
  const hand = isCust ? custHand(m) : staffHand(kind, m, s);
  const bh = size(body[0])[1];
  const feet = by + TILE;
  D('shadow', bx + 2, by + 13);
  // Facing up, a hand item hides behind the back; the charcoal scoop instead rides over the head
  // (round 1) so picking it up at the pile shows, 1 px clear of the hair (round 2).
  const overHead = hand === 'hand_charcoal' && m.face === 'up';
  const who3 = function () { if (B3) B3.person(isCust ? m.id : null, !!hand && !overHead); };
  if (hand && m.face === 'up' && !overHead) D(hand, bx + 4, by - 1 + yo);
  const sq = (kind === 'player' && squashAt >= 0 && !reduced) ? tAnim - squashAt : -1;
  if (sq >= 0 && sq < FX.SQUASH_S) {
    who3();
    if (sq < FX.SQUASH_S / 2) DS(body[0], bx - 1, feet - 22, 18, 22, body[1], body[2]);
    else DS(body[0], bx + 1, feet - 26, 14, 26, body[1], body[2]);
  } else {
    who3();
    D(body[0], bx, feet - bh + yo, body[1], body[2]);
  }
  if (hand && m.face !== 'up') D(hand, bx + 4, by + 4 + yo);
  if (overHead) D(hand, bx + 4, feet - bh - 9 + yo);
}

function drawSeated(c, seat) {
  const sx = seat.x * TILE, sy = seat.y * TILE;
  const f = c.eat > 0 ? (reduced ? 0 : Math.floor(tAnim / FX.EAT_FRAME_S) % 2) : 2;
  if (B3) B3.person(c.id, false);
  D('cust' + (((c.body | 0) % 4 + 4) % 4) + '_sit', sx, sy - 6, f);
}

function seatOf(c) { return c.seat ? SEAT_BY_ID[c.seat] || null : null; }

// A see-through preview of an unowned piece; its capture record carries ghost: true.
function ghost(name, x, y, frame) {
  const n = recs.length;
  octx.globalAlpha = GHOST_ALPHA;
  D(name, x, y, frame);
  octx.globalAlpha = 1;
  if (capturing) for (let i = n; i < recs.length; i++) recs[i].ghost = true;
}

function drawSorted(s) {
  const items = [];
  let order = 0;
  function push(k, layer, dx, fn) { items.push({ k: k, l: layer, x: dx, o: order++, f: fn }); }
  const T_ = MAP.T;
  const open = gateOpen(s);

  // Fence, gate, hedge and bed tiles, row major (layer 0).
  for (let y = 0; y < MAP.H; y++) {
    for (let x = 0; x < MAP.W; x++) {
      const t = MAP.at(x, y);
      const px = x * TILE, key = y * TILE + 15;
      if (t === T_.FENCE && y === 0) {
        const corner = x === 0 || x === MAP.W - 1;
        push(key, 0, px, function () { D('fence_back', px, 0, corner ? 1 : 0); });
      } else if (t === T_.FENCE) {
        const name = fenceName(x, y);
        push(key, 0, px, function () { D(name, px, (y + 1) * TILE - size(name)[1]); });
      } else if (t === T_.GATE) {
        push(key, 0, px, function () { D('gate', px, (y + 1) * TILE - size('gate')[1], open ? 1 : 0); });
      } else if (t === T_.HEDGE) {
        push(key, 0, px, function () { D('hedge', px, (y + 1) * TILE - size('hedge')[1], x % 2); });
      } else if (t === T_.BED) {
        push(key, 0, px, function () { D('bed', px, (y + 1) * TILE - size('bed')[1], (x + y) % 3); });
      }
    }
  }

  // Fixed props (layer 1).
  for (let i = 0; i < MAP.props.length; i++) {
    const p = MAP.props[i];
    push(p.sortRow * TILE + 15, 1, p.draw.x, function () {
      D(p.sprite, p.draw.x, p.draw.y, p.frame);
      if (p.id === 'sign' && MAP.signText) drawSign(s);
    });
  }

  // Active stations with their extras (layer 1).
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (!owned(st)) continue;
    push(st.sortRow * TILE + 15, 1, st.draw.x, function () { drawStation(st, s); });
  }

  // Owned decor, not the overhead draws (layer 1).
  const birdOn = birdUntil >= 0 && birdUntil > tAnim && !reduced;
  for (let i = 0; i < MAP.decor.length; i++) {
    const spot = MAP.decor[i];
    if (s.decor[spot.id] !== true) {
      // The unbought Flower bed shows its box of tilled soil (bed frame 3, round 2).
      if (spot.id === 'flowers') {
        for (let j = 0; j < spot.draws.length; j++) {
          const d = spot.draws[j];
          if (d.sprite === 'bed') push(d.sortRow * TILE + 15, 1, d.x, function () { D('bed', d.x, d.y, 3); });
        }
      }
      continue;
    }
    for (let j = 0; j < spot.draws.length; j++) {
      const d = spot.draws[j];
      if (d.overhead) continue;
      const frame = (spot.id === 'birdbath' && d.sprite === 'birdbath' && birdOn) ? 1 : d.frame;
      push(d.sortRow * TILE + 15, 1, d.x, function () { D(d.sprite, d.x, d.y, frame); });
    }
  }

  // Ghosts of unowned gear and decor (layer 1, the footprint's sort key), under their outlines.
  // Morning and evening only (round 2): during service the yard shows what is really there.
  if (s.phase !== 'service') {
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (!owned(st)) {
        push(st.sortRow * TILE + 15, 1, st.draw.x, function () { ghost(st.sprite, st.draw.x, st.draw.y, 0); });
      } else if (st.type === 'table' && extTile && !owned(extTile)) {
        const r = extRect();
        push(st.sortRow * TILE + 15, 1, r.x, function () {
          if (B3) {
            octx.globalAlpha = GHOST_ALPHA;
            const csz = size(st.sprite);
            const hit = B3.extGhost(octx, r, { x: st.draw.x, y: st.draw.y, w: csz[0], h: csz[1] });
            octx.globalAlpha = 1;
            if (hit) { const n = recs.length; recOnly('counter_ext', r.x, r.y, 0); if (capturing) for (let i = n; i < recs.length; i++) recs[i].ghost = true; return; }
          }
          ghost('counter_ext', r.x, r.y, 0);
        });
      }
    }
    for (let i = 0; i < MAP.decor.length; i++) {
      const spot = MAP.decor[i];
      if (s.decor[spot.id] === true) continue;
      for (let j = 0; j < spot.draws.length; j++) {
        const d = spot.draws[j];
        if (d.overhead) continue;
        push(d.sortRow * TILE + 15, 1, d.x, function () { ghost(d.sprite, d.x, d.y, d.frame); });
      }
    }
  }

  // Dashed outlines of unowned footprints: stations, then decor (layer 2).
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    const stOwned = owned(st);
    const tiles = [];
    for (let j = 0; j < st.tiles.length; j++) if (!stOwned || !owned(st.tiles[j])) tiles.push(st.tiles[j]);
    if (!tiles.length) continue;
    const runs = runsOf(tiles);
    for (let j = 0; j < runs.length; j++) {
      const r = runs[j];
      push(r.row * TILE + 15, 2, r.x, function () { dashedBox(r.x, r.y, r.w, r.h); });
    }
  }
  for (let i = 0; i < MAP.decor.length; i++) {
    const spot = MAP.decor[i];
    if (s.decor[spot.id] === true) continue;
    const runs = runsOf(spot.tiles);
    for (let j = 0; j < runs.length; j++) {
      const r = runs[j];
      push(r.row * TILE + 15, 2, r.x, function () { dashedBox(r.x, r.y, r.w, r.h); });
    }
  }

  // People (layer 3): the player, the RUN, FIRE and PREP cards' movers (buddy, tender, prep), then
  // customers by id. X13.7: each crew mover wears its card's look (deviation 54).
  const staff = [['player', s.player, ''], ['buddy', s.buddy, 'run'], ['tender', s.tender, 'fire'], ['prep', s.prep || null, 'prep']];
  for (let i = 0; i < staff.length; i++) {
    const m = staff[i][1], role = staff[i][2];
    if (!m) continue;
    let kind = staff[i][0];
    if (role) {
      const card = moverCard(m);
      if (card && card.look) ensureCrewLook(role, card.look);
      if (kind === 'prep' && !art.has('prep_down')) kind = 'buddy';
    }
    push(Math.round(m.py) + 15, 3, Math.round(m.px), function () { drawMover(kind, m, s); });
  }
  const custs = s.customers.slice().sort(byId);
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    const seat = c.mode === 'eating' ? seatOf(c) : null;
    if (seat) push(seat.y * TILE + 15, 3, seat.x * TILE, function () { drawSeated(c, seat); });
    else push(Math.round(c.py) + 15, 3, Math.round(c.px), function () { drawMover('cust', c, s); });
  }

  // Eaters' plates (layer 5), by customer id.
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (c.mode !== 'eating') continue;
    const seat = seatOf(c);
    if (!seat) continue;
    const sx = seat.x * TILE, sy = seat.y * TILE;
    const chair = isChairSeat(seat);
    const px = sx + 4, py = chair ? sy + 9 : sy + 17;
    const key = chair ? seat.y * TILE + 15 : (seat.y + 1) * TILE + 15;
    push(key, 5, px, function () { D('plate_' + c.want, px, py); });
  }

  // The dog (layer 4).
  const dx = Math.round(dog.px), dy = Math.round(dog.py);
  push(dy + 15, 4, dx, function () { D('dog', dx, dy, dog.frame, dog.flip); });

  items.sort(function (a, b) { return (a.k - b.k) || (a.l - b.l) || (a.x - b.x) || (a.o - b.o); });
  for (let i = 0; i < items.length; i++) items[i].f();
  return custs;
}

// ---------------------------------------------------------------- render: the passes after the sort

function drawOverhead(s) {
  if (s.decor.lights === true && MAP.overhead && MAP.overhead.lights) {
    D('lights_string', MAP.overhead.lights.x, MAP.overhead.lights.y, reduced ? 0 : Math.floor(tAnim / FX.TWINKLE_S) % 2);
  }
  if (s.gear.canopy === true && MAP.overhead && MAP.overhead.canopy) {
    D('canopy', MAP.overhead.canopy.x, MAP.overhead.canopy.y);
  }
}

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
    D(dark ? 'smoke_dark' : 'smoke', Math.round(x), Math.round(y), Math.min(2, Math.floor(3 * age / p.life)));
  }
  // Flames draw with their cooker in pass 2, under the grate pieces (round 1).
}

function bandColor(band) {
  if (band === 'hot') return COLOR.O;
  if (band === 'good') return COLOR.lawnA;
  if (band === 'low') return COLOR.woodL;
  return COLOR.smokeD;
}

function drawGauge(st, ck) {
  const gx = st.tiles[0].x * TILE + 18;
  const top = st.draw.y + 4, bottom = st.draw.y + size(st.sprite)[1];
  const h = bottom - top;
  if (h < 4) return;
  octx.fillStyle = COLOR.outline;
  octx.fillRect(gx, top, 3, h);
  const inner = h - 2;
  const f = Math.max(0, Math.min(1, ck.fire / C.FIRE_MAX));
  const fh = Math.round(f * inner);
  if (fh > 0) {
    octx.fillStyle = bandColor(PitSim.fireBand(ck.fire));
    octx.fillRect(gx, top + 1 + (inner - fh), 3, fh);
  }
  octx.fillStyle = COLOR.C;
  const t1 = top + 1 + inner - Math.round(C.FIRE_GOOD / C.FIRE_MAX * inner);
  const t2 = top + 1 + inner - Math.round(C.FIRE_HOT / C.FIRE_MAX * inner);
  octx.fillRect(gx, t1, 1, 1); octx.fillRect(gx + 2, t1, 1, 1);
  octx.fillRect(gx, t2, 1, 1); octx.fillRect(gx + 2, t2, 1, 1);
}

function drawCues(s, custs) {
  // Bubbles: order icon or walk out mark, then food bubbles.
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    const inLine = c.mode === 'arriving' || c.mode === 'waiting';
    const until = markX.get(c.id);
    const showMark = until !== undefined && until > tAnim;
    const px = Math.round(c.px), py = Math.round(c.py) + hopOffset(c);
    if (inLine || showMark) {
      D('bubble', px + 14, py - 22);
      if (showMark) {
        D('mark_x', px + 18, py - 20);
      } else {
        const frac = c.patienceMax > 0 ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
        const blink = frac <= C.PATIENCE_WARN_FRAC && !reduced && Math.floor(tAnim * 4) % 2 === 1;
        if (!blink) D('icon_' + c.want, px + 18, py - 20);
      }
    } else if (c.mode === 'eating' && c.eat > 0) {
      const seat = seatOf(c);
      const sx = seat ? seat.x * TILE : px, sy = seat ? seat.y * TILE : Math.round(c.py);
      D('bubble', sx, sy - 21);
      D('plate_' + c.want, sx + 4, sy - 18);
    }
  }
  // "!" bubbles over cookers with a piece about to burn ([T 3.4]); one per cooker.
  if (art.has('bubble_warn')) {
    const blink = FX.WARN_BLINK_S > 0 ? FX.WARN_BLINK_S : 0.25;
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (st.type !== 'cooker' || !owned(st) || !cookerWarns(s.stations[st.id])) continue;
      const bp = warnBubblePos(st);
      D('bubble_warn', bp.x, bp.y, reduced ? 0 : Math.floor(tAnim / blink) % 2);
    }
  }
  // Patience bars.
  const mid = typeof C.PATIENCE_MID_FRAC === 'number' ? C.PATIENCE_MID_FRAC : 0.5;
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (c.mode !== 'arriving' && c.mode !== 'waiting') continue;
    const px = Math.round(c.px), py = Math.round(c.py) + hopOffset(c);
    const frac = c.patienceMax > 0 ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
    const bx = px + 15, by = py - 26;
    if (bx >= VW || by < 0) continue;
    octx.fillStyle = COLOR.K;
    octx.fillRect(bx, by, 14, 3);
    octx.fillStyle = frac <= C.PATIENCE_WARN_FRAC ? COLOR.red : (frac <= mid ? COLOR.yellow : COLOR.lawnA);
    const w = Math.max(frac > 0 ? 1 : 0, Math.round(14 * frac));
    if (w > 0) octx.fillRect(bx, by, w, 3);
  }
  // Sweat drops. (Fire gauges draw with their cooker in the y-sorted pass, round 2.)
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (!sweating(c)) continue;
    const px = Math.round(c.px) + 12, py = Math.round(c.py) - 6 + hopOffset(c);
    if (reduced) { D('sweat', px, py, 0); continue; }
    const t0 = sweatAt.has(c.id) ? sweatAt.get(c.id) : tAnim;
    const t = Math.max(0, tAnim - t0) % FX.SWEAT_EVERY;
    if (t < FX.SWEAT_SLIDE_S) D('sweat', px, py + Math.round(FX.SWEAT_SLIDE_PX * t / FX.SWEAT_SLIDE_S), 0);
    else if (t < FX.SWEAT_SLIDE_S + FX.SWEAT_SPLASH_S) D('sweat', px, py + FX.SWEAT_SLIDE_PX, 1);
  }
  // zzz over an idle buddy.
  const b = s.buddy;
  if (b && zzzAt >= 0) {
    const zx = Math.round(b.px) + 10, zy = Math.round(b.py) - 14;
    if (reduced) {
      D('zzz', zx, zy, 2);
    } else {
      const cycle = FX.ZZZ_FRAME_S * 3;
      const t = Math.max(0, tAnim - zzzAt);
      D('zzz', zx, zy - Math.round(FX.ZZZ_DRIFT_PX * (t % cycle) / cycle), Math.floor(t / FX.ZZZ_FRAME_S) % 3);
    }
  }
  // Hearts.
  for (let i = 0; i < hearts.length; i++) {
    const h = hearts[i];
    const age = tAnim - h.at;
    if (age < 0 || age >= FX.HEART_S) continue;
    if (reduced) { DS('heart', h.x, h.y, 16, 16, 0); continue; }
    const rise = Math.round(FX.HEART_RISE_PX * easeOut(age / FX.HEART_S));
    const fadeFrom = FX.HEART_S - FX.HEART_FADE_S;
    octx.globalAlpha = age > fadeFrom ? Math.max(0, (FX.HEART_S - age) / FX.HEART_FADE_S) : 1;
    DS('heart', h.x, h.y - rise, 16, 16, age < FX.HEART_FRAME_S ? 0 : 1);
    octx.globalAlpha = 1;
  }
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
    const st = MAP.station('board');
    const bx = st.draw.x, by = st.draw.y;
    octx.fillStyle = COLOR.K;
    octx.fillRect(bx, by - 5, 16, 3);
    octx.fillStyle = COLOR.C;
    const w = Math.round(14 * Math.max(0, Math.min(1, b.slicing.t / b.slicing.total)));
    if (w > 0) octx.fillRect(bx + 1, by - 4, w, 1);
  }
  // Floating numbers, then their coins.
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    const age = tAnim - n.at;
    if (age < 0 || age >= FX.NUMBER_S) continue;
    octx.globalAlpha = numAlpha(age);
    popText(n.str, n.x, n.y - numRise(age), n.color);
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
    else D('coin', n.x - 9, n.y - numRise(age), reduced ? 0 : Math.floor(tAnim * 8) % 2);
    octx.globalAlpha = 1;
  }
  // Sparkles.
  for (let i = 0; i < sparkles.length; i++) {
    const sp = sparkles[i];
    const age = tAnim - sp.at;
    if (age < 0 || age >= FX.SPARKLE_S) continue;
    DS('sparkle', sp.x - 3, sp.y - 3, 14, 14, Math.min(2, Math.floor(age / FX.SPARKLE_FRAME_S)));
  }
  // Tap rings: the full ring, then its four corners. Reduced motion keeps the ring.
  if (s.phase === 'service') {
    for (let i = 0; i < rings.length; i++) {
      const m = rings[i];
      const age = tAnim - m.at;
      if (age < 0 || age >= FX.TAP_RING_S) continue;
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
  if (!art.has('arrow')) return null;
  const t = tutStep();
  const st = t ? targetStation(t.target) : null;
  if (!st) return null;
  const r = stationRects(st)[0];
  const x = r.x + Math.floor(r.w / 2) - 4;
  const above = r.y - 12 >= 22;
  const y = above ? r.y - 12 : r.y + r.h;
  if (sim.state.phase === 'service') {
    const p = sim.state.player;
    const px = Math.round(p.px), py = Math.round(p.py);
    const cx = x + 4, cy = y + 6;
    if (cx >= px && cx < px + TILE && cy >= py - 8 && cy < py + TILE) return null;
  }
  return { st: st, x: x, y: y, above: above };
}

// The tutorial arrow over (or under) the target station, last in pass 6 (K10). A tap on it is a tap
// on the station (round 2, onPointer).
function drawArrow() {
  const a = arrowBox();
  if (!a) return;
  const base = a.above ? 0 : 2;
  const bob = FX.ARROW_BOB_S > 0 ? FX.ARROW_BOB_S : 0.3;
  D('arrow', a.x, a.y, reduced ? base : base + (Math.floor(tAnim / bob) % 2));
}

// The tutorial banner, last before the blit so nothing covers it ([T 2.6], deviation 19).
function drawBanner(b) {
  const st = targetStation(b.target);
  if (st) bannerBottom = st.draw.y < VH / 3;
  const h = b.lines.length > 1 ? 21 : 11;
  const y = bannerBottom ? VH - 2 - h : 2;
  // The art3 font at 2x when every line fits the yard's width; the box grows to the widest line.
  let w3 = 0;
  if (B3 && B3.ready) for (let i = 0; i < b.lines.length; i++) w3 = Math.max(w3, B3.textWidth(b.lines[i], { scale: 2 }));
  if (w3 > 0 && w3 + 7 <= VW - 4) {
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
  octx.fillRect(0, 0, VW, 10);
  octx.fillStyle = 'rgba(91, 184, 240, 0.10)';
  octx.fillRect(0, 0, VW, VH);
  if (reduced || !rainDrops) return;
  octx.fillStyle = COLOR.smokeL;
  for (let i = 0; i < rainDrops.length; i++) {
    const y = Math.floor(rainDrops[i].y);
    if (y < 0 || y > VH - 3) continue;
    octx.fillRect(rainDrops[i].x, y, 1, 3);
  }
}

function render() {
  const s = sim.state;
  const inService = s.phase === 'service';
  octx.globalAlpha = 1;
  octx.fillStyle = COLOR.K;
  octx.fillRect(0, 0, VW, VH);

  drawGround(s);                      // 1. ground
  const custs = drawSorted(s);        // 2. the y-sorted pass
  drawOverhead(s);                    // 3. string lights, canopy
  drawSmokeAndFire(s);                // 4. smoke, puffs, flames
  drawCues(s, custs);                 // 5. bubbles, bars, sweat, zzz, hearts
  drawTop(s);                         // 6. slice bar, numbers, coins, sparkles, tap rings
  if (inService && s.rain) drawRain(); // 7. rain

  // 8. The tutorial banner in place of the clock and GATE OPENS IN, else canvas text in umber boxes.
  if (inService) {
    const banner = bannerNow();
    if (banner) {
      drawBanner(banner);
    } else {
      // W7.4: the rail on a booking or a Yard day, else the v2 clock box; W7.1 times throughout.
      const rail = railNow();
      if (rail) drawRail(rail, s);
      else boxText(String(Math.max(0, Math.ceil(tEnd(s) - s.clock))), 2, 2, null);
      if (s.clock < tGate(s)) boxText('GATE OPENS IN ' + Math.ceil(tGate(s) - s.clock), 2, 183, 'yellow');
      else if (lastCallUntil > nowMs) boxText('LAST CALL', 2, 183, 'yellow');
    }
  } else {
    bannerBottom = false;
  }

  // 9. Blit at the D13 scale, with the burnt shake.
  vctx.imageSmoothingEnabled = false;
  vctx.fillStyle = COLOR.K;
  vctx.fillRect(0, 0, el.cv.width, el.cv.height);
  let ox = 0;
  if (!reduced && shakeUntil > nowMs) ox = (Math.floor(nowMs / 16) % 2 === 0 ? 1 : -1) * kpx;
  vctx.drawImage(off, 0, 0, VW * RS, VH * RS, ox, 0, VW * RS * kpx, VH * RS * kpx);
}

// ---------------------------------------------------------------- DOM per frame

function statusText(s) {
  if (saveOffUntil > nowMs) return 'Saving is off in this browser.';
  if (noticeUntil > nowMs) return U(noticeKey);
  if (blockedUntil > nowMs) return STRINGS.cantGetThere;
  if (s.phase === 'service' && s.clock < tGate(s) && !tutRunning()) {
    // Q-4: before the gate on a booking that mixes a two slot and a one slot meat, the cook order tip.
    const big = todayKind(s) === 'booking' && s.today ? mixBig(s.today.rail) : '';
    return STRINGS.gateOpensIn + Math.ceil(tGate(s) - s.clock) + (big ? '. ' + U('mixShort', { big: big }) : '');
  }
  if (lastCallUntil > nowMs) return STRINGS.lastCall;
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
  if (st !== lastStatus) { lastStatus = st; el.status.textContent = st; }

  const v = sim.verbAt();
  if (v.label !== lastAct) { lastAct = v.label; el.act.textContent = v.label; }
  const dis = !v.enabled;
  if (dis !== lastActDis) { lastActDis = dis; el.act.disabled = dis; }
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

  flushLive();
}

// ---------------------------------------------------------------- start

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
