# Analytics audit: BBQ Board native app (2026-10-23)

This is the `analytics` skill (marketingskills pack). It checks what Board
already sends to GA4 against what the Marketing briefs need to report:
submissions, searches and store opens. The Board consent rules bind
everything here:
- Every parameter has to be named by the consent card sentence
  (src/board/consentCopy.js DISCLOSED_PARAMS).
- src/board/consentInventory.test.js fails the build on any parameter that
  isn't disclosed, any disclosure that's stale, or any error text.

## How Board data reaches GA4

- **Native Firebase Analytics is deactivated** (manifest and Info.plist
  flags). Every event goes through gtag in the WebView, via
  src/board/analytics.js.
- **Nothing is sent until the user taps Allow.** gtm-init.js loads only after
  consent (startAnalyticsIfAllowed). So **every Board number is a
  consented-users-only lower bound.** The briefs should say so, and should
  compare week over week, not against store installs.
- **Each event carries content_group = 'board'** and goes to the shared
  website property. Filter on content_group to isolate Board.

## What already answers the briefs' questions

| Question | Event and parameters | Notes |
|---|---|---|
| How many prices were posted? | board_price_submitted {cut, storeType, region, shopMode, anon} | The headline number. Split by region for "where is Board growing", and by anon for "does the no-account path matter" |
| How many came from ad scans? | board_circular_submitted {proposalCount, successCount, failCount} | successCount is the number of prices posted from one scan |
| Do people who open the form finish? | board_submit_opened → board_price_submitted | The completion rate of the most important flow |
| What are people searching for? | board_city_searched {query_length, hit_count} | **hit_count = 0 is a demand signal for a city Board doesn't cover.** The query text is deliberately never sent |
| Which cities are active? | board_city_changed {city, source}; board_location_detect_success {city, distance} | source shows how people pick a city: near_me, search or state_browse |
| Store opens | board_shop_detail_opened {source: list or map} | Counts are available. Which shop was opened is deliberately not sent |
| Does Near me work? | board_location_detect_success vs board_location_detect_failed {code} | code is the browser's numeric geolocation code |
| Does the walkthrough lose people? | board_onboarding_completed or _skipped {at_card} | |
| Do people delete their own posts? | board_submission_deleted | |

The naming already follows the skill's object_action convention, with a
board_ prefix. The tracking is in good shape, so this audit finds no bugs.

## Gaps, and the fix for each, all within the current disclosure

1. **No key event is confirmed in GA4.**
   - Mark board_price_submitted (and board_circular_submitted) as key
     events in GA4 Admin, so the briefs and the Overview cards count them as
     conversions.
   - It's console work only (no code). It changes the GA4 property's
     settings, so it waits for Joel's yes, then the Overseer clicks it.
2. **No first-submission flag.** Don't add a parameter for it. A GA4
   Exploration (a user segment of "board_price_submitted count = 1 in
   range") answers "how many new submitters this week" with no code and
   no new disclosure.
3. **The onboarding audit's new screens need events. No new parameter names
   are needed except one:**
   - The city step in the walkthrough reuses board_city_changed with
     source 'onboarding'. That's a new value, not a new parameter.
   - The submit confirmation sheet adds board_submit_followup
     {action: another or done}. action is a new parameter, filed under
     "features" in DISCLOSED_PARAMS (the card already says "which screens
     and features you use"). No sentence change, no CONSENT_VERSIONS bump.
   - The in-app review prompt adds board_review_prompt_shown, with no
     parameters. Whether the user left a review is never knowable (the store
     APIs don't say), so nothing more is sent.
4. **Not recommended: sending store type or shop identity on shop opens.**
   - It would let the brief say "butchers get opened most", but storeType on
     a shop open isn't covered by the card's current wording ("store types
     you filter by"). Adding it means widening the sentence and re-prompting
     everyone. board_type_filter already shows interest in butchers.
   - A shop id would bring back the kind of identifier that prefill_shop
     leaked before 2.4.6.

## For the Marketing brief (Wednesday apps briefing)

Weekly Board block, all filtered to content_group = board:

1. Prices posted (board_price_submitted), with the region split.
2. Ad-scan posts (the sum of board_circular_submitted.successCount).
3. Form completion (submitted / submit_opened).
4. Zero-result city searches (board_city_searched where hit_count = 0),
   which shows which cities to seed next.
5. Store opens (board_shop_detail_opened).

Footnote on every Board number: "Consented users only."

## Privacy check (skill validation list)

- **No PII in parameters.** The inventory test enforces this.
  - Error parameters are bounded codes (errorCode()), never text.
  - The email-looking string in analytics.test.js:55 is a fixture proving
    the scrubber drops it.
- **Consent mode waits for consent.**
- **GA4 retention is 14 months** (verified 2026-10-12).
- **Deletion:** the historic prefill_shop data has a deletion request routed
  through the auditor.
