# Your Pit: analytics audit and tracking plan (2026-10-23)

Run of the `analytics` skill for the hidden game at holysmokesbbqco.com/yourpit/ (source games/pit-sim). Plan only. Nothing here is implemented, and nothing ships without the Security auditor's sign-off and Joel's yes. Every line of player-facing copy below is a draft that goes through /antislop first.

## 1. Current state

- **Tools:** the page loads the site's standard `public/gtm-init.js`: gtag with GA4 tag G-7X235L8GQS, page_view only.
- **Consent:** region-scoped Consent Mode. analytics_storage is denied by default in the EEA, UK and Switzerland until the visitor answers the banner, and granted elsewhere. The banner choice is stored as `hs-consent-v1` with a `consentTextVersion`. Changing the wording invalidates old answers.
- **The game itself sends nothing.** It has no events, no network calls beyond loading its own files, and two localStorage keys (`hs.pitsim.save`, `hs.pitsim.tip`). The audit trail records "collects nothing" as the game's posture.
- **What GA4 can answer today:** visits to /yourpit/, users, engagement time, device, region, and the referring page.
- **What it cannot answer:** whether anyone played past the title screen, finished a day, came back, or reached the competition.
- **Data so far:** on 10-22 GA4 showed 4 users on /yourpit/, about 3 of them internal (Joel and testing). Real usage is close to zero, which is expected: the page is hidden behind the logo taps and the arrow-key code.

## 2. The decisions this data should inform

Track only what changes a decision:

| Decision | Question | Signal needed |
|---|---|---|
| Is the hidden door worth keeping hidden, or should the game be linked? | Do people who find it play? | start rate, first cook rate |
| Is the first 2 minutes working? | Where do new players drop? | tutorial step reached |
| Is the season too long, too hard, too easy? | How far do players get? | days and weeks finished, money at week end |
| Should we invest in sharing features? | Does anyone come back or share? | return visits, share taps (once a share exists) |
| Does the game send people to the apps or the channel? | Clicks out of the game | outbound taps (only if links are added) |

If a proposed event doesn't serve one of these rows, it doesn't go in.

## 3. Recommended tracking plan (draft)

Naming is object_action, lowercase with underscores. Every parameter is a game number or a fixed label. No names typed by the player (player name, pit name) are ever sent. Those are personal text and stay in the browser.

| Event | Trigger | Parameters | Decision row |
|---|---|---|---|
| `pit_season_started` | A new season begins (after the character creator) | `source`: new or restart | door, first 2 min |
| `pit_tutorial_step` | Each tutorial step reached | `step`: fixed step id (open, charcoal, light, meat, puton, cook, slice, customer, register, plate, deliver, seated, end) | first 2 min |
| `pit_day_finished` | End-of-day report opens | `week` 1 to 7, `day_kind` (yard, booking, comp), `plates` (count), `take_band` (loss, 0 to 49, 50 to 149, 150 plus) | difficulty |
| `pit_week_finished` | Week hub opens for the next week | `week`, `cash_band` (same bands), `cooker` (kettle, cabinet, stick burner, trailer), `crew` (count) | difficulty |
| `pit_season_finished` | Season end screen | `place` (competition result band), `cooker` | difficulty |
| `pit_return_visit` | Page load with an existing save | `week` reached | return |
| `pit_share_tapped` | Only if a share feature is built | `what` (score card) | share |

Notes:
- **Money as bands, not exact numbers.** Bands answer the difficulty question and keep the parameter list short and boring.
- **Return visits:** `pit_return_visit` comes from the save already in the browser. No new identifier is created. GA4's own client id (set only where consent allows) does the rest.
- **Volume:** a full season is about 50 events. That's low.
- **Not tracked:** taps, movement, Arrange yard, music, the Tester tools (preview only, and it must send nothing), errors, the door code.

### Custom dimensions (event scope)

`week`, `day_kind`, `cooker`, `cash_band`, `take_band`, `step`. Register these in GA4 Admin only if the plan is approved.

### Conversions

None at launch. If the game later links to the apps or the channel, mark the outbound tap as the key event.

## 4. How it would be built (when approved)

- One small `track(name, params)` helper in game.js that calls `gtag('event', ...)` only if `window.gtag` exists. The game's own copy stays dependency free: with no gtag (the preview Artifact, the file harness), it does nothing.
- The game never sets consent and never reads the consent key. It inherits the page's Consent Mode, so where analytics is denied, GA4 drops the events at Google's end, the same as every other page.
- The preview Artifact and the harness have no gtag, so they send nothing. The harness gets a step that stubs `window.gtag`, plays a day, and asserts the exact event list and parameter keys. That list becomes the sender inventory.

## 5. Privacy and consent: what must change first

This is the gating item. The game moves from "collects nothing" to "sends anonymous play events".

1. **Consent card text:** per the house rule, the card text is built from the full sender inventory, matched both ways. Add the game's events and parameter keys to the inventory, rewrite the card line, and bump `CONSENT_TEXT_VERSION` so old answers are asked again.
2. **Privacy policy:** add a short game section. It lists the events and parameters above and states that player-typed names are never sent.
3. **The audit trail claim** changes from "collects nothing" to "sends the listed play events through the site's GA4 under the site's consent". The Security auditor re-audits the game against the new claim.
4. **Retention:** the existing 14-month GA4 retention applies. Nothing new.

Until these four are done, the game stays as it is and we read only pageview data.

## 6. Validation checklist (for the build, later)

- [ ] GA4 DebugView shows each event once per trigger, with the documented parameters only
- [ ] No event fires in the preview Artifact or with gtag absent
- [ ] No event fires while analytics_storage is denied (test with the EEA region forced)
- [ ] No player-typed text appears in any parameter (harness asserts the keys and value types)
- [ ] The harness event list matches the sender inventory and the consent card text

## 7. What to do now

1. **Keep reading pageviews.** Real usage is near zero while the door is hidden, so no events are needed yet.
2. **Decide the door question first** (see the `launch` and `free-tools` runs, still to do). If the game stays a hidden easter egg, pageviews plus engagement time may be enough, and the consent change isn't worth it.
3. **If the game gets linked or promoted,** approve this plan, then do the section 5 work, then build section 4 under audit.

No em dashes. Draft only.
