# Onboarding audit: BBQ Board native app (2026-10-23)

This is the `onboarding` skill (marketingskills pack, read from
~/.claude/vendor/marketingskills because it isn't in ~/.claude/skills yet). It
traces the first-run path in src/App.board.jsx and src/board/Onboarding.jsx,
from install to the first price submitted.

Every copy line below is a draft for /antislop. House rule: no "cheapest"
callouts in marketing (Joel, 10/12). The app's own copy is where most
people meet Board, so this audit applies the same direction to it.

## Activation, defined

Board is two-sided, so it has two aha moments:

- **Reader aha:** "I can see what brisket costs at the shops near me, and the
  price is recent." Without this nobody comes back.
- **Network activation:** the user's first submitted price. The submitters
  are the product. A reader who never posts uses the board up, while one who
  posts adds to it.

The current funnel can be read from existing events:
board_onboarding_completed or _skipped → board_city_changed or
board_location_detect_success → board_submit_opened → board_price_submitted.
The analytics audit covers the gaps.

## The current path (inventory)

1. A full-screen 3-card walkthrough (SHOP, SUBMIT, SUPPORT LOCAL) with
   Skip and Next.
2. The home screen, stacked top to bottom:
   - a 150 px logo and wordmark
   - the intro card
   - the analytics consent card
   - the city and radius picker
   - meat chips
   - store-type chips
   - the count line and "+ Submit a price"
   - the shop list
3. **The city defaults to Milwaukee** (localStorage fallback `milwaukee_wi`,
   App.board.jsx:80). Users outside Milwaukee first see shops 900 miles away.
4. The submit modal (shop, cut, price, notes), then "One quick thing" asks
   how to submit (Google or no account), then the modal **closes with no
   confirmation**.

## Findings (Finding → Impact → Fix → Priority)

1. **The first screen shows Milwaukee to everyone.**
   - Impact: the reader aha fails for every non-Milwaukee install. The
     walkthrough says "Pick your city", but nothing makes them, and the
     picker sits under the logo, intro card and consent card, below the fold
     on a phone. Play shows "1+ downloads", so every install counts.
   - Fix: replace the walkthrough's first card with an action (do, don't
     show).
     - "Where do you buy meat?" with a **Near me** button and a city search.
     - Picking a city finishes onboarding and lands on that city's list.
     - A "Skip" leaves Milwaukee as today.
     - Near me stays the existing permission path (city-only, from the
       location fix).
   - Priority: **High.**
2. **A finished submit gets no acknowledgment.**
   - Impact: doSubmit calls onClose() and the modal vanishes. The user's
     most valuable action, and the end of their session, has no peak (the
     skill's Peak-End Rule). They can't tell whether it worked unless they
     scroll to find the shop.
   - Fix: a confirmation sheet.
     - "Posted. Your brisket price at Kettle Range is live for anyone
       searching Milwaukee."
     - Two buttons: "Post another price" (reopens the modal with the same
       shop) and "Done".
     - Keep it truthful: it's live as soon as the write succeeds, because the
       list reads straight from Firestore.
   - Priority: **High.** It's also the natural place for the in-app review
     prompt (see the ASO audit) on the 2nd successful post.
3. **The walkthrough and intro copy are stale.**
   - Card 1 reads "Find the cheapest meat near you", "Cheapest priced first",
     and the intro card says "save a few bucks per pound". That's the
     price-callout framing the 10/12 direction retired.
   - Card 2 says "Sign in with Google...". Submitting has worked without an
     account since the anonymous path shipped.
   - Card 3 names Milwaukee shops (Bunzel's, Kettle Range, Ray's, Rupena's)
     to every user in every city.
   - Fix:
     - Card 1 becomes the city action (finding 1).
     - Card 2 draft: "SUBMIT. See a shop with no price? Post what you paid.
       No account needed. It takes about 20 seconds, and the next cook in
       your city sees it."
     - Card 3 draft: "SUPPORT LOCAL. Tap Butchers to see only the independent
       shops near you."
     - Intro card draft: "Prices posted by people who just bought the cut.
       See a shop with no price? Post what you paid."
   - Priority: **Medium.** It's copy only, so it rides the next code version.
4. **Too many cards before any content.**
   - Impact: the logo block, intro card and consent card all sit above the
     results (Hick's Law). The consent card has to stay (it's the legal
     gate), and it's correctly non-blocking.
   - Fix:
     - Shrink the home logo from 150 px to about 64 px.
     - Drop the intro card once the user has onboarded, since the
       walkthrough already said it.
     - Keep consent where it is.
   - Priority: **Medium.**
5. **The anonymous-submission note is wrong.**
   - "Anonymous submissions can't be edited or deleted later"
     (App.board.jsx:1842) has been false on the same install since 2.4.8.
     It also discourages the no-account path, which is the lowest-friction
     route to activation.
   - Draft: "You can delete prices you post from Settings on this phone.
     Sign in with Google to keep them if you switch phones."
   - Priority: **Medium.**

## Already right

- **Empty states are onboarding.** Unpriced shops list with a Submit button,
  the count line reads "N priced · M waiting on a price", and "Missing a
  butcher?" covers shops not on the list. That's the skill's "empty state
  with a clear first action" pattern.
- **The account ask comes after the work.** The auth gate appears only after
  the user has typed a valid price, and since the fix it no longer throws the
  typed price away.
- **Skip is always available** on the walkthrough, and it's tracked.

## Metrics plan

Funnel, per install:
- Onboarding finished (city picked) → first city list viewed
- → submit opened → first price posted
- → second price posted (habit)

The analytics audit covers the missing events (a first-run city choice
flag, the submit confirmation, and a "post another" tap).

## Ships with

The next Board code version, together with anonymous account deletion, the
in-app review prompt, and the corrected anonymous-submission note. That makes
one release with one consent-copy check.
